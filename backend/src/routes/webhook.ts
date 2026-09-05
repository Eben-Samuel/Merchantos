import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { paymentOrchestrator } from '../services/paymentOrchestrator';
import { validateWebhookSignature } from '../services/razorpayService';
import { config } from '../config/env';

const router = Router();

/** POST /api/webhooks/razorpay — Handle Razorpay webhook events */
router.post('/razorpay', asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const body = req.body; // Raw body (express.raw middleware in index.ts)

  if (!signature) return res.status(400).json({ error: 'Missing signature header' });

  const bodyString = Buffer.isBuffer(body) ? body.toString() : JSON.stringify(body);
  const isValid = validateWebhookSignature(bodyString, signature, config.razorpay.webhookSecret || '');

  if (!isValid) {
    console.warn('[Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  let event: any;
  try { event = typeof body === 'string' ? JSON.parse(body) : body; } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const result = await paymentOrchestrator.handleWebhook(event);
  res.json(result);
}));

/** POST /api/webhooks/razorpay/test — Test webhook endpoint (for local testing) */
router.post('/razorpay/test', asyncHandler(async (req, res) => {
  const result = await paymentOrchestrator.handleWebhook(req.body);
  res.json(result);
}));

export default router;
