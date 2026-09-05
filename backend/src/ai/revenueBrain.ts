import { Product, Recommendation, IntentResult } from '../types';
import { catalogAgent } from './catalogSearch';
import { recommendationAgent } from './recommendationEngine';

/**
 * RevenueBrain — Identifies upsell, cross-sell, and bundle opportunities.
 * Considers budget, compatibility, inventory, and merchant rules.
 */
export class RevenueBrain {
  /** Detect upsell: premium alternative providing more value within budget multiplier */
  async detectUpsell(primary: Product, budget?: number): Promise<Recommendation | null> {
    return recommendationAgent.findUpsell(primary, budget);
  }

  /** Detect cross-sell: complementary products frequently bought together */
  async detectCrossSells(primary: Product, budget?: number, excludeIds: string[] = []): Promise<Recommendation[]> {
    return recommendationAgent.findCrossSells(primary, budget, excludeIds);
  }

  /** Create a dynamic bundle: primary + cross-sells within budget */
  async createBundle(primary: Product, intent: IntentResult, crossSells: Recommendation[]): Promise<{ items: Recommendation[]; total: number; reason: string }> {
    const budget = intent.budget || Infinity;
    const bundleItems: Recommendation[] = [{
      product_id: primary.id, product_name: primary.name,
      price: Math.round(primary.price * (1 - (primary.discount_percent || 0) / 100)),
      score: 90, reason: 'Primary recommendation', type: 'primary', matched_attributes: ['primary'], in_stock: primary.stock > 0,
    }];
    let total = bundleItems[0].price;

    for (const cs of crossSells.slice(0, 2)) { // max 2 cross-sells per policy
      if (total + cs.price <= budget) {
        bundleItems.push(cs);
        total += cs.price;
      }
    }

    return {
      items: bundleItems,
      total,
      reason: `Bundle of ${bundleItems.map(i => i.product_name).join(' + ')} — total within budget of ₹${budget}`,
    };
  }

  /** Detect abandoned cart recovery opportunities */
  async detectAbandonedCartOpportunity(sessionId: string): Promise<{ reason: string; suggestion: string } | null> {
    // This would query abandoned_carts table — for demo, returns a synthetic opportunity
    return null;
  }

  /** Identify revenue opportunity for dashboard */
  async identifyRevenueOpportunity(db: any): Promise<{ title: string; description: string; estimated_min: number; estimated_max: number; action: string } | null> {
    // Find products with high search volume but low conversion (simulated from intent_trends)
    const recentSearches = await db.all(
      `SELECT category, COUNT(*) as cnt FROM intent_trends WHERE created_at > datetime('now', '-7 days') GROUP BY category ORDER BY cnt DESC LIMIT 3`
    );
    if (recentSearches.length > 0) {
      const top = recentSearches[0];
      const products = await catalogAgent.searchProducts({ category: top.category, limit: 5 });
      if (products.length > 0) {
        const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length;
        const estMin = Math.round(avgPrice * top.cnt * 0.3);
        const estMax = Math.round(avgPrice * top.cnt * 0.5);
        return {
          title: `High demand for ${top.category}`,
          description: `${top.cnt} customers searched for ${top.category} this week. AI suggests creating a targeted bundle.`,
          estimated_min: estMin,
          estimated_max: estMax,
          action: `Create a ${Math.round(avgPrice)}-rupee ${top.category.toLowerCase()} bundle with complementary accessories.`,
        };
      }
    }
    return null;
  }
}

export const revenueBrain = new RevenueBrain();



