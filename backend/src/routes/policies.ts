import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { policyAgent } from '../ai/policyAgent';

const router = Router();

/** GET /api/policies — List all merchant policies/guardrails */
router.get('/', asyncHandler(async (_req, res) => {
  const policies = await policyAgent.getPolicies();
  res.json({ policies });
}));

/** GET /api/policies/safety — Get safety status summary */
router.get('/safety', asyncHandler(async (_req, res) => {
  const safety = await policyAgent.getSafetyStatus();
  res.json({ safety });
}));

/** POST /api/policies/check — Check if an action is allowed */
router.post('/check', asyncHandler(async (req, res) => {
  const { action, amount } = req.body;
  if (!action) return res.status(400).json({ error: 'action required' });
  const result = await policyAgent.checkAction(action, amount);
  res.json(result);
}));

export default router;
