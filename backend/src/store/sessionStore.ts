import { generateId, now } from '../utils/helpers';

export interface SessionState {
  sessionId: string;
  customerName: string;
  intent: any;
  recommendations: any[];
  upsell: any | null;
  crossSells: any[];
  cart: Array<{ product_id: string; quantity: number; price: number; variant_id?: string }>;
  cartTotal: number;
    approvalState: 'none' | 'await_budget' | 'upsell_pending' | 'crosssell_pending' | 'payment_pending' | 'payment_initiated' | 'cart_confirmed' | 'await_payment_approval' | 'paid' | 'failed';
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  orderId: string | null;
  lastUpdated: string;
  conversation: Array<{ role: string; content: string; timestamp: string }>;
}

/**
 * SessionStore — In-memory session management for the AI agent.
 * In production, this would be Redis or a database.
 */
class SessionStore {
  private sessions: Map<string, SessionState> = new Map();

  create(customerName: string = 'Guest Customer'): SessionState {
    return this.ensure(generateId('sess'), customerName);
  }

  /** Get an existing session or create one with the given ID (storefront carts). */
  ensure(sessionId: string, customerName: string = 'Guest Customer'): SessionState {
    let state = this.sessions.get(sessionId);
    if (!state) {
      state = {
        sessionId, customerName, intent: null, recommendations: [], upsell: null,
        crossSells: [], cart: [], cartTotal: 0, approvalState: 'none',
        razorpayOrderId: null, razorpayPaymentId: null, orderId: null, lastUpdated: now(),
        conversation: [],
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  update(sessionId: string, updates: Partial<SessionState>): SessionState {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error(`Session ${sessionId} not found`);
    Object.assign(state, updates, { lastUpdated: now() });
    return state;
  }

  addToConversation(sessionId: string, role: string, content: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.conversation.push({ role, content, timestamp: now() });
    state.lastUpdated = now();
  }

  clearCart(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) { state.cart = []; state.cartTotal = 0; state.approvalState = 'none'; state.upsell = null; state.crossSells = []; }
  }

  resetCart(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);
    if (state) { state.cart = []; state.cartTotal = 0; state.approvalState = 'none'; state.upsell = null; state.crossSells = []; }
    return state!;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}

export const sessionStore = new SessionStore();
