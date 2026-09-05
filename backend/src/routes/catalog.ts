import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { catalogAgent } from '../ai/catalogSearch';

const router = Router();

/** GET /api/catalog/search — Search products (for the marketplace search bar) */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.json({ products: [], count: 0 });
  const products = await catalogAgent.searchProducts({
    search: q as string,
    limit: limit ? parseInt(limit as string) : 50,
  });
  res.json({ products, count: products.length });
}));

/** GET /api/catalog/products — Search products */
router.get('/products', asyncHandler(async (req, res) => {
  const { search, category, maxPrice, inStock, tags, limit } = req.query;
  const products = await catalogAgent.searchProducts({
    search: search as string,
    category: category as string,
    maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
    inStock: inStock === 'true',
    tags: tags as string,
    limit: limit ? parseInt(limit as string) : undefined,
  });
  res.json({ products, count: products.length });
}));

/** GET /api/catalog/products/:id — Get product by ID */
router.get('/products/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  // Handle legacy "/search" calls gracefully
  if (id === 'search' && !req.query.q) return res.json({ products: [], count: 0 });
  const product = await catalogAgent.getProduct(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
}));

const CATEGORY_EMOJIS: Record<string, string> = {
  electronics: '📱', groceries: '🛒', 'home-kitchen': '🍳', clothing: '👕',
  stationery: '✏️', books: 'ðŸ“š', accessories: '👔',
};
/** Verified product photos keyed by keyword (accessories checked FIRST so a
 *  "Laptop Backpack" gets the backpack photo, not the laptop photo). */
const PRODUCT_PHOTOS: Array<[RegExp, string]> = [
  [/backpack|laptop bag|sleeve|laptop stand|mouse pad|pouch/i, 'photo-1553062407-98eeb64c6a62'],
  [/notebook|diary|journal|notepad/i, 'photo-1531346878377-a5be20888e57'],
  [/gel pen|\bpens?\b|fountain/i, 'photo-1585336261022-680e295ce3fe'],
  [/geometry|compass|art supplies|sketch/i, 'photo-1501504905252-473c47e087f8'],
  [/laptop|macbook|notebook pc|ultrathin|chromebook/i, 'photo-1517336714731-489689fd1ca8'],
  [/gaming pc|desktop|tower|imac|monitor/i, 'photo-1546435770-a3e426bf472b'],
  [/smart ?phone|iphone|android|\bphone\b/i, 'photo-1592750475338-74b7b21085ab'],
  [/tablet|ipad/i, 'photo-1544244015-0df4b3ffc6b0'],
  [/earbuds?|airpods|tws/i, 'photo-1606220945770-b5b6c2c55bf1'],
  [/headphones?|headset/i, 'photo-1583394838336-acd977736f90'],
  [/\bmouse\b/i, 'photo-1615663245857-ac93bb7c39e7'],
  [/keyboard/i, 'photo-1541140532154-b024d705b90a'],
  [/smart ?tv|television|\btv\b/i, 'photo-1546435770-a3e426bf472b'],
  [/watch/i, 'photo-1524805444758-089113d48a6d'],
  [/wallet/i, 'photo-1627123424574-724758594e93'],
  [/sunglass/i, 'photo-1572635196237-14b3f281503f'],
  [/handbag|purse|tote/i, 'photo-1548036328-c9fa89d128fa'],
  [/jeans|denim|trouser/i, 'photo-1541099649105-f69ad21f3246'],
  [/t-?shirt|\btee\b|hoodie/i, 'photo-1521572163474-6864f9cf17ab'],
  [/shirt|kurti|ethnic/i, 'photo-1596755094514-f87e34085b2c'],
  [/shoes?|sneakers?|footwear/i, 'photo-1542291026-7eec264c27ff'],
  [/rice|atta|flour|grain|cereal/i, 'photo-1586201375761-83865001e31c'],
  [/tea|chai/i, 'photo-1556679343-c7306c1976bc'],
  [/coffee/i, 'photo-1509042239860-f550ce710b93'],
  [/honey|ghee|syrup/i, 'photo-1587049352846-4a222e784d38'],
  [/spice|masala|turmeric|chilli/i, 'photo-1596040033229-a9821ebd058d'],
  [/dry fruit|nuts?|raisin|almond|cashew/i, 'photo-1599599810769-bcde5a160d32'],
  [/vegetable|fruit|greens|grocery/i, 'photo-1540420773420-3366772f4999'],
  [/cooker|pressure/i, 'photo-1584269600464-37b1b58a9fe7'],
  [/air ?fryer|airfryer/i, 'photo-1556909212-d5b604d0c90d'],
  [/induction|cooktop|stove|hob/i, 'photo-1556911220-bff31c812dba'],
  [/pan|tawa|kadai|skillet/i, 'photo-1565610222536-ef125c59da2e'],
  [/dinner ?set|plates?|bowls?|vessels?|crockery/i, 'photo-1578749556568-bc2c40e68b61'],
  [/bottle|flask|jug/i, 'photo-1602143407151-7111542de6e8'],
  // Book-specific images — each book gets a unique, relevant photo (matched by title/tags)
  [/ai revolution|artificial intelligence/i, 'photo-1629992101753-56d196c8adf3'],
  [/clean code|robert martin/i, 'photo-1587829741301-dc798b83add3'],
  [/rich dad|poor dad|finance|kiyosaki/i, 'photo-1554224155-6726b3ff858f'],
  [/atomic habits|james clear|self-help/i, 'photo-1589829085413-56de8ae18c73'],
  [/deep work|cal newport|productivity/i, 'photo-1506784983877-45594efa4cbe'],
  [/book/i, 'photo-1544947950-fa07a98d237f'],
];

/** GET /api/catalog/image/:id.svg — Product image as an SVG (gradient + emoji + name) */
router.get('/image/:id.svg', asyncHandler(async (req, res) => {
  const product = await catalogAgent.getProduct(req.params.id);
  const id = req.params.id.toLowerCase();
  let emoji = '📦';
  let name = id.split('-').join(' ');
  let category = '';
  let discount = 0;
  if (product) {
    name = product.name;
    category = product.category;
    discount = product.discount_percent || 0;
    const attrs = product.attributes || {};
    emoji = (attrs as any).emoji || CATEGORY_EMOJIS[category.toLowerCase().replace(/\s*&\s*/, '-')] || '📦';
  }
  const raw = req.query.raw === '1';
  if (product && !raw) {
    const hay = [product.name, product.tags, product.category].filter(Boolean).join(' ');
    const photo = PRODUCT_PHOTOS.find(([re]) => re.test(hay));
    if (photo) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.redirect(`https://images.unsplash.com/${photo[1]}?auto=format&fit=crop&w=600&h=600&q=80`);
    }
  }
  // Light pastel gradients per category (offline-safe product card)
  const gradients: Record<string, [string, string]> = {
    'electronics': ['#dbeafe', '#e0e7ff'],
    'groceries': ['#dcfce7', '#d1fae5'],
    'home-kitchen': ['#ffedd5', '#fee2e2'],
    'clothing': ['#fce7f3', '#f3e8ff'],
    'stationery': ['#fef9c3', '#ecfccb'],
    'books': ['#e0e7ff', '#dbeafe'],
    'accessories': ['#ccfbf1', '#e0f2fe'],
  };
  const g = gradients[category.toLowerCase().replace(/\s*&\s*/, '-')] || ['#f1f5f9', '#e2e8f0'];
  const escaped = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${g[0]}"/>
      <stop offset="100%" stop-color="${g[1]}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <circle cx="200" cy="168" r="112" fill="rgba(255,255,255,0.78)"/>
  <circle cx="200" cy="168" r="112" fill="none" stroke="rgba(15,23,42,0.06)" stroke-width="2"/>
  <text x="200" y="206" font-size="122" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <rect x="30" y="296" width="340" height="72" rx="18" fill="rgba(255,255,255,0.95)"/>
  <text x="200" y="324" font-family="Arial, sans-serif" font-size="19" font-weight="bold" fill="#0f172a" text-anchor="middle">${escaped}</text>
  <text x="200" y="350" font-family="Arial, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">${category || 'Merchantos'}</text>
  ${discount > 0 ? `<rect x="296" y="22" width="84" height="34" rx="10" fill="#dc2626"/><text x="338" y="45" font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="#ffffff" text-anchor="middle">-${discount}%</text>` : ''}
</svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
}));

/** GET /api/catalog/related/:id — Get related products */
router.get('/related/:id', asyncHandler(async (req, res) => {
  const compatible = await catalogAgent.getCompatibleProducts(req.params.id);
  const fbt = await catalogAgent.getFrequentlyBoughtTogether(req.params.id);
  res.json({ compatible, frequently_bought_together: fbt });
}));

/** GET /api/catalog/inventory/:id — Check inventory */
router.get('/inventory/:id', asyncHandler(async (req, res) => {
  const inventory = await catalogAgent.checkInventory(req.params.id);
  res.json(inventory);
}));

/** POST /api/catalog/accessories — Recommend accessories/add-ons for the items in a cart.
 *  Given a list of product IDs, returns matching companions (compatible / frequently-bought-together),
 *  falling back to relevant items from the same category or top Accessories when no pairings exist. */
router.post('/accessories', asyncHandler(async (req, res) => {
  const raw = req.body?.ids;
  const ids: string[] = Array.isArray(raw)
    ? raw.map(String).map((s: string) => s.trim()).filter(Boolean)
    : typeof raw === 'string' ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

  const cartIds = new Set<string>(ids);
  interface Rec { product: any; refs: Set<string>; reason: string; }
  const map = new Map<string, Rec>();

  const discounted = (p: any) => Math.round(p.price * (1 - (p.discount_percent || 0) / 100));
  const emojiOf = (p: any) => p?.attributes?.emoji || '📦';

  // First pass: gather explicit pairings for each cart item
  const cartProducts: any[] = [];
  for (const id of ids) {
    const p = await catalogAgent.getProduct(id);
    if (p) cartProducts.push(p);
  }
  for (const p of cartProducts) {
    const cands = [...(await catalogAgent.getFrequentlyBoughtTogether(p.id)), ...(await catalogAgent.getCompatibleProducts(p.id))];
    for (const c of cands) {
      if (cartIds.has(c.id) || c.stock <= 0) continue;
      const e = map.get(c.id) || { product: c, refs: new Set<string>(), reason: `Often bought with ${p.name}` };
      e.refs.add(p.id);
      map.set(c.id, e);
    }
  }

  // Second pass: cart items with no explicit pairing get same-category or generic accessory suggestions
  for (const p of cartProducts) {
    const linked = Array.from(map.values()).some((e) => e.refs.has(p.id));
    if (linked) continue;
    // Prefer accessories in the same category first, then the Accessories category
    let pool = await catalogAgent.searchProducts({ category: p.category, inStock: true, limit: 50 });
    pool = pool.filter((x: any) => !cartIds.has(x.id)).slice(0, 6);
    if (pool.length < 3) {
      const extra = await catalogAgent.searchProducts({ category: 'Accessories', inStock: true, limit: 50 });
      pool = pool.concat(extra.filter((x: any) => !cartIds.has(x.id)));
    }
    for (const a of pool.slice(0, 4)) {
      if (map.has(a.id)) continue;
      map.set(a.id, { product: a, refs: new Set([p.id]), reason: `Pairs well with ${p.name}` });
    }
  }

  const ranked = Array.from(map.values())
    .sort((a, b) => (b.refs.size - a.refs.size) || ((b.product.ai_readiness_score || 0) - (a.product.ai_readiness_score || 0)))
    .slice(0, 8)
    .map((e) => ({
      id: e.product.id,
      name: e.product.name,
      category: e.product.category,
      price: discounted(e.product),
      original_price: e.product.price,
      discount_percent: e.product.discount_percent || 0,
      emoji: emojiOf(e.product),
      stock: e.product.stock,
      reason: e.reason,
      in_stock: e.product.stock > 0,
    }));

  res.json({ count: ranked.length, accessories: ranked });
}));

/** GET /api/catalog/categories — Get all categories */
router.get('/categories', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  const categories = await db.all(`SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category`);
  res.json({ categories: categories.map(c => c.category) });
}));

/** GET /api/catalog/deals — Best discount deals (Deals of the Day) */
router.get('/deals', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  const limit = parseInt((req.query.limit as string) || '8', 10);
  const rows = await db.all(
    `SELECT * FROM products WHERE is_active = 1 AND discount_percent > 0 AND stock > 0
     ORDER BY discount_percent DESC, ai_readiness_score DESC LIMIT ?`,
    limit
  );
  const deals = rows.map((p: any) => ({
    id: p.id, name: p.name, category: p.category, price: p.price,
    discount_percent: p.discount_percent,
    discounted_price: Math.round(p.price * (1 - (p.discount_percent || 0) / 100)),
    emoji: (() => { try { const a = JSON.parse(p.attributes_json || '{}'); return a.emoji || '📦'; } catch { return '📦'; } })(),
    stock: p.stock, ai_readiness_score: p.ai_readiness_score,
  }));
  res.json({ count: deals.length, deals });
}));

/** GET /api/catalog/trending — Trending products (top AI-readiness, high-stock) */
router.get('/trending', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  const limit = parseInt((req.query.limit as string) || '8', 10);
  const rows = await db.all(
    `SELECT * FROM products WHERE is_active = 1 AND stock > 0
     ORDER BY ai_readiness_score DESC, stock DESC LIMIT ?`,
    limit
  );
  const trending = rows.map((p: any) => ({
    id: p.id, name: p.name, category: p.category, price: p.price,
    discount_percent: p.discount_percent || 0,
    discounted_price: Math.round(p.price * (1 - (p.discount_percent || 0) / 100)),
    emoji: (() => { try { const a = JSON.parse(p.attributes_json || '{}'); return a.emoji || '📦'; } catch { return '📦'; } })(),
    stock: p.stock, ai_readiness_score: p.ai_readiness_score,
  }));
  res.json({ count: trending.length, trending });
}));

/** GET /api/catalog/counts — Product count per category (for home page cards) */
router.get('/counts', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  const rows = await db.all(
    `SELECT category, COUNT(*) as count FROM products WHERE is_active = 1 GROUP BY category`
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.category] = r.count;
  res.json({ counts: map, total: rows.reduce((s: number, r: any) => s + r.count, 0) });
}));

/** GET /api/catalog/hero — hero data (stats + sample featured) */
router.get('/hero', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  const total = (await db.get('SELECT COUNT(*) c FROM products WHERE is_active = 1')).c;
  const deals = (await db.get('SELECT COUNT(*) c FROM products WHERE discount_percent > 0 AND stock > 0')).c;
  const inStock = (await db.get('SELECT COUNT(*) c FROM products WHERE stock > 0')).c;
  res.json({
    total_products: total,
    active_deals: deals,
    in_stock: inStock,
    categories: (await db.all('SELECT DISTINCT category FROM products WHERE is_active = 1')).length,
    tagline: 'India\'s AI-powered supermarket — electronics, groceries, clothing, stationery & more.',
    perks: [
      { icon: '🚚', title: 'Free Shipping', desc: 'On orders above ₹499' },
      { icon: '⚡', title: '5% Bundle Discount', desc: 'Buy 2+ items together' },
      { icon: '🛡️', title: 'Secure Payments', desc: 'Powered by Razorpay' },
      { icon: '🤖', title: 'AI Shopping Assistant', desc: 'Finds the best deals for you' },
    ],
  });
}));

/** ===== 🎡 SPIN & WIN — gamified coupon wheel ===== */
const SPIN_PRIZES = [5, 8, 10, 15, 0, 5, 8, 0]; // wheel segments (0 = free-shipping consolation)

/** POST /api/catalog/spin - 5 spins per day per client; win a real one-time coupon code */
router.post('/spin', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  await db.run(`CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, percent INTEGER, created_at TEXT, used INTEGER DEFAULT 0)`);
  await db.run(`CREATE TABLE IF NOT EXISTS spins (client_id TEXT, day TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (client_id, day))`);
  const cid = String((req.body || {}).client_id || 'anon').slice(0, 64);
  const day = new Date().toISOString().slice(0, 10);
  const MAX_SPINS = 5;
  const row = await db.get(`SELECT count FROM spins WHERE client_id = ? AND day = ?`, cid, day);
  const used = row ? Number(row.count) : 0;
  if (used >= MAX_SPINS) {
    return res.json({ win: false, percent: 0, code: '', spins_left: 0, message: 'You have used all 5 spins for today. Come back tomorrow for more!' });
  }
  const percent = SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)];
  let win = false; let code = ''; let message = '';
  if (percent > 0) {
    win = true;
    code = `SPIN${percent}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await db.run(`INSERT INTO coupons (code, percent, created_at) VALUES (?, ?, ?)`, code, percent, new Date().toISOString());
    message = '\uD83C\uDF89 You won ' + percent + '% OFF! Code: ' + code;
  } else {
    message = '\uD83D\uDE0A So close! Your consolation: FREE shipping is unlocked on orders \u20B9499+ anyway.';
  }
  if (row) await db.run(`UPDATE spins SET count = count + 1 WHERE client_id = ? AND day = ?`, cid, day);
  else await db.run(`INSERT INTO spins (client_id, day, count) VALUES (?, ?, 1)`, cid, day);
  res.json({ win, percent, code, spins_left: MAX_SPINS - used - 1, message });
}));

/** GET /api/catalog/coupon/:code — validate a coupon */
router.get('/coupon/:code', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  const row = await db.get(`SELECT * FROM coupons WHERE code = ? AND used = 0`, String(req.params.code).toUpperCase());
  if (!row) return res.status(404).json({ valid: false, error: 'Invalid or already-used coupon' });
  res.json({ valid: true, percent: row.percent, code: row.code });
}));

/** POST /api/catalog/coupon/:code/use — mark a coupon as redeemed */
router.post('/coupon/:code/use', asyncHandler(async (req, res) => {
  const db = await import('../config/database').then(m => m.getDb());
  await db.run(`UPDATE coupons SET used = 1 WHERE code = ?`, String(req.params.code).toUpperCase());
  res.json({ ok: true });
}));

export default router;
