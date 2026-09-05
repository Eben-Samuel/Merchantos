import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, X, Lock, Mic } from 'lucide-react';
import { api } from '../api/client';
import { useSpeech } from '../lib/speech';

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
  timestamp?: string;
}

interface PaymentInfo {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  mock?: boolean;
  mock_payment_id?: string;
  mock_signature?: string;
}

interface ChatResponse {
  message: string;
  recommendations?: Array<{
    product_id: string;
    product_name: string;
    price: number;
    score: number;
    reason: string;
  }>;
  upsell?: { product_id: string; product_name: string; price: number; reason: string } | null;
  cross_sells?: Array<{ product_id: string; product_name: string; price: number; reason: string }>;
  cart_total?: number;
  next_action?: string;
  requires_approval?: boolean;
  action_type?: string;
  payment?: PaymentInfo;
}

declare global {
  interface Window { Razorpay?: any; }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const SUGGESTIONS = [
  'I need a laptop for college under 80000',
  'Formal shirt for office under 2000',
  'Gift for my sister birthday under 3000',
  'Wireless mouse for office',
];

const QUICK_CHIPS = ['🔥 Offers today', '🚚 Delivery time', '↩️ Return policy', '🧾 Track order'];

export function ChatInterface({ embedded }: { embedded?: boolean }) {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = chatScrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);

  const pushAI = (content: string) => setMessages((prev) => [...prev, { role: 'ai', content }]);

  const startSession = async (): Promise<string | null> => {
    try {
      const data = await api.post<{ session_id: string; message: string }>('/chat/start', { customer_name: customerName.trim() || 'Guest' });
      setSessionId(data.session_id);
      setMessages([{ role: 'ai', content: data.message }]);
      return data.session_id;
    } catch (err: any) {
      setMessages([{ role: 'ai', content: `Error: ${err.message}` }]);
      return null;
    }
  };
  const handlePayment = async (payment: PaymentInfo, sid: string) => {
    if (payment.mock) {
      pushAI('🧪 Test gateway: processing payment (no real money moves)…');
      await new Promise((r) => setTimeout(r, 1200));
      try {
        const res = await api.post<{ success: boolean; orderId: string; message: string }>('/chat/verify-payment', {
          session_id: sid,
          razorpay_order_id: payment.order_id,
          razorpay_payment_id: payment.mock_payment_id,
          razorpay_signature: payment.mock_signature,
        });
        pushAI(res.message);
        window.dispatchEvent(new CustomEvent('merchantos:order', { detail: { amount: payment.amount } }));
      } catch (err: any) {
        pushAI(`❌ Payment verification failed: ${err.message}`);
      }
      return;
    }
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) { pushAI('❌ Could not load Razorpay Checkout. Check your connection and try again.'); return; }
    const rzp = new window.Razorpay({
      key: payment.key_id,
      amount: Math.round(payment.amount * 100),
      currency: payment.currency,
      name: 'MERCHANTOS AI',
      description: 'AI-assisted purchase',
      order_id: payment.order_id,
      prefill: { name: customerName.trim() || 'Guest' },
      theme: { color: '#8b5cf6' },
      handler: async (response: any) => {
        try {
          const res = await api.post<{ success: boolean; orderId: string; message: string }>('/chat/verify-payment', {
            session_id: sid,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          pushAI(res.message);
          window.dispatchEvent(new CustomEvent('merchantos:order', { detail: { amount: payment.amount } }));
        } catch (err: any) {
          pushAI(`❌ Payment verification failed: ${err.message}`);
        }
      },
      modal: { ondismiss: () => pushAI('âš ️ Payment window closed. Your cart is saved — say "checkout" to try again.') },
    });
    rzp.open();
  };

  const send = async (text: string, sid?: string) => {
    const target = sid || sessionId;
    if (!target) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const data = await api.post<ChatResponse>('/chat/message', { session_id: target, message: text });
      setPendingApproval(!!data.requires_approval);
      pushAI(data.message);
      if (data.payment && data.next_action === 'complete_payment') await handlePayment(data.payment, target);
    } catch (err: any) {
      pushAI(`Error: ${err.message}`);
    } finally { setLoading(false); }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    let sid = sessionId;
    if (!sid) {
      const started = await startSession();
      if (!started) return;
      sid = started;
    }
    const text = input;
    setInput('');
    await send(text, sid);
  };

  const handleApproval = async (approved: boolean) => {
    if (loading || !sessionId) return;
    await send(approved ? 'yes' : 'no');
  };

  const startWithSuggestion = async (s: string) => {
    if (loading) return;
    const sid = await startSession();
    if (!sid) return;
    await send(s, sid);
  };
  const { listening, supported, toggle: toggleMic } = useSpeech((text) => {
    setInput(text);
    if (sessionId) { send(text); } else { startSession().then((sid) => { if (sid) send(text, sid); }); }
  });

  if (!sessionId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Welcome to MERCHANTOS AI</h2>
          <p className="text-muted-foreground">Your AI-powered shopping assistant.</p>
        </div>
        <div className="space-y-3 mb-6">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => startWithSuggestion(s)}
              className="w-full text-left p-3 bg-card border border-border rounded-lg hover:bg-muted transition-colors">{s}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <input type="text" placeholder="Your name (optional)" value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="flex-1 px-3 py-2 bg-input border border-input rounded-lg focus:outline-none" />
          <button onClick={startSession}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Start Chat</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-200px)]">
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className="space-y-2">
            {msg.role === 'ai' ? (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0"><Bot className="w-5 h-5 text-primary" /></div>
                <div className="bg-card border border-border rounded-lg p-4 max-w-[85%]"><div className="whitespace-pre-wrap text-sm">{msg.content}</div></div>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <div className="bg-primary text-primary-foreground border border-primary rounded-lg p-4 max-w-[85%]"><div className="whitespace-pre-wrap text-sm">{msg.content}</div></div>
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0"><User className="w-5 h-5" /></div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 pb-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0"><Bot className="w-5 h-5 text-primary animate-pulse" /></div>
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-1.5">
              <span className="typing-dot w-2 h-2 rounded-full bg-primary inline-block" />
              <span className="typing-dot w-2 h-2 rounded-full bg-primary inline-block" />
              <span className="typing-dot w-2 h-2 rounded-full bg-primary inline-block" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex gap-2 flex-wrap">
          {QUICK_CHIPS.map((chip) => (
            <button key={chip} onClick={() => send(chip)} disabled={loading}
              className="text-xs px-3 py-1.5 bg-muted/70 border border-border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors">{chip}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..." disabled={loading}
            className="flex-1 px-3 py-2 bg-input border border-input rounded-lg focus:outline-none" />
          {supported && (
            <button onClick={toggleMic} disabled={loading} title={listening ? 'Listening, tap to stop' : 'Voice shopping, speak your request'}
              className={`px-3 py-2 rounded-lg border transition-all ${listening ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}>
              <Mic className="w-4 h-4" />
            </button>
          )}
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <Send className="w-4 h-4" />
          </button>
        </div>
        {pendingApproval && (
          <div className="flex justify-center gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground">Approve to initiate secure payment:</span>
            <button onClick={() => handleApproval(true)} disabled={loading}
              className="text-xs px-4 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full hover:bg-green-500/30">
              <Lock className="w-3 h-3 inline mr-1" /> Approve &amp; Pay
            </button>
            <button onClick={() => handleApproval(false)} disabled={loading}
              className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full hover:bg-red-500/30">
              <X className="w-3 h-3 inline mr-1" /> Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}