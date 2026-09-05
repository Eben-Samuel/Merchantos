import { Product, IntentResult, Recommendation } from '../types';
import { catalogAgent } from './catalogSearch';

/** RecommendationAgent — Scores and ranks products based on intent, budget, stock. */
export class RecommendationAgent {
  async recommend(intent: IntentResult, opts: { limit?: number; includeOOS?: boolean } = {}): Promise<Recommendation[]> {
    const searchQuery = this.buildSearchQuery(intent);
    let products: Product[] = [];
    if (searchQuery || intent.category) {
      products = await catalogAgent.searchProducts({ search: searchQuery || intent.category, category: intent.category, maxPrice: intent.budget, inStock: !opts.includeOOS, limit: opts.limit || 20 });
    }
    if (products.length === 0 && searchQuery) {
      products = await catalogAgent.searchProducts({ search: searchQuery, maxPrice: intent.budget, inStock: !opts.includeOOS, limit: opts.limit || 20 });
    }
    return products.map(p => this.scoreProduct(p, intent)).sort((a, b) => b.score - a.score).slice(0, opts.limit || 10);
  }

  async findUpsell(original: Product, budget?: number): Promise<Recommendation | null> {
    const maxPrice = budget ? Math.min(budget, original.price * 1.5) : original.price * 1.5;
    const alternatives = await catalogAgent.searchProducts({ category: original.category, maxPrice, inStock: true, limit: 20 });
    const upsell = alternatives.filter(p => p.id !== original.id && p.price > original.price + 100)
      .map(p => this.scoreProduct(p, { keywords: [], confidence: 0.5, use_cases: [], category: original.category, budget: maxPrice }))
      .sort((a, b) => b.score - a.score);
    if (upsell.length > 0) {
      const top = upsell[0];
      return { ...top, type: 'upsell', reason: `Premium alternative to ${original.name}`, matched_attributes: ['same-category', 'higher-value'] };
    }
    return null;
  }

  async findCrossSells(primary: Product, budget?: number, excludeIds: string[] = []): Promise<Recommendation[]> {
    const fbt = await catalogAgent.getFrequentlyBoughtTogether(primary.id);
    const compatible = await catalogAgent.getCompatibleProducts(primary.id);
    // Dedupe candidates (same product can appear in both fbt and compatible lists)
    const seen = new Set<string>([primary.id, ...excludeIds]);
    const candidates = [...fbt, ...compatible].filter(p => {
      if (seen.has(p.id) || p.stock <= 0) return false;
      seen.add(p.id); return true;
    });
    return candidates.filter(p => !budget || (primary.price + p.price) <= budget)
      .map(p => {
        const rec = this.scoreProduct(p, { keywords: [], confidence: 0.5, use_cases: [], category: p.category, budget });
        return { ...rec, type: 'cross-sell' as const };
      });
  }

  private buildSearchQuery(intent: IntentResult): string {
    const parts = [...(intent.keywords || [])];
    if (intent.recipient) parts.push(intent.recipient);
    if (intent.color) parts.push(intent.color);
    if (intent.use_cases?.length) parts.push(...intent.use_cases);
    return parts.join(' ');
  }

  scoreProduct(product: Product, intent: IntentResult): Recommendation {
    let score = 0; const reasons: string[] = []; const matched: string[] = [];

    if (intent.category && product.category === intent.category) { score += 20; reasons.push('✓ Matches your requested category'); matched.push('category'); }
    else if (!intent.category) { score += 10; matched.push('category-any'); }

    if (intent.keywords.length > 0) {
      const searchable = [product.name, product.description, product.tags, product.target_use_cases, product.customer_segments].join(' ').toLowerCase();
      const matchedKws = intent.keywords.filter(kw => searchable.includes(kw));
      // Count-based scoring: each distinct matched keyword adds weight (cap 30)
      const kwScore = Math.min(30, matchedKws.length * 8); score += kwScore;
      // Primary product-type bonus: the first keyword is the item type (e.g. "laptop")
      if (matchedKws.includes(intent.keywords[0])) { score += 5; matched.push('primary-type'); }
      if (kwScore > 0) { matched.push('keywords'); reasons.push(`✓ Relevant keywords matched (${matchedKws.length}/${intent.keywords.length})`); }
    }

    // Core-type alignment: demote items from other aisles when the primary keyword is a known product type
    const TYPE_CATEGORY: Record<string, string> = {
laptop: 'Electronics', phone: 'Electronics', smartphone: 'Electronics', earbuds: 'Electronics',
      headphones: 'Electronics', headset: 'Electronics', mouse: 'Electronics', keyboard: 'Electronics',
      monitor: 'Electronics', tv: 'Electronics', camera: 'Electronics', tablet: 'Electronics', ssd: 'Electronics',
      cooker: 'Home & Kitchen', pan: 'Home & Kitchen', bottle: 'Home & Kitchen', kettle: 'Home & Kitchen',
      rice: 'Groceries', atta: 'Groceries', tea: 'Groceries', coffee: 'Groceries', honey: 'Groceries',
      shirt: 'Clothing', jeans: 'Clothing', tshirt: 'Clothing', 't-shirt': 'Clothing', trouser: 'Clothing',
      notebook: 'Stationery', pen: 'Stationery', backpack: 'Stationery',
      book: 'Books', tie: 'Accessories', belt: 'Accessories', watch: 'Accessories', wallet: 'Accessories',    };
    const primaryType = (intent.keywords || [])[0];
    if (primaryType) {
      const expected = TYPE_CATEGORY[String(primaryType).toLowerCase().trim()];
      if (expected) {
        const ACCESSORY_NOUNS = ['backpack', 'bag', 'sleeve', 'stand', 'cover', 'case', 'skin', 'pouch', 'holder', 'strap', 'mouse pad'];
        const nameL = String(product.name || '').toLowerCase();
        if (product.category !== expected) { score -= 35; matched.push('wrong-aisle'); }
        else if (ACCESSORY_NOUNS.some((a) => nameL.includes(a))) { score -= 12; matched.push('accessory-demoted'); }
      }
    }

    // Spec-aware bonus (e.g. requested 1TB storage, dedicated graphics, 16GB RAM, 144Hz)
    if (intent.specs && Object.keys(intent.specs).length > 0) {
      const attrs: Record<string, any> = (product as any).attributes || {};
      const hay = [product.name, product.description, product.tags, ...Object.values(attrs)]
        .filter(Boolean).join(' ').toLowerCase();
      let specMatches = 0; const matchedParts: string[] = [];
      const has = (v: string) => hay.includes(v.toLowerCase());
      if (intent.specs.storage && has(intent.specs.storage)) { specMatches++; matchedParts.push(intent.specs.storage); }
      if (intent.specs.ram && has(intent.specs.ram)) { specMatches++; matchedParts.push(`${intent.specs.ram} RAM`); }
      if (intent.specs.screen && intent.specs.screen !== 'any' && has(intent.specs.screen)) { specMatches++; matchedParts.push(`${intent.specs.screen} screen`); }
      if (intent.specs.refresh && has(intent.specs.refresh)) { specMatches++; matchedParts.push(`${intent.specs.refresh} display`); }
      if (intent.specs.gpu === 'dedicated' && /\b(rtx|gtx|graphics|gpu|nvidia|amd)\b/.test(hay)) { specMatches++; matchedParts.push('dedicated graphics'); }
      if (intent.specs.wireless && /\b(wireless|bluetooth)\b/.test(hay)) { specMatches++; matchedParts.push('wireless'); }
      if (specMatches > 0) { score += specMatches * 8; matched.push('specs'); reasons.push(`✓ Specs matched: ${matchedParts.join(' + ')}`); }
    }

    if (intent.use_cases && intent.use_cases.length > 0) {
      const matchedUC = intent.use_cases.filter(uc => (product.target_use_cases || '').includes(uc));
      if (matchedUC.length > 0) { score += Math.min(15, matchedUC.length * 7); matched.push('use-case'); reasons.push(`✓ Relevant to: ${matchedUC.join(', ')}`); }
    }

    if (intent.budget) {
      if (product.price <= intent.budget) { score += 15; reasons.push('✓ Within your budget'); matched.push('budget-fit'); }
      else { score -= 10; reasons.push('✗ Exceeds your budget'); matched.push('budget-exceeded'); }
    } else { score += 5; }

    if (product.stock > 0) { score += 10; reasons.push('✓ Currently in stock'); matched.push('in-stock'); }
    else { score -= 20; reasons.push('✗ Currently unavailable'); matched.push('out-of-stock'); }

    score += (product.ai_readiness_score || 50) / 10;
    if (product.price > (intent.budget || Infinity) * 0.8 && intent.budget) score -= 2;

    const dp = Math.round(product.price * (1 - (product.discount_percent || 0) / 100));
    return { product_id: product.id, product_name: product.name, price: dp, score: Math.max(0, Math.round(score)), reason: reasons.join(' ').substring(0, 300), type: 'primary', matched_attributes: matched, in_stock: product.stock > 0 };
  }
}

export const recommendationAgent = new RecommendationAgent();
