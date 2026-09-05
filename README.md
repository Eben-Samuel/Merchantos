# MERCHANTOS AI
An AI-native shopping assistant with **Razorpay payment integration**, built as a multi-agent system: an AI agent searches the catalog, recommends products, applies upsell/cross-sell suggestions, enforces merchant policies, and completes payments — with **every AI decision logged to an audit trail**.

## Architecture

```
├── backend/          Express + TypeScript + SQLite
│   └── src/
│       ├── ai/               Agent layer
│       │   ├── intentParser.ts        NL → structured intent (budget, category, use-cases)
│       │   ├── catalogSearch.ts       Product search (word-level matching + fallback)
│       │   ├── recommendationEngine.ts Scoring & ranking
│       │   ├── recommendationHelper.ts Search → recommend → cart pipeline
│       │   ├── revenueBrain.ts        Upsell / cross-sell / bundle detection
│       │   ├── policyAgent.ts         GREEN/YELLOW/RED action guardrails
│       │   ├── decisionLogger.ts      Audit trail + AI action history
│       │   └── orchestrator.ts        Conversation state machine
│       ├── services/         Razorpay orders, payment verification, order completion
│       ├── routes/           REST API (chat, catalog, order, payment, analytics, demo…)
│       └── config/           Env, SQLite database, schema
├── frontend/         React 19 + Vite + Tailwind + Recharts
│   └── src/components/
│       ├── ChatInterface.tsx   Chat + approval buttons + Razorpay Checkout
│       ├── AnalyticsDashboard.tsx  Revenue / funnel / AI metrics
│       ├── OrderHistory.tsx    Orders with AI attribution
│       └── HealthCheck.tsx     System status
└── data/             SQLite database
```

## Quick Start

```bash
# 1. Install dependencies
cd backend  && npm install
cd frontend && npm install

# 2. Start the backend (port 4000)
cd backend && npm run dev

# 3. Start the frontend dev server (port 5173, proxies /api → 4000)
cd frontend && npm run dev
```

Open **http://localhost:5173** — or run the production build and serve everything from one port:

```bash
cd frontend && npm run build   # outputs to backend/public
# the backend then serves the app at http://localhost:4000
```

## Payments — two modes

| Mode | When | Behavior |
|------|------|----------|
| 🧪 **Demo** (default) | No `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in `backend/.env` | Simulated gateway; HMAC signature verification works end-to-end; no real money |
| 💳 **Live test** | Real Razorpay test keys in `.env` | Opens the real Razorpay Checkout window; server-side signature + payment fetch verification |

## Example conversation

```
You:  show me wireless earbuds under 6000
AI:   I recommend **Pro Wireless Earbuds** for ₹5,499. ✓ Within budget ✓ In stock
      Your final total is ₹5,499. I will not place the order until you approve the payment.
You:  yes
AI:   🔐 Payment gateway ready — total ₹5,499 (DEMO MODE)
      → Checkout opens automatically → order created, inventory updated
```

Also try: `checkout`, `cancel`, `gift for my sister birthday under 3000`, `gaming laptop under 100000`.

## Key API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat/start` | New session |
| POST | `/api/chat/message` | Send message `{session_id, message}` |
| POST | `/api/chat/verify-payment` | Verify Razorpay signature & complete order |
| GET  | `/api/chat/timeline/:sessionId` | Decision audit trail |
| GET  | `/api/catalog/products?search=&maxPrice=` | Catalog search |
| GET  | `/api/analytics` | Merchant dashboard metrics |
| GET  | `/api/analytics/funnel` | Conversion funnel |
| GET  | `/api/order` | Order history |
| POST | `/api/demo/reset` | Reset & reseed demo data |

## Safety model

- **GREEN** — read-only actions (search, recommend, inventory): autonomous
- **YELLOW** — discounts: require approval, capped by policy
- **RED** — payments: never autonomous without explicit customer approval
- All AI decisions → `audit_events`; AI reasoning → `ai_actions` (queryable via `/api/chat/history/:sessionId`)

## Tech

Express · TypeScript · SQLite (sqlite3) · Razorpay SDK · React 19 · Vite · Tailwind CSS · Recharts · Lucide
