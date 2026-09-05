import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config/env';

let razorpayInstance: Razorpay | null = null;

function getClient(): Razorpay {
  if (!razorpayInstance) {
    if (!config.razorpay.keyId || config.razorpay.keyId === 'rzp_test_XXXXXXXXXXXXXXXX') {
      throw new Error('Razorpay key ID not configured. Set RAZORPAY_KEY_ID in .env');
    }
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpayInstance;
}

export function isRazorpayConfigured(): boolean {
  return !!config.razorpay.keyId &&
         config.razorpay.keyId !== 'rzp_test_XXXXXXXXXXXXXXXX' &&
         !!config.razorpay.keySecret &&
         config.razorpay.keySecret !== 'YOUR_SECRET_HERE';
}

/** DEMO MODE — creates a local mock order when Razorpay keys are not configured. */
export function createMockOrder(amount: number, currency: string = 'INR', receipt?: string): Promise<any> {
  return Promise.resolve({
    id: `order_mock_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    amount: Math.round(amount * 100),
    currency,
    receipt: receipt || `merchantos_demo_${Date.now()}`,
    status: 'created',
    mock: true,
  });
}

/** DEMO MODE — signature used to validate mock payments (HMAC, same algorithm as Razorpay). */
export function getMockSignature(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${orderId}|${paymentId}`).digest('hex');
}

/** Create a Razorpay order (falls back to demo mode when keys are missing) */
export async function createRazorpayOrder(amount: number, currency: string = 'INR', receipt?: string): Promise<any> {
  if (!isRazorpayConfigured()) return createMockOrder(amount, currency, receipt);
  const client = getClient();
  const order = await client.orders.create({
    amount: Math.round(amount * 100), // Razorpay uses smallest currency unit (paise)
    currency,
    receipt: receipt || `merchantos_${Date.now()}`,
        payment_capture: 1 as any, // Auto-capture
  });
  return order;
}

/** Verify Razorpay payment signature (demo mode validates the locally-generated mock signature) */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  try {
    if (!isRazorpayConfigured() || orderId.startsWith('order_mock_')) {
      return crypto.timingSafeEqual(
        Buffer.from(getMockSignature(orderId, paymentId)),
        Buffer.from(signature || ''),
      );
    }
    const hmac = crypto.createHmac('sha256', config.razorpay.keySecret);
    hmac.update(orderId + '|' + paymentId);
    const generatedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Validate webhook signature */
export function validateWebhookSignature(body: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret || config.razorpay.webhookSecret);
    hmac.update(body);
    const generatedSignature = 'sha256=' + hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Fetch payment details from Razorpay (demo mode simulates a captured payment) */
export async function fetchPayment(paymentId: string): Promise<any> {
  if (!isRazorpayConfigured() || paymentId.startsWith('pay_mock_')) {
    return { id: paymentId, status: 'captured', currency: 'INR', method: 'demo_upi', amount: 0, mock: true };
  }
  const client = getClient();
  return client.payments.fetch(paymentId);
}

/** Fetch order details from Razorpay */
export async function fetchOrder(orderId: string): Promise<any> {
  const client = getClient();
  return client.orders.fetch(orderId);
}
