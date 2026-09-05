import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { getDb } from '../config/database';

const router = Router();

/** POST /api/order - Create a web-checkout order (Amazon/Flipkart style) */
router.post('/', asyncHandler(async (req, res) => {
  const db = await getDb();
  const { customer_name, items, payment_method } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });
  const total = items.reduce((s: number, i: any) => s + Number(i.price) * Number(i.quantity || 1), 0);
  const orderId = 'ORD-' + Date.now().toString().slice(-8);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO orders (id,session_id,customer_name,total_amount,currency,status,razorpay_order_id,razorpay_payment_id,is_ai_assisted,upsell_applied,cross_sell_applied,ai_confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    orderId, 'web-checkout', String(customer_name || 'Guest Customer'), total, 'INR', 'paid', 'web_' + orderId, 'webpay_' + orderId, 0, 0, 0, 1, now, now
  );
  for (const item of items) {
    await db.run(
      `INSERT INTO order_items (id,order_id,product_id,product_name,quantity,price,variant_id,item_type) VALUES(?,?,?,?,?,?,?,?)`,
      'oi_' + orderId + '_' + Math.random().toString(36).slice(2, 7), orderId, String(item.product_id), String(item.name || item.product_id), Number(item.quantity || 1), Number(item.price), null, 'primary'
    );
    await db.run(`UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?`, Number(item.quantity || 1), String(item.product_id));
  }
  await db.run(
    `INSERT INTO payments (id,order_id,razorpay_payment_id,amount,currency,status,method,verified_at) VALUES(?,?,?,?,?,?,?,?)`,
    'pay_' + orderId, orderId, 'webpay_' + orderId, total, 'INR', 'success', String(payment_method || 'razorpay'), now
  );
  res.json({ success: true, order_id: orderId, total, message: 'Order placed successfully' });
}));
/** GET /api/order - List all orders */
router.get('/', asyncHandler(async (_req, res) => {
  const db = await getDb();
  const orders = await db.all(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 50`);
  const ordersWithItems = await Promise.all(orders.map(async (o: any) => {
    const items = await db.all(`SELECT * FROM order_items WHERE order_id = ?`, o.id);
    return { ...o, items };
  }));
  res.json({ orders: ordersWithItems, count: orders.length });
}));

/** GET /api/order/:id — Get order by ID with items and payment */
router.get('/:id', asyncHandler(async (req, res) => {
  const db = await getDb();
  const order = await db.get(`SELECT * FROM orders WHERE id = ?`, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = await db.all(`SELECT * FROM order_items WHERE order_id = ?`, req.params.id);
  const payment = await db.get(`SELECT * FROM payments WHERE order_id = ?`, req.params.id);
  res.json({ order, items, payment });
}));

/** GET /api/order/session/:sessionId — Get orders for a session */
router.get('/session/:sessionId', asyncHandler(async (req, res) => {
  const db = await getDb();
  const orders = await db.all(`SELECT * FROM orders WHERE session_id = ? ORDER BY created_at DESC`, req.params.sessionId);
  res.json({ orders });
}));

/** GET /api/order/revenue/type/:type — Get revenue events by type */
router.get('/revenue/:type', asyncHandler(async (req, res) => {
  const db = await getDb();
  const events = await db.all(`SELECT * FROM revenue_events WHERE revenue_type = ? ORDER BY created_at DESC LIMIT 50`, req.params.type);
  const total = await db.get(`SELECT COALESCE(SUM(amount),0) as total FROM revenue_events WHERE revenue_type = ?`, req.params.type);
  res.json({ events, total: total.total });
}));

export default router;
