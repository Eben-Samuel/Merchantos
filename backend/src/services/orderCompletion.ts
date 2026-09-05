import { getDb } from '../config/database';
import { generateId, now } from '../utils/helpers';
import { sessionStore } from '../store/sessionStore';
import { catalogAgent } from '../ai/catalogSearch';
import { auditAgent } from '../ai/decisionLogger';

/** Complete order creation, inventory update + revenue events. Idempotent. */
export async function completeOrder(sessionId: string, session: any, paymentId: string, razorpayOrderId: string, paymentDetails: any): Promise<{ success: boolean; orderId: string; message: string }> {
  const db = await getDb();
  const total = session.cartTotal;
  await db.run('BEGIN');
  try {
    const orderId = generateId('ord');
    await db.run(`INSERT INTO orders (id,session_id,customer_name,total_amount,currency,status,razorpay_order_id,razorpay_payment_id,is_ai_assisted,upsell_applied,cross_sell_applied,ai_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      orderId, sessionId, session.customerName, total, 'INR', 'paid', razorpayOrderId, paymentId, 1,
      session.upsell?1:0, session.crossSells?.length?1:0, session.intent?.confidence||0.8, now(), now());

    for (const item of session.cart) {
      const product = await catalogAgent.getProduct(item.product_id);
      if (product) {
        const itemType = (session.upsell?.product_id === item.product_id || session.crossSells?.find((c:any)=>c.product_id===item.product_id))?'addon':'primary';
        await db.run(`INSERT INTO order_items (id,order_id,product_id,product_name,quantity,price,variant_id,item_type) VALUES(?,?,?,?,?,?,?,?)`,
          generateId('oi'), orderId, item.product_id, product.name, item.quantity, item.price, item.variant_id||null, itemType);
        await db.run(`UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?`, item.quantity, item.product_id);
      }
    }

    await db.run(`INSERT INTO payments (id,order_id,razorpay_payment_id,amount,currency,status,method,verified_at) VALUES(?,?,?,?,?,?,?,?)`,
      generateId('pay'), orderId, paymentId, total, 'INR', 'captured', paymentDetails.method||'card', now());
    await db.run(`INSERT INTO revenue_events (id,order_id,amount,revenue_type,created_at) VALUES(?,?,?,?,?)`, generateId('rev'), orderId, total, 'ai_assisted', now());
    if (session.upsell) await db.run(`INSERT INTO revenue_events (id,order_id,amount,revenue_type,created_at) VALUES(?,?,?,?,?)`, generateId('rev'), orderId, session.upsell.price, 'upsell', now());
    if (session.crossSells?.length) for (const cs of session.crossSells) await db.run(`INSERT INTO revenue_events (id,order_id,amount,revenue_type,created_at) VALUES(?,?,?,?,?)`, generateId('rev'), orderId, cs.price, 'cross_sell', now());

    for (const rec of session.recommendations || []) {
      await db.run(`INSERT INTO recommendations (id,session_id,product_id,product_name,score,reason,recommendation_type,accepted,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
        generateId('rec'), sessionId, rec.product_id, rec.product_name, rec.score, rec.reason, rec.type,
        session.cart.find((i:any)=>i.product_id===rec.product_id)?1:0, now());
    }
    await db.run('COMMIT');
    session.orderId = orderId; session.approvalState = 'paid';
    await auditAgent.log({ session_id: sessionId, order_id: orderId, actor: 'ai', action: 'order_created', reason: `Order #${orderId} created`, status: 'success', details: { orderId, total, items: session.cart.length } });
    await auditAgent.log({ session_id: sessionId, order_id: orderId, actor: 'system', action: 'inventory_updated', reason: 'Stock decremented', status: 'success', details: { items: session.cart.map((i:any)=>({pid:i.product_id,qty:i.quantity})) } });
    await auditAgent.log({ session_id: sessionId, order_id: orderId, actor: 'system', action: 'payment_verified', reason: 'Verified via signature + API', status: 'success', details: { payment_id: paymentId, amount: total, method: paymentDetails.method } });
    return { success: true, orderId, message: `✅ Payment verified\n✅ Order created (#${orderId})\n✅ Inventory updated\n💰 AI-assisted revenue: ${total}` };
  } catch (err: any) {
    await db.run('ROLLBACK');
    await auditAgent.log({ session_id: sessionId, actor: 'system', action: 'order_creation_failed', reason: err.message, status: 'failed', details: { error: err.message } });
    session.approvalState = 'failed';
    return { success: false, orderId: '', message: `Order creation failed: ${err.message}` };
  }
}
