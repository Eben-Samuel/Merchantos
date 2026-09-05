import { getDb } from '../config/database';
import { catalogAgent } from './catalogSearch';
import { formatPrice } from './formatters';

/** Analytics — revenue, conversion, AOV, and chart data for merchant dashboard. */
export class Analytics {
  formatPrice = formatPrice;

  async getMetrics(): Promise<any> {
    const db = await getDb();
    const tr = await db.get(`SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE status='paid'`);
    const ai = await db.get(`SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE status='paid' AND is_ai_assisted=1`);
    const up = await db.get(`SELECT COALESCE(SUM(amount),0) as v FROM revenue_events WHERE revenue_type='upsell'`);
    const cs = await db.get(`SELECT COALESCE(SUM(amount),0) as v FROM revenue_events WHERE revenue_type='cross_sell'`);
    const ot = await db.get(`SELECT COUNT(*) as v FROM orders WHERE status='paid'`);
    const ab = await db.get(`SELECT COUNT(*) as v FROM abandoned_carts WHERE recovery_sent=0`);
    const ts = await db.get(`SELECT COUNT(*) as v FROM sessions`);
    const tp = await db.get(`SELECT COUNT(*) as v FROM payments`);
    const tc = await db.get(`SELECT COUNT(*) as v FROM payments WHERE status='captured'`);
    const totalRev = tr.v, aiRev = ai.v, totalOrders = ot.v;
    const aov = totalOrders > 0 ? totalRev / totalOrders : 0;
    const conv = ts.v > 0 ? (totalOrders / ts.v) * 100 : 0;
    const psr = tp.v > 0 ? (tc.v / tp.v) * 100 : 0;

    const daily = await db.all(`SELECT date(created_at) as d, SUM(total_amount) as revenue, SUM(CASE WHEN is_ai_assisted=1 THEN total_amount ELSE 0 END) as ai_rev FROM orders WHERE status='paid' GROUP BY date(created_at) ORDER BY d DESC LIMIT 7`);

    const perf = await db.all(`SELECT p.name, p.category, SUM(oi.quantity) as sold, SUM(oi.price*oi.quantity) as rev FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN orders o ON oi.order_id=o.id WHERE o.status='paid' GROUP BY p.id ORDER BY rev DESC LIMIT 8`);

    const actions = await db.all(`SELECT status, COUNT(*) as cnt FROM audit_events WHERE actor='ai' GROUP BY status`);

    return {
      total_revenue: totalRev, ai_assisted_revenue: aiRev,
      ai_assisted_revenue_pct: totalRev > 0 ? (aiRev / totalRev) * 100 : 0,
      upsell_revenue: up.v, cross_sell_revenue: cs.v,
      average_order_value: Math.round(aov), conversion_rate: Number(conv.toFixed(1)),
      total_orders: totalOrders, abandoned_carts: ab.v,
      payment_success_rate: Number(psr.toFixed(1)),
      daily_revenue: daily.map(d => ({ date: d.d, revenue: d.revenue, ai_revenue: d.ai_rev || 0 })),
      product_performance: perf.map(p => ({ name: p.name, category: p.category, sold: p.sold, revenue: p.rev })),
      ai_action_stats: actions.reduce((acc:any,s:any) => { acc[s.status] = s.cnt; return acc; }, {}),
    };
  }
}

export const analytics = new Analytics();
