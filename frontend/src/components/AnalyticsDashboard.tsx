import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Package, TrendingUp, ShoppingCart, Users, DollarSign, BarChart3 } from 'lucide-react';

interface AnalyticsMetrics {
  total_revenue: number;
  ai_assisted_revenue: number;
  ai_assisted_revenue_pct: number;
  upsell_revenue: number;
  cross_sell_revenue: number;
  average_order_value: number;
  conversion_rate: number;
  total_orders: number;
  abandoned_carts: number;
  payment_success_rate: number;
  daily_revenue: Array<{ date: string; revenue: number; ai_revenue: number }>;
  product_performance: Array<{ name: string; category: string; sold: number; revenue: number }>;
  ai_action_stats: Record<string, number>;
}

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AnalyticsMetrics>('/analytics/').then(setMetrics).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>;
  if (!metrics) return <div className="text-center py-12 text-destructive">Failed to load analytics</div>;

  const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const statCards = [
    { label: 'Total Revenue', value: formatINR(metrics.total_revenue), icon: DollarSign, color: 'text-green-400' },
    { label: 'AOV', value: formatINR(metrics.average_order_value), icon: ShoppingCart, color: 'text-blue-400' },
    { label: 'Total Orders', value: metrics.total_orders.toString(), icon: Package, color: 'text-purple-400' },
    { label: 'AI Revenue %', value: `${metrics.ai_assisted_revenue_pct.toFixed(1)}%`, icon: TrendingUp, color: 'text-amber-400' },
    { label: 'Conversion', value: `${metrics.conversion_rate.toFixed(1)}%`, icon: Users, color: 'text-cyan-400' },
    { label: 'Abandoned', value: metrics.abandoned_carts.toString(), icon: BarChart3, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-lg p-4 text-center">
            <div className={`w-8 h-8 mx-auto mb-2 ${card.color}`}><card.icon className="w-6 h-6 mx-auto" /></div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-3">AI Action Stats</h3>
          <div className="space-y-2">
            {Object.entries(metrics.ai_action_stats).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-sm text-muted-foreground capitalize">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Revenue Breakdown</h3>
          <div className="space-y-2">
            <div className="flex justify-between"><span>AI-Assisted</span><span className="text-green-400">{formatINR(metrics.ai_assisted_revenue)}</span></div>
            <div className="flex justify-between"><span>Upsell</span><span className="text-amber-400">{formatINR(metrics.upsell_revenue)}</span></div>
            <div className="flex justify-between"><span>Cross-Sell</span><span className="text-cyan-400">{formatINR(metrics.cross_sell_revenue)}</span></div>
            <div className="flex justify-between text-sm text-muted-foreground"><span>Success Rate</span><span>{metrics.payment_success_rate.toFixed(1)}%</span></div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Top Products by Revenue</h3>
        <div className="space-y-2">
          {metrics.product_performance.map((p, i) => (
            <div key={p.name} className="flex justify-between items-center">
              <span className="text-sm">{p.name} <span className="text-xs text-muted-foreground">({p.category})</span></span>
              <span className="font-medium">{formatINR(p.revenue)} • {p.sold} sold</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
