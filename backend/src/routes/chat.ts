import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { aiOrchestrator } from '../ai/orchestrator';
import { policyAgent } from '../ai/policyAgent';
import { auditAgent } from '../ai/decisionLogger';
import { paymentOrchestrator } from '../services/paymentOrchestrator';
import { businessIntelligence } from '../ai/businessIntelligence';

const router = Router();

/** Remove markdown emphasis characters (*, _, #) so chat text always renders clean. */
function stripMarkdown(text: string): string {
  return String(text ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.*?)\*/g, '$1')       // *italic*
    .replace(/__(.*?)__/g, '$1')       // __bold__
    .replace(/#+\s?/g, '');            // # headings
}

/** Clean-text helper shared by chat endpoints below */

/** POST /api/chat/start — Start a new shopping session */
router.post('/start', asyncHandler(async (req, res) => {
  const { customer_name } = req.body;
  const sessionId = await aiOrchestrator.startSession(customer_name);
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 12 ? 'Good Morning' : hour >= 12 && hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetName = (customer_name || '').trim() || 'there';
  res.json({ session_id: sessionId, message: part + ', ' + greetName + "! What's in your mind - I can assist you in shopping!" });
}));

/** POST /api/chat/message — Process a customer message */
router.post('/message', asyncHandler(async (req, res) => {
  const { session_id, message } = req.body;
  if (!session_id || !message) return res.status(400).json({ error: 'session_id and message required' });

  const response = await aiOrchestrator.processMessage(session_id, message);
  if (response?.message) response.message = stripMarkdown(response.message);
  res.json(response);
}));

/** POST /api/chat/prepare-payment — Create Razorpay order for the cart */
router.post('/prepare-payment', asyncHandler(async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const session = aiOrchestrator.getSession(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Check policy before creating payment
  const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const check = await policyAgent.checkAction('create_payment_order', total);
  if (!check.allowed) return res.status(403).json({ error: check.reason, policy_check: check });

  const order = await paymentOrchestrator.createPaymentOrder(session_id);
  res.json(order);
}));

/** POST /api/chat/verify-payment — Verify payment after Razorpay Checkout */
router.post('/verify-payment', asyncHandler(async (req, res) => {
  const { session_id, ...paymentData } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  const result = await paymentOrchestrator.verifyAndComplete(session_id, paymentData);
  res.json(result);
}));

/** GET /api/chat/timeline/:sessionId — Get decision timeline */
router.get('/timeline/:sessionId', asyncHandler(async (req, res) => {
  const timeline = await auditAgent.getTimeline(req.params.sessionId);
  res.json(timeline);
}));

/** GET /api/chat/history/:sessionId — Get AI action history */
router.get('/history/:sessionId', asyncHandler(async (req, res) => {
  const history = await auditAgent.getAIActionHistory(req.params.sessionId);
  res.json(history);
}));

/** POST /api/chat/ai-buyer — AI buyer mode (AI→AI commerce) */
router.post('/ai-buyer', asyncHandler(async (req, res) => {
  const { request, session_id } = req.body;
  const sessionId = session_id || await aiOrchestrator.startSession('AI Buyer Agent');

  const lower = (request || '').toLowerCase();

  if (lower.includes('find') || lower.includes('search')) {
    // Parse the AI buyer's search request
    const response = await aiOrchestrator.processMessage(sessionId, request);
    res.json({ session_id: sessionId, type: 'search_results', response });
  } else if (lower.includes('rank') || lower.includes('sort') || lower.includes('compare')) {
    const session = aiOrchestrator.getSession(sessionId);
    if (!session?.recommendations) {
      return res.json({ session_id: sessionId, type: 'rank_results', message: 'Please search first.', recommendations: [] });
    }
    // Rank by price, rating (ai_readiness), and suitability (score)
    const sorted = [...session.recommendations].sort((a: any, b: any) => {
      const aPrice = a.price, bPrice = b.price;
      return aPrice - bPrice; // by price ascending
    });
    res.json({ session_id: sessionId, type: 'rank_results', message: 'Ranked by price (ascending).', recommendations: sorted });
  } else if (lower.includes('prepare order') || lower.includes('order') || lower.includes('buy')) {
    const response = await aiOrchestrator.processMessage(sessionId, request);
    res.json({ session_id: sessionId, type: 'order_prepared', response });
  } else {
    const response = await aiOrchestrator.processMessage(sessionId, request);
    res.json({ session_id: sessionId, type: 'response', response });
  }
}));

/** GET /api/chat/policies — Get safety policies */
router.get('/policies', asyncHandler(async (_req, res) => {
  const policies = await policyAgent.getPolicies();
  const safety = await policyAgent.getSafetyStatus();
  res.json({ policies, safety });
}));

/** GET /api/chat/readiness — Get AI readiness score */
router.get('/readiness', asyncHandler(async (_req, res) => {
  const score = await businessIntelligence.getAIReadinessScore();
  res.json(score);
}));

export default router;
