import { getDb } from '../config/database';
import { catalogAgent } from './catalogSearch';

export class BusinessMetrics {
  async getAIReadinessScore(): Promise<any> {
    const db = await getDb();
    const products: any[] = await db.all('SELECT * FROM products WHERE is_active = 1');
    const total = products.length;
    if (total === 0) return { overall: 0, breakdown: [], improvements: [], total_products: 0 };
    const desc = products.filter(p => (p.description||'').length > 50).length/total*100;
    const attr = products.filter(p => { try { return Object.keys(JSON.parse(p.attributes_json||'{}')).length >= 3; } catch { return false; } }).length/total*100;
    const price = products.filter(p => p.price > 0).length/total*100;
    const inv = products.filter(p => p.stock >= 0).length/total*100;
    const rel = products.filter(p => (p.compatible_products?.length>0||p.frequently_bought_together?.length>0)).length/total*100;
    const rules = products.filter(p => p.merchant_rule_json && p.merchant_rule_json !== '{}').length/total*100;
    const tags = products.filter(p => (p.tags||'').split(',').length >= 3).length/total*100;
    const aiAvg = products.reduce((s:number,p:any) => s+(p.ai_readiness_score||0),0)/total;
    const overall = Math.round((desc+attr+price+inv+rel+rules+tags)/7);
    const sug: string[] = [];
    if (desc < 85) sug.push('Enrich product descriptions');
    if (attr < 85) sug.push('Add more product attributes');
    if (rel < 85) sug.push('Define compatible/frequently bought products');
    if (tags < 85) sug.push('Add more descriptive tags');
    if (sug.length === 0) sug.push('Catalog is well-optimized for AI buyers');
    return { overall, ai_readiness_avg: Math.round(aiAvg), breakdown: [
      { component:'Product descriptions', score:Math.round(desc), weight:20 },
      { component:'Product attributes', score:Math.round(attr), weight:15 },
      { component:'Pricing clarity', score:Math.round(price), weight:15 },
      { component:'Inventory freshness', score:Math.round(inv), weight:15 },
      { component:'Related products', score:Math.round(rel), weight:15 },
      { component:'Purchase rules', score:Math.round(rules), weight:10 },
      { component:'Tags for AI', score:Math.round(tags), weight:10 },
    ], improvements: sug, total_products: total };
  }

  async getRevenueOpportunities(): Promise<any[]> {
    const db = await getDb(); const opps: any[] = [];
    const sd = await db.all(`SELECT category, COUNT(*) as cnt FROM intent_trends WHERE created_at > datetime('now','-7 days') GROUP BY category ORDER BY cnt DESC LIMIT 3`);
    for (const item of sd) {
      const products = await catalogAgent.searchProducts({ category: item.category, limit: 10 });
      if (products.length > 0) {
        const avgPrice = products.reduce((s,p) => s+p.price, 0) / products.length;
        opps.push({ id:`opp_${item.category}`, title:`High demand for ${item.category}`, description:`${item.cnt} searches this week. Create a targeted bundle.`, estimated_min:Math.round(avgPrice*item.cnt*0.2), estimated_max:Math.round(avgPrice*item.cnt*0.4), action:`Bundle ${item.category} with accessories.`, confidence:'Medium', is_estimate:true });
      }
    }
    const ls = await db.all(`SELECT name, stock FROM products WHERE stock>0 AND stock<=5 LIMIT 3`);
    for (const p of ls) opps.push({ id:`opp_s_${p.name}`, title:`Low stock: ${p.name}`, description:`Only ${p.stock} left.`, estimated_min:0, estimated_max:Math.round(p.stock*1), action:`Restock ${p.name}.`, confidence:'High', is_estimate:false });
    const oos = await db.all(`SELECT name, ai_readiness_score FROM products WHERE stock=0 AND ai_readiness_score>85 LIMIT 3`);
    for (const p of oos) opps.push({ id:`opp_o_${p.name}`, title:`Out of stock: ${p.name}`, description:`High-readiness product unavailable.`, estimated_min:0, estimated_max:5000, action:`Restock immediately.`, confidence:'High', is_estimate:false });
    return opps;
  }

  async getABTestMetrics(): Promise<any> {
    return { control_conversion: 5.8, ai_conversion: 8.1, improvement: 39.7, is_simulated: true, disclaimer: 'Demo / Synthetic Data', total_visitors: 1250, ai_assisted_visitors: 625, control_orders: 73, ai_orders: 51 };
  }

  async getRevenueSimulator(params:{upsellRate:number;crossSellRate:number;conversionRate:number;aov:number}): Promise<any> {
    const db = await import('../config/database').then(m => m.getDb());
    const rev = await db.get(`SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE status='paid'`);
    const vrow = await db.get(`SELECT COUNT(*) as v FROM sessions`);
    const v = vrow.v || 100;
    const projected = v * (params.conversionRate/100) * params.aov;
    return { current_revenue: Math.round(rev.v), projected_revenue: Math.round(projected), additional_revenue: Math.round(projected - rev.v), is_forecast: true, disclaimer: 'Estimates based on current data.' };
  }

  async getIntentionMap(): Promise<any> {
    const db = await getDb();
    const categories = await db.all(`SELECT category, COUNT(*) as cnt FROM intent_trends GROUP BY category ORDER BY cnt DESC`);
    return { intent_trends: categories };
  }
}

export const businessIntelligence = new BusinessMetrics();
