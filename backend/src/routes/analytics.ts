import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { businessIntelligence } from '../ai/businessIntelligence';
import { analytics } from '../ai/analytics';

const router = Router();

/** GET /api/analytics — Get dashboard metrics */
router.get('/', asyncHandler(async (_req, res) => {
  const metrics = await analytics.getMetrics();
  res.json(metrics);
}));

/** GET /api/analytics/readiness — Get AI readiness score */
router.get('/readiness', asyncHandler(async (_req, res) => {
  const score = await businessIntelligence.getAIReadinessScore();
  res.json(score);
}));

/** GET /api/analytics/opportunities — Get revenue opportunities */
router.get('/opportunities', asyncHandler(async (_req, res) => {
  const opps = await businessIntelligence.getRevenueOpportunities();
  res.json({ opportunities: opps });
}));

/** GET /api/analytics/ab-test — Get A/B test metrics */
router.get('/ab-test', asyncHandler(async (_req, res) => {
  const metrics = await businessIntelligence.getABTestMetrics();
  res.json(metrics);
}));

/** POST /api/analytics/simulator — Get revenue simulator results */
router.post('/simulator', asyncHandler(async (req, res) => {
  const { upsellRate, crossSellRate, conversionRate, aov } = req.body;
  const result = await businessIntelligence.getRevenueSimulator({
    upsellRate: parseFloat(upsellRate) || 15,
    crossSellRate: parseFloat(crossSellRate) || 10,
    conversionRate: parseFloat(conversionRate) || 8.7,
    aov: parseInt(aov) || 1500,
  });
  res.json(result);
}));

/** GET /api/analytics/intention-map — Get customer intent map */
router.get('/intention-map', asyncHandler(async (_req, res) => {
  const map = await businessIntelligence.getIntentionMap();
  res.json(map);
}));

/** GET /api/analytics/funnel — Get conversion funnel data */
router.get('/funnel', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  const funnel = await db.all(`
    SELECT 'sessions' as stage, COUNT(*) as count FROM sessions
    UNION ALL SELECT 'cart_started' as stage, COUNT(*) FROM audit_events WHERE action = 'catalog_searched'
    UNION ALL SELECT 'checkout' as stage, COUNT(*) FROM audit_events WHERE action = 'razorpay_order_created'
    UNION ALL SELECT 'paid' as stage, COUNT(*) FROM orders WHERE status = 'paid'
  `);
  res.json({ funnel });
}));

export default router;
