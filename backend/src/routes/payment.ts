import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { isRazorpayConfigured } from '../services/razorpayService';
import { config } from '../config/env';

const router = Router();

/** GET /api/payment/config — Get Razorpay config for frontend */
router.get('/config', asyncHandler(async (_req, res) => {
  res.json({
    key_id: config.razorpay.keyId,
    configured: isRazorpayConfigured(),
    currency: 'INR',
    test_cards: [
      { brand: 'Visa', number: '4111 1111 1111 1111', expiry: 'Any future date', cvv: 'Any', name: 'Test Card' },
      { brand: 'Mastercard', number: '5105 1051 0510 5100', expiry: 'Any future date', cvv: 'Any', name: 'Test Card' },
      { brand: 'Mastercard', number: '5105 1051 0510 5100', expiry: 'Any future date', cvv: 'Any', name: '3D Secure Test' },
    ],
  });
}));

/** POST /api/payment/verify — Verify a payment (alternative endpoint) */
router.post('/verify', asyncHandler(async (req, res) => {
  const { session_id, ...paymentData } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  const { paymentOrchestrator } = await import('../services/paymentOrchestrator');
  const result = await paymentOrchestrator.verifyAndComplete(session_id, paymentData);
  res.json(result);
}));

export default router;
