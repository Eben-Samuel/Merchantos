import { intentAgent } from './intentParser';
import { sessionStore, SessionState } from '../store/sessionStore';
import { getDb } from '../config/database';
import { generateId, now } from '../utils/helpers';
import { ChatResponse } from '../types';
import { formatPrice, formatApprovalMessage } from './formatters';
import { generateRecommendations } from './recommendationHelper';
import { paymentOrchestrator } from '../services/paymentOrchestrator';
import { handleConversational } from './conversation';

export class AIOrchestrator {
  async startSession(name?: string): Promise<string> {
    const s = sessionStore.create(name || 'Guest Customer');
    return s.sessionId;
  }
  getSession(sid: string): SessionState | undefined { return sessionStore.get(sid); }
  async getTimeline(sid: string): Promise<any[]> { return (await import('./decisionLogger')).auditAgent.getTimeline(sid); }
  async getAIActionHistory(sid: string): Promise<any[]> { return (await import('./decisionLogger')).auditAgent.getAIActionHistory(sid); }

  async processMessage(sid: string, msg: string): Promise<ChatResponse> {
    let session = sessionStore.get(sid);
    if (!session) { const id = await this.startSession(); return this.processMessage(id, msg); }
    sessionStore.addToConversation(sid, 'user', msg);
    const lower = msg.toLowerCase().trim();
    const prevIntent = session.intent;

    // Conversational layer — greetings & small talk (ChatGPT-powered when configured)
    const convReply = await handleConversational(sid, session, lower, msg);
    if (convReply) return convReply;

    const intent = await intentAgent.parseIntent(msg);
    intent.keywords = intent.keywords || []; intent.use_cases = intent.use_cases || [];
    session.intent = intent;

    const auditAgent = (await import('./decisionLogger')).auditAgent;
    const db = await getDb();
    await db.run(`INSERT INTO intent_trends (id,query,parsed_intent,category,budget,created_at) VALUES(?,?,?,?,?,?)`,
      generateId('it'), msg, JSON.stringify(intent), intent.category||'general', intent.budget||0, now());
    await auditAgent.log({ session_id: sid, actor: 'ai', action: 'intent_detected',
      reason: `budget=${intent.budget||'none'}, category=${intent.category||'none'}, use_cases=${(intent.use_cases||[]).join(',')||'none'}`,
      status: 'success', details: { intent, raw: msg } });
    await auditAgent.logAIAction(sid, null, 'intent_parse', { message: msg }, { intent }, intent.confidence, true);

    // Yes/no handling for pending approvals
    const yes = ['yes','yeah','sure','okay','ok','yep'].includes(lower);
    const no = ['no','nope','nah'].includes(lower);
    if (yes && session.approvalState === 'upsell_pending' && session.upsell) {
      session.cart.push({ product_id: session.upsell.product_id, quantity: 1, price: session.upsell.price });
      session.cartTotal = this._calc(session.cart); session.approvalState = 'await_payment_approval';
      await auditAgent.log({ session_id: sid, actor: 'customer', action: 'upsell_added', reason: 'Customer accepted upsell', status: 'success', details: { product_id: session.upsell.product_id } });
      return { message: `✅ Added ${session.upsell.product_name}. ${formatApprovalMessage(session.cartTotal)}`, cart_total: session.cartTotal, next_action: 'await_payment_approval', requires_approval: true, action_type: 'payment' };
    }
    if (yes && session.approvalState === 'crosssell_pending' && session.crossSells?.length) {
      for (const cs of session.crossSells) session.cart.push({ product_id: cs.product_id, quantity: 1, price: cs.price });
      session.cartTotal = this._calc(session.cart); session.approvalState = 'await_payment_approval';
      await auditAgent.log({ session_id: sid, actor: 'customer', action: 'crosssell_added', reason: 'Customer accepted cross-sell', status: 'success', details: { products: session.crossSells.map((c:any)=>c.product_id) } });
      return { message: `✅ Added cross-sell items. ${formatApprovalMessage(session.cartTotal)}`, cart_total: session.cartTotal, next_action: 'await_payment_approval', requires_approval: true, action_type: 'payment' };
    }
    if (yes && session.approvalState === 'await_payment_approval') return this.initiatePayment(sid);
    if (no && session.approvalState === 'await_payment_approval') {
      session.approvalState = 'none';
      await auditAgent.log({ session_id: sid, actor: 'customer', action: 'payment_declined', reason: 'Customer declined payment', status: 'blocked', details: { cart_total: session.cartTotal } });
      return { message: `No problem — nothing was charged. Your cart (${formatPrice(session.cartTotal || 0)}) is saved. Say "checkout" whenever you're ready.`, next_action: 'await_input', requires_approval: false };
    }
    if (no && session.approvalState === 'upsell_pending') { session.approvalState = 'none'; session.upsell = null;
      return { message: 'No problem, I won\'t add the upsell.', next_action: 'await_input', requires_approval: false }; }
    if (no && session.approvalState === 'crosssell_pending') { session.approvalState = 'none'; session.crossSells = [];
      return { message: 'Okay, I won\'t add those.', next_action: 'await_input', requires_approval: false }; }

    // "Add all these products to my cart" — bulk-add every recommended product shown in chat
    const addAllPattern = /\b(add|put)\b.*\b(all|everything|each|these|them)\b|\badd all\b|\ball of these\b|\badd everything\b/i;
    if (addAllPattern.test(lower)) {
      const recs = session.recommendations || [];
      if (recs.length === 0) {
        return { message: "I don't have any products in the chat to add right now. Ask me to show you something first (e.g. \"show me laptops\"), then say \"add all to cart\".", next_action: 'await_input', requires_approval: false };
      }
      const existing = new Set<string>(session.cart.map((i: any) => i.product_id));
      const added: any[] = []; let skipped = 0; let skippedOOS = 0; let skippedDup = 0;
      for (const r of recs) {
        if (existing.has(r.product_id)) { skippedDup++; continue; }
        if (!r.in_stock) { skippedOOS++; continue; }
        session.cart.push({ product_id: r.product_id, quantity: 1, price: r.price });
        added.push(r); existing.add(r.product_id);
      }
      skipped = skippedDup + skippedOOS;
      session.cartTotal = this._calc(session.cart);
      session.approvalState = 'await_payment_approval';
      await auditAgent.log({ session_id: sid, actor: 'customer', action: 'bulk_added', reason: `Added ${added.length} recommended products to cart`, status: 'success', details: { added: added.map((a: any) => a.product_id), total: session.cartTotal, skipped } });
      let msg = added.length > 0
        ? `✅ Added to your cart: ${added.map((a: any) => a.product_name).join(', ')}.`
        : 'They\'re already in your cart.';
      if (skipped > 0 && added.length > 0) {
        const reasons: string[] = [];
        if (skippedDup > 0) reasons.push(`${skippedDup} already in cart`);
        if (skippedOOS > 0) reasons.push(`${skippedOOS} out of stock`);
        msg += ` (${reasons.join(', ')} skipped)`;
      }
      msg += ` ${formatApprovalMessage(session.cartTotal)}`;
      return { message: msg, cart_total: session.cartTotal, next_action: 'await_payment_approval', requires_approval: true, action_type: 'payment' };
    }

    // Payment in progress — no new searches until completed or cancelled
    if (session.approvalState === 'payment_pending') {
      if (yes || lower.includes('pay') || lower.includes('checkout') || lower.includes('retry')) {
        return this.initiatePayment(sid);
      }
      if (no || lower.includes('cancel') || lower.includes('stop')) {
        session.approvalState = 'await_payment_approval';
        await auditAgent.log({ session_id: sid, actor: 'customer', action: 'payment_cancelled', reason: 'Customer cancelled during payment', status: 'blocked', details: { cart_total: session.cartTotal } });
        return { message: `⚠️ Payment cancelled. Your cart (${formatPrice(session.cartTotal || 0)}) is saved — say "checkout" to start a new payment.`, next_action: 'await_input', requires_approval: false };
      }
      return { message: `⏳ A payment of ${formatPrice(session.cartTotal || 0)} is waiting to be completed in the payment window. Say "cancel" to abort it.`, next_action: 'complete_payment', requires_approval: false };
    }

    // Explicit approval
    if (lower.includes('approve') || lower.includes('checkout') || lower.includes('prepare order')) {
      return this.preparePayment(sid);
    }

    // "What other choices?" / alternatives — reuse the previous intent & exclude already-seen picks
    const altPattern = /(what\s*else|other\s*(choices?|options?|products?|recommendations?|items?|things?|ones?|suggestions?)|alternativ|more\s*(options?|choices?|products?)|show\s*(me\s*)?more|any\s*(other|more)|give\s*me\s*(other|more)|next|different\s*(choices?|options?|products?|ones?))/;
    if (altPattern.test(lower)) {
      const seen = (session.recommendations || []).map((r: any) => r.product_id);
      // Use the current intent if it carries real constraints, otherwise reuse the previous shopping intent
      const altIntent = (intent.category || intent.budget) ? intent : (prevIntent || intent);
      return generateRecommendations(sid, session, altIntent, auditAgent, msg, { alternatives: true, excludeIds: seen });
    }

    return generateRecommendations(sid, session, intent, auditAgent, msg);
  }

  /** Initiate the actual payment — creates the Razorpay (or demo) order and returns gateway details. */
  async initiatePayment(sid: string): Promise<ChatResponse> {
    const session = sessionStore.get(sid);
    if (!session?.cart?.length) return { message: 'Your cart is empty. What would you like to buy?', next_action: 'await_input', requires_approval: false };
    const order = await paymentOrchestrator.createPaymentOrder(sid);
    const auditAgent = (await import('./decisionLogger')).auditAgent;
    if (!order.success) {
      return { message: `⚠️ Payment could not be initiated: ${order.error || 'unknown error'}. Please try again.`, cart_total: session.cartTotal, next_action: 'await_payment_approval', requires_approval: true, action_type: 'payment' };
    }
    await auditAgent.log({ session_id: sid, actor: 'system', action: 'awaiting_payment_gateway', reason: `Awaiting payment via ${order.mock ? 'Test gateway' : 'Razorpay Checkout'}`, status: 'pending', details: { razorpay_order_id: order.orderId, amount: order.amount } });
    await auditAgent.logAIAction(sid, null, 'payment_initiation', { amount: order.amount }, { razorpay_order_id: order.orderId, mock: order.mock }, 1, true);
    return {
      message: `🔐 Payment gateway ready — total ${formatPrice(order.amount)}${order.mock ? '\n\n🧪 Test mode: no real money will be moved (add RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET to .env for live checkout).' : ''}\n\nComplete the payment to place your order.`,
      cart_total: order.amount,
      next_action: 'complete_payment',
      requires_approval: false,
      action_type: 'payment',
      payment: { order_id: order.orderId, amount: order.amount, currency: order.currency, key_id: order.keyId, mock: order.mock, mock_payment_id: order.mock_payment_id, mock_signature: order.mock_signature },
    };
  }

  _calc(items: Array<{product_id:string;quantity:number;price:number}>): number {
    return items.reduce((s,i) => s + i.price * i.quantity, 0);
  }

  async preparePayment(sid: string): Promise<ChatResponse> {
    const session = sessionStore.get(sid);
    if (!session?.cart?.length) return { message: 'Your cart is empty. What would you like to buy?', next_action: 'await_input', requires_approval: false };
    const total = this._calc(session.cart);
    session.cartTotal = total;
    const policyAgent = (await import('./policyAgent')).policyAgent;
    const auditAgent = (await import('./decisionLogger')).auditAgent;
    const check = await policyAgent.checkAction('create_payment_order', total);
    await auditAgent.log({ session_id: sid, actor: 'policy', action: 'policy_check', reason: `create_payment_order, Amount: ${formatPrice(total)}`, status: check.allowed?'success':'blocked', details: check });
    if (!check.allowed) return { message: `⚠️ ${check.reason}`, next_action: 'await_input', requires_approval: false };
    session.approvalState = 'await_payment_approval';
    await auditAgent.log({ session_id: sid, actor: 'ai', action: 'payment_prepared', reason: `Cart finalized at ${formatPrice(total)}. Awaiting approval.`, status: 'success', details: { total, items: session.cart, requires_approval: check.requires_approval } });
    return { message: formatApprovalMessage(total), cart_total: total, next_action: 'await_payment_approval', requires_approval: true, action_type: 'payment' };
  }
}

export const aiOrchestrator = new AIOrchestrator();
