import { sessionStore } from '../store/sessionStore';
import { auditAgent } from '../ai/decisionLogger';
import { createRazorpayOrder, verifyPaymentSignature, fetchPayment, isRazorpayConfigured, getMockSignature } from './razorpayService';
import { completeOrder } from './orderCompletion';
import { config } from '../config/env';

export interface CreatedPaymentOrder {
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  mock?: boolean;
  mock_payment_id?: string;
  mock_signature?: string;
  error?: string;
}

/** PaymentOrchestrator — creates Razorpay orders, verifies payments, handles webhooks. */
export class PaymentOrchestrator {
  async createPaymentOrder(sessionId: string): Promise<CreatedPaymentOrder> {
    const session = sessionStore.get(sessionId);
    if (!session || session.cart.length === 0) return { success: false, orderId: '', amount: 0, currency: 'INR', keyId: '', error: 'Cart is empty' };
    const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    try {
      const order = await createRazorpayOrder(total, 'INR', `order_${sessionId.substring(0,12)}`);
          session.razorpayOrderId = order.id; session.approvalState = 'payment_pending';
      const mock = !isRazorpayConfigured() || !!order.mock;
      const mock_payment_id = mock ? `pay_mock_${Date.now()}_${Math.floor(Math.random() * 100000)}` : undefined;
      const mock_signature = mock && mock_payment_id ? getMockSignature(order.id, mock_payment_id) : undefined;
      await auditAgent.log({ session_id: sessionId, actor: 'ai', action: 'razorpay_order_created', reason: `Created ${mock ? 'Test' : 'Razorpay'} order for ₹${total}`, status: 'success', details: { razorpay_order_id: order.id, amount: total, mock } });
      return { success: true, orderId: order.id, amount: total, currency: 'INR', keyId: config.razorpay.keyId, mock, mock_payment_id, mock_signature };
    } catch (err: any) {
      await auditAgent.log({ session_id: sessionId, actor: 'system', action: 'razorpay_order_failed', reason: err.message, status: 'failed', details: { error: err.message, amount: total } });
      return { success: false, orderId: '', amount: total, currency: 'INR', keyId: config.razorpay.keyId, error: err.message };
    }
  }

  async verifyAndComplete(sessionId: string, paymentData: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; }): Promise<{ success: boolean; orderId: string; message: string }> {
    const session = sessionStore.get(sessionId);
    if (!session) return { success: false, orderId: '', message: 'Session not found' };
    if (session.orderId || session.approvalState === 'paid') return { success: true, orderId: session.orderId || '', message: 'Order already completed' };

    await auditAgent.log({ session_id: sessionId, actor: 'system', action: 'payment_verification_started', reason: 'Verifying signature', status: 'pending', details: { payment_id: paymentData.razorpay_payment_id } });

    const valid = verifyPaymentSignature(paymentData.razorpay_order_id, paymentData.razorpay_payment_id, paymentData.razorpay_signature);
    if (!valid) {
      await auditAgent.log({ session_id: sessionId, actor: 'system', action: 'payment_verification_failed', reason: 'Invalid signature', status: 'failed', details: { payment_id: paymentData.razorpay_payment_id } });
      session.approvalState = 'failed';
      return { success: false, orderId: '', message: 'Payment signature verification failed. No order was created.' };
    }

    let details: any;
    try { details = await fetchPayment(paymentData.razorpay_payment_id); } catch (err: any) {
      await auditAgent.log({ session_id: sessionId, actor: 'system', action: 'payment_fetch_failed', reason: err.message, status: 'failed', details: { payment_id: paymentData.razorpay_payment_id, error: err.message } });
      return { success: false, orderId: '', message: 'Could not verify payment. Please try again.' };
    }

    if (details.status !== 'captured' && details.status !== 'authorized') {
      await auditAgent.log({ session_id: sessionId, actor: 'system', action: 'payment_not_captured', reason: `Status: ${details.status}`, status: 'failed', details: { payment_id: paymentData.razorpay_payment_id, status: details.status } });
      session.approvalState = 'failed';
      return { success: false, orderId: '', message: `Payment not captured (status: ${details.status}).` };
    }

    return completeOrder(sessionId, session, paymentData.razorpay_payment_id, paymentData.razorpay_order_id, details);
  }

  async handleWebhook(event: any): Promise<{ processed: boolean; message: string }> {
    const { event: eventType, id: eventId, payload } = event;
    const db = await import('../config/database').then(m => m.getDb());
    const existing = await db.get('SELECT id FROM audit_events WHERE details_json LIKE ?', `%${eventId}%`);
    if (existing) return { processed: false, message: 'Webhook already processed' };
    await auditAgent.log({ session_id: 'webhook', actor: 'system', action: `webhook_${eventType}`, reason: `Webhook ${eventType}`, status: 'success', details: { event_id: eventId } });
    if (eventType === 'payment.verified' || eventType === 'order.paid') {
      const pid = payload?.payment_id || payload?.payment?.id;
      if (pid) await db.run(`UPDATE payments SET status='captured' WHERE razorpay_payment_id=?`, pid);
      const oid = payload?.order_id || payload?.payment?.order_id;
      if (oid) await db.run(`UPDATE orders SET status='paid' WHERE razorpay_order_id=?`, oid);
      return { processed: true, message: 'Webhook processed' };
    }
    return { processed: false, message: `Event ${eventType} not handled` };
  }
}

export const paymentOrchestrator = new PaymentOrchestrator();
