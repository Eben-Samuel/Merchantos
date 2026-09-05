

import { catalogAgent } from './catalogSearch';
import { recommendationAgent } from './recommendationEngine';
import { revenueBrain } from './revenueBrain';
import { sessionStore } from '../store/sessionStore';
import { generateId } from '../utils/helpers';
import { ChatResponse } from '../types';
import { formatPrice, formatApprovalMessage, formatRecommendationMessage } from './formatters';
import { auditAgent } from './decisionLogger';
import { smartFallback } from './conversation';

/** Recommendation generation helper — separated from orchestrator for modularity. */
const CATEGORY_LABELS = new Set([
  'electronics', 'gadgets', 'groceries', 'grocery', 'home', 'kitchen',
  'home kitchen', 'home & kitchen', 'clothing', 'stationery', 'books',
  'accessories', 'book',
]);

export async function generateRecommendations(
  sid: string,
  session: any,
  intent: any,
  _audit: any,
  rawMsg?: string,
  opts: { alternatives?: boolean; excludeIds?: string[] } = {}
): Promise<ChatResponse> {
  // When the user asks for alternatives, reuse the previous intent and exclude already-seen picks
  let effectiveIntent = intent;
  if (opts.alternatives && session.intent) {
    if (!intent.category && session.intent.category) effectiveIntent = session.intent;
  }
  const excludeIds = new Set<string>(opts.excludeIds || []);

  // Scope the search to the right aisle when the primary keyword is a known product type
  const TYPE_CATEGORY: Record<string, string> = {
laptop: 'Electronics', phone: 'Electronics', smartphone: 'Electronics', earbuds: 'Electronics',
    headphones: 'Electronics', headset: 'Electronics', mouse: 'Electronics', keyboard: 'Electronics',
    monitor: 'Electronics', tv: 'Electronics', camera: 'Electronics', tablet: 'Electronics', ssd: 'Electronics',
    cooker: 'Home & Kitchen', pan: 'Home & Kitchen', bottle: 'Home & Kitchen', kettle: 'Home & Kitchen',
    rice: 'Groceries', atta: 'Groceries', tea: 'Groceries', coffee: 'Groceries', honey: 'Groceries',
    shirt: 'Clothing', jeans: 'Clothing', tshirt: 'Clothing', 't-shirt': 'Clothing', trouser: 'Clothing',
    notebook: 'Stationery', pen: 'Stationery', backpack: 'Stationery',
    book: 'Books', tie: 'Accessories', belt: 'Accessories', watch: 'Accessories', wallet: 'Accessories',  };
  const ACCESSORY_NOUNS = ['backpack', 'bag', 'sleeve', 'stand', 'cover', 'case', 'skin', 'pouch', 'holder', 'strap', 'mouse pad'];
  const kwLower = (effectiveIntent.keywords || []).map((k: any) => String(k).toLowerCase());
  const primaryKw = kwLower[0];
  if (primaryKw && TYPE_CATEGORY[primaryKw] && !kwLower.some((k: string) => ACCESSORY_NOUNS.some((a) => k.includes(a)))) {
    effectiveIntent = { ...effectiveIntent, category: TYPE_CATEGORY[primaryKw] };
  }

  const searchQuery = [effectiveIntent.category, ...(effectiveIntent.keywords || [])]
    .filter((k: any) => k && !CATEGORY_LABELS.has(String(k).toLowerCase()))
    .join(' ');

  await _audit.log({ session_id: sid, actor: 'ai', action: 'catalog_searched', reason: `Search: "${searchQuery}"`, status: 'success', details: { query: searchQuery } });

  let products: any[] = [];
  if (searchQuery || effectiveIntent.category) {
    products = await catalogAgent.searchProducts({ search: searchQuery || undefined, category: effectiveIntent.category, maxPrice: effectiveIntent.budget, inStock: false, limit: 30 });
  }
  if (products.length === 0 && searchQuery) {
    products = await catalogAgent.searchProducts({ search: searchQuery, maxPrice: effectiveIntent.budget, inStock: false, limit: 30 });
  }
  products = products.filter((p: any) => !excludeIds.has(p.id));
  if (opts.alternatives && products.length < 3 && searchQuery) {
    // Relax price constraint so we can surface more alternatives
    const relaxed = await catalogAgent.searchProducts({ search: searchQuery, inStock: false, limit: 30 });
    products = relaxed.filter((p: any) => !excludeIds.has(p.id));
  }
  if (products.length === 0) {
    await _audit.log({ session_id: sid, actor: 'ai', action: 'no_products_found', reason: 'No matches', status: 'blocked', details: { query: searchQuery } });
    const fallbackMessage = await smartFallback(sid, session, rawMsg || searchQuery, effectiveIntent);
    return { message: fallbackMessage, next_action: 'await_input', requires_approval: false };
  }

  await _audit.log({ session_id: sid, actor: 'ai', action: 'products_found', reason: `${products.length} evaluated`, status: 'success', details: { total: products.length } });

  const recommendations: any[] = products.map(p => recommendationAgent.scoreProduct(p, effectiveIntent)).sort((a, b) => b.score - a.score);
  const topRecs = recommendations.slice(0, opts.alternatives ? 8 : 5);

  // For "what other choices?", reply with a numbered list instead of the single-pick approval flow
  if (opts.alternatives) {
    const lines = topRecs.map((r, i) => `${i + 1}. ${r.product_name} — ${formatPrice(r.price)}${r.in_stock ? '' : ' (out of stock)'}`);
    const msg = topRecs.length > 0
      ? `Here are more choices we found for you:\n\n${lines.join('\n')}\n\nWant me to add one to your cart, or look at something else? Remember — 5% OFF + FREE shipping on bundles of 2+ items!`
      : 'It looks like that covers everything we have for that. Want to try a different product or category?';
    await sessionStore.update(sid, { recommendations: topRecs });
    return { message: msg, recommendations: topRecs, next_action: 'await_input', requires_approval: false };
  }

  const topInStock = topRecs.find(r => r.in_stock);
  await auditAgent.logAIAction(sid, null, 'recommendation', { query: searchQuery, budget: effectiveIntent.budget }, { count: topRecs.length, top: topRecs[0] || null }, effectiveIntent.confidence || 0.7, true);

  // Upsell + cross-sell
  let upsell: any = null; let crossSells: any[] = [];
  if (topInStock && effectiveIntent.budget) {
    const primary = await catalogAgent.getProduct(topInStock.product_id);
    if (primary) {
      upsell = await revenueBrain.detectUpsell(primary, effectiveIntent.budget);
      if (upsell) crossSells = await revenueBrain.detectCrossSells(primary, effectiveIntent.budget, [topInStock.product_id]);
    }
  }

  session.recommendations = topRecs; session.upsell = upsell; session.crossSells = crossSells;
  session.cart = topInStock ? [{ product_id: topInStock.product_id, quantity: 1, price: topInStock.price }] : [];
  const cartTotal = session.cart.reduce((s:any,i:any) => s + i.price * i.quantity, 0);
  session.cartTotal = cartTotal;

  const presentableUpsell = (upsell && cartTotal + upsell.price <= (effectiveIntent.budget || Infinity)) ? upsell : null;
  let message = formatRecommendationMessage(topRecs, presentableUpsell, crossSells, effectiveIntent.budget);
  let actionType: any = 'none'; let nextState: any = 'none'; let requiresApproval = false;

  // Bundle offer: 5% OFF + FREE shipping when an accessory is added to the pick
  const bundlePartner = crossSells[0] || null;
  let bundleOffer: any = null;
  if (topInStock && bundlePartner) {
    const subtotal = cartTotal + bundlePartner.price;
    const discount = Math.round(subtotal * 0.05);
    bundleOffer = { items: [topInStock, bundlePartner], subtotal, discount, total: subtotal - discount, free_shipping: true as const };
  }

  if (topInStock) {
    const partnerFitsBudget = !effectiveIntent.budget || cartTotal + (bundlePartner?.price || 0) <= effectiveIntent.budget;
    if (upsell && cartTotal + upsell.price <= (effectiveIntent.budget || Infinity)) {
      message += `\n\n💡 Upsell suggestion: ${upsell.product_name} (${formatPrice(upsell.price)}) provides more value. Upgrade?`;
      nextState = 'upsell_pending'; session.approvalState = 'upsell_pending'; actionType = 'upsell';
    } else if (bundlePartner && partnerFitsBudget) {
      message += `\n\n🎁 Buy together & save 5%! Add ${bundlePartner.product_name} (+${formatPrice(bundlePartner.price)}) and get 5% OFF (−${formatPrice(bundleOffer!.discount)}) + FREE shipping. Bundle total: ${formatPrice(bundleOffer!.total)} (was ${formatPrice(bundleOffer!.subtotal)}).\nShall I add it to your cart?`;
      nextState = 'crosssell_pending'; session.approvalState = 'crosssell_pending'; actionType = 'cross_sell';
    } else if (bundlePartner) {
      message += `\n\nThe ${bundlePartner.product_name} (${formatPrice(bundlePartner.price)}) pairs perfectly with your pick. With 5% OFF + FREE shipping the bundle would be ${formatPrice(bundleOffer!.total)}, but that crosses your budget of ${formatPrice(effectiveIntent.budget)}. Increase budget to grab the deal?`;
      nextState = 'await_budget'; session.approvalState = 'await_budget';
    } else {
      message += `\n\n${formatApprovalMessage(cartTotal)}`;
      nextState = 'await_payment_approval'; session.approvalState = 'await_payment_approval'; actionType = 'payment'; requiresApproval = true;
    }
  } else {
    message = `⚠️ Top matches are out of stock. I found ${topRecs.length} similar alternatives.`;
    nextState = 'await_alternatives';
  }

  await sessionStore.update(sid, { intent: effectiveIntent, recommendations: topRecs, upsell, crossSells });
  return { message, recommendations: topRecs, upsell: upsell||undefined, cross_sells: crossSells, cart_total: cartTotal, budget: effectiveIntent.budget, next_action: nextState, requires_approval: requiresApproval, action_type: actionType, bundle_offer: bundleOffer || undefined };
}
