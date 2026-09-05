

import { sessionStore, SessionState } from '../store/sessionStore';
import { catalogAgent } from './catalogSearch';
import { chatComplete, isLLMConfigured, LLMMessage } from './llm';
import { auditAgent } from './decisionLogger';
import { ChatResponse } from '../types';

/** Conversational AI layer — greetings, small talk & smart fallbacks.
 *  Uses ChatGPT when OPENAI_API_KEY is set; falls back to a friendly rule engine. */

const SYSTEM_PROMPT = `You are "Merchantos AI", the warm, proactive shopping assistant for Merchantos.in — an Indian online supermarket selling electronics & gadgets, groceries, home & kitchen vessels, clothing, stationery, books and accessories.
Rules:
- Greet the customer warmly like a human store helper would.
- Recommend ONLY products from the provided catalog sample.
- ALWAYS proactively suggest 1-3 relevant accessories or add-ons around the customer's purchase (phone → case + earphones; laptop → bag + mouse; tea/coffee → mug; notebook → pen set; pressure cooker → steel bottles) and mention the bundle benefit: "5% OFF + FREE shipping when bought together".
- Keep replies under 90 words, at most 2 emoji, use ₹ prices when known.
- Never invent products that are not in the catalog.`;

const GREETING_FALLBACK = [
  'Hello! 👋 How can I assist you today?',
  '',
  "What's on your mind to purchase from our platform? I can find 📱 gadgets, 🛒 groceries, 🍳 kitchen vessels, 👕 clothing, ✏️ stationery & more — and I'll suggest matching accessories with 5% OFF + FREE shipping when you buy them together.",
  '',
  'Try: "wireless earbuds under 6000" or "groceries for the week"',
].join('\n');

const GREETING_PATTERNS = [
  /^(hi+|hey+|hello+|yo|namaste|namaskar|vanakkam|hlo)\b/,
  /^good\s*(morning|afternoon|evening|day)\b/,
  /^(hi|hii+|hello|hey)\s+(there|merchantos|bot|assistant|shop)\b/,
];

const SMALL_TALK: Array<{ type: string; patterns: RegExp[]; fallback: string }> = [
  {
    type: 'thanks',
    patterns: [/\b(thanks|thank\s*you|thx|dhanyawad)\b/],
    fallback: "You're most welcome! 😊 Anything else I can pick out for you? Remember — 5% OFF + FREE shipping on bundles of 2+ items.",
  },
  {
    type: 'bye',
    patterns: [/\b(bye|goodbye|see\s*you|alvida|exit|quit)\b/],
    fallback: 'Thanks for shopping with Merchantos! 🛒 Your cart is saved — come back anytime. Have a great day! 👋',
  },
  {
    type: 'howru',
    patterns: [/\b(how\s*are\s*you|how\s*r\s*u|whats\s*up|what's\s*up|sup|kaise\s*ho)\b/],
    fallback: "I'm doing great — ready to hunt down some deals for you! 🤖💨 Tell me what you're shopping for today.",
  },
  {
    type: 'who',
    patterns: [/\b(who\s*are\s*you|your\s*name|what\s*are\s*you|about\s*you)\b/],
    fallback: "I'm Merchantos AI — your personal shopping assistant for India's AI-powered supermarket! 🤖 I know all 142+ products across 7 categories, can compare specs, hunt deals, build money-saving bundles (5% OFF + FREE shipping) and even place your order securely. What shall we find today?",
  },
  {
    type: 'delivery',
    patterns: [/\b(deliver(y|ies)?|delivered|shipping|shipped|ships?|when\s*will.*(arrive|come|reach)|how\s*long.*(deliver|ship)|courier)\b/],
    fallback: "🚚 Delivery is FAST: 2-3 days in metros, 4-6 days elsewhere. Shipping is FREE on orders above ₹499 — and always free when you buy 2+ items together (bundle perk!). Want me to find something to order today?",
  },
  {
    type: 'returns',
    patterns: [/\b(returns?|refunds?|exchanges?|replacements?|damaged|warranty|guarantee)\b/],
    fallback: "↩️ Easy returns: 7-day no-questions returns on everything, 10 days on electronics. Damaged item? We replace it free. Electronics carry 1-year brand warranty. Just place the order — shopping with us is risk-free!",
  },
  {
    type: 'payment',
    patterns: [/\b(payments?|pay|upi|cod|cash\s*on\s*delivery|cards?|netbanking|net\s*banking|razorpay|emis?)\b/],
    fallback: "💳 We accept UPI (GPay/PhonePe/Paytm), debit & credit cards, netbanking, wallets and Cash on Delivery — all secured by Razorpay. Anything above ₹499 ships FREE, and 2+ items together get 5% OFF. What would you like to buy?",
  },
  {
    type: 'offers',
    patterns: [/\b(offers?|discounts?|sales?|deals?|coupons?|cheaper|saves?|cashbacks?|lowest\s*price)\b/],
    fallback: "🔥 Today's hottest deals: up to 15% OFF site-wide! Plus our standing offer — buy ANY 2+ items and get 5% OFF + FREE shipping automatically. Tell me a category or budget and I'll find the biggest savings for you!",
  },
  {
    type: 'track',
    patterns: [/\b(track|order\s*status|where\s*is\s*my|my\s*order|order\s*history)\b/],
    fallback: "📦 You can see every order with live status on the Orders page (top-right 👤 menu). Past purchases show as Delivered/Processing. Want to add anything else to today's cart while you're here?",
  },
  {
    type: 'gift',
    patterns: [/\b(gifts?|presents?|birthday|anniversary|surprises?)\b/],
    fallback: "🎁 Love gifting! Popular picks: Minimalist Analog Watch (₹1,899), Silk Maroon Tie (₹599), The AI Revolution book (₹449), Mixed Dry Fruits (₹749). Tell me who it's for + your budget and I'll curate the perfect gift set with 5% OFF!",
  },
  {
    type: 'complain',
    patterns: [/\b(complain|complaint|bad|worst|issue|problem|angry|frustrat|not\s*working)\b/],
    fallback: "I'm really sorry about that! 😔 Please share what went wrong — wrong item, late delivery, quality issue? I'll flag it to our support team right away. Meanwhile, is there anything I can quickly fix for you in this order?",
  },
  {
    type: 'joke',
    patterns: [/\b(joke|funny|laugh|bore|boring)\b/],
    fallback: "Why did the smartphone go to therapy? It lost its contacts! 😄 Now that we've broken the ice — electronics, groceries or something fun for your home? I've got deals in every aisle!",
  },
  {
    type: 'seller',
    patterns: [/\b(sell|seller|list\s*my\s*product|partner|vendor|become\s*a\s*merchant)\b/],
    fallback: "🤝 Want to sell on Merchantos? We onboard sellers with zero listing fees for the first 3 months and AI-powered demand insights. Log in with a seller account to list products, or leave your details — our team will reach out!",
  },
  {
    type: 'help',
    patterns: [/\b(help|what\s*can\s*you\s*do|options|commands)\b/],
    fallback: "I can help you:\n• 🔍 Find products — \"wireless earbuds under 6000\"\n• 🎁 Suggest gifts — \"gift for sister under 3000\"\n• 🛒 Build bundles — add accessories with 5% OFF + FREE shipping\n• 💳 Take you through secure payment & orders",
  },
];

function detectSmallTalk(lower: string): { type: string; fallback: string } | null {
  for (const st of SMALL_TALK) {
    if (st.patterns.some((p) => p.test(lower))) return { type: st.type, fallback: st.fallback };
  }
  return null;
}

async function buildContext(sid: string): Promise<string> {
  const session = sessionStore.get(sid);
  let cartCtx = 'Cart: empty.';
  if (session?.cart?.length) {
    const names = await Promise.all(
      session.cart.map(async (i) => {
        const p = await catalogAgent.getProduct(i.product_id);
        return `${p?.name || i.product_id} ×${i.quantity}`;
      }),
    );
    cartCtx = `Cart: ${names.join(', ')}.`;
  }
  const top = await catalogAgent.searchProducts({ limit: 12 });
  const catalogSnippet = top.map((p) => `- ${p.name} (₹${p.price}, ${p.category})`).join('\n');
  return `Catalog sample:\n${catalogSnippet}\n${cartCtx}`;
}

async function askLLM(sid: string, userText: string, maxTokens = 220): Promise<string | null> {
  if (!isLLMConfigured()) return null;
  const session = sessionStore.get(sid);
  const history: LLMMessage[] = (session?.conversation || [])
    .slice(-6)
    .map((c) => ({ role: c.role === 'user' ? ('user' as const) : ('assistant' as const), content: c.content }));
  const context = await buildContext(sid);
  const messages: LLMMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${context}` },
    ...history,
    { role: 'user', content: userText },
  ];
  return chatComplete(messages, { maxTokens });
}

function finalize(sid: string, session: SessionState, message: string, action: string): ChatResponse {
  sessionStore.addToConversation(sid, 'ai', message);
  auditAgent
    .log({ session_id: sid, actor: 'ai', action, reason: message.substring(0, 120), status: 'success', details: { llm: isLLMConfigured() } })
    .catch(() => {});
  auditAgent.logAIAction(sid, null, 'conversation', { action }, { llm: isLLMConfigured(), preview: message.substring(0, 80) }, 0.9, true);
  return { message, next_action: 'await_input', requires_approval: false };
}

/** Returns a conversational reply (greeting / small talk) or null to continue the shopping flow. */
export async function handleConversational(sid: string, session: SessionState, lower: string, raw: string): Promise<ChatResponse | null> {
  // Greetings — only when the message is short and clearly a greeting
  const isGreeting = GREETING_PATTERNS.some((p) => p.test(lower)) && lower.length < 40;
  if (isGreeting) {
    let message = await askLLM(
      sid,
      `The customer just opened the chat and said: "${raw}". Greet them back warmly, ask what they'd like to purchase today, and tease 2 popular example searches with prices.`,
      180,
    );
    if (!message) message = GREETING_FALLBACK;
    return finalize(sid, session, message, 'greeting');
  }

  const st = detectSmallTalk(lower);
  if (st) {
    let message = await askLLM(
      sid,
      `Customer said: "${raw}". Respond as a friendly store assistant. Keep it under 60 words and nudge them toward a purchase.`,
      150,
    );
    if (!message) message = st.fallback;
    return finalize(sid, session, message, `smalltalk_${st.type}`);
  }

  return null;
}

/** Smart, helpful fallback when a product search found nothing (LLM-enhanced). */
export async function smartFallback(sid: string, session: SessionState, raw: string, intent: any): Promise<string> {
  const llm = await askLLM(
    sid,
    `Customer asked: "${raw}". No exact catalog match was found. Acknowledge it, tell them the closest categories we DO have (electronics, groceries, home & kitchen, clothing, stationery, books, accessories), and ask one clarifying question (budget or type) so you can recommend accessories around their need. Under 80 words.`,
    200,
  );
  if (llm) return llm;
  const cats = ['Electronics', 'Groceries', 'Home & Kitchen', 'Clothing', 'Stationery', 'Books', 'Accessories'];
  const kw = (intent?.keywords || []).slice(0, 3).join(', ') || 'that';
  return `I couldn't find an exact match for "${kw}" right now. 🤔\n\nWe DO have great picks in: ${cats.join(' • ')}\n\nTry another name or share your budget — e.g. "kitchen vessels under 1000" or "best laptop for college". And whatever you pick, I'll suggest accessories with 5% OFF + FREE shipping on bundles!`;
}

