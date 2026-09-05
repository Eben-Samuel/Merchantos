import { Router } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/helpers';
import { config } from '../config/env';
import { getDb } from '../config/database';
import { generateId, now } from '../utils/helpers';

/** Demo auth system — Admin, User & Seller logins with HMAC-signed bearer tokens. */

const DEMO_USERS = [
  { username: 'admin', password: 'admin123', name: 'Store Admin', role: 'admin' },
  { username: 'user', password: 'user123', name: 'Rahul Sharma', role: 'user' },
  { username: 'seller', password: 'seller123', name: 'Sunrise Traders', role: 'seller' },
];

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signToken(username: string, name: string, role: string): string {
  const payload = { u: username, n: name, r: role, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): any | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', config.jwtSecret).update(body).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Reads the Authorization: Bearer header and returns the user (or null). */
export function currentUser(req: any): { username: string; name: string; role: string } | null {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const p = verifyToken(token);
  return p ? { username: p.u, name: p.n, role: p.r } : null;
}

const router = Router();

/** POST /api/auth/login — { username, password } */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  const user = DEMO_USERS.find((u) => u.username === String(username || '').trim().toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  const token = signToken(user.username, user.name, user.role);
  res.json({ token, user: { username: user.username, name: user.name, role: user.role }, demo: true });
}));

/** GET /api/auth/me — current user from bearer token */
router.get('/me', asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user });
}));

/** GET /api/auth/demo-users — list of demo logins (for the login page) */
router.get('/demo-users', asyncHandler(async (_req, res) => {
  res.json({ users: DEMO_USERS.map((u) => ({ username: u.username, name: u.name, role: u.role })) });
}));

/** POST /api/auth/seller/products — seller/admin adds a product (role-guarded) */
router.post('/seller/products', asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!user || !['seller', 'admin'].includes(user.role)) {
    return res.status(403).json({ error: 'Seller or Admin login required' });
  }
  const { name, category, price, discount_percent, stock, description, emoji } = req.body || {};
  if (!name || !category || !price) return res.status(400).json({ error: 'name, category and price are required' });
  const db = await getDb();
  const id = `p_sl_${user.username}_${Date.now().toString(36)}`;
  await db.run(
    `INSERT INTO products (id, name, description, category, price, discount_percent, stock, attributes_json, variants_json, tags, compatible_products, frequently_bought_together, target_use_cases, customer_segments, merchant_rule_json, ai_readiness_score, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    String(name).trim(),
    String(description || `${name} listed by ${user.name}.`),
    String(category),
    Math.round(Number(price)),
    Math.min(70, Math.max(0, Math.round(Number(discount_percent) || 0))),
    Math.max(1, Math.round(Number(stock) || 10)),
    JSON.stringify({ emoji: emoji || '🛍️', listed_by: user.name }),
    '[]',
    String(name).toLowerCase(),
    '',
    '',
    'general',
    'everyone',
    '{}',
    85,
    now(),
    now(),
  );
  await db.run(`INSERT INTO audit_events (id, session_id, actor, action, reason, status, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    generateId('evt'), user.username, user.role === 'admin' ? 'merchant' : 'seller', 'product_listed', `${user.name} listed "${name}"`, 'success', JSON.stringify({ product_id: id, category, price }), now());
  res.json({ success: true, product_id: id, message: `"${name}" is now live on Merchantos!` });
}));

/** GET /api/auth/seller/products — products listed by this seller (or all for admin) */
router.get('/seller/products', asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!user || !['seller', 'admin'].includes(user.role)) {
    return res.status(403).json({ error: 'Seller or Admin login required' });
  }
  const db = await getDb();
  const rows = user.role === 'admin'
    ? await db.all(`SELECT * FROM products WHERE id LIKE 'p_sl_%' ORDER BY created_at DESC LIMIT 50`)
    : await db.all(`SELECT * FROM products WHERE id LIKE ? ORDER BY created_at DESC LIMIT 50`, `p_sl_${user.username}_%`);
  res.json({ products: rows, count: rows.length });
}));

export default router;
