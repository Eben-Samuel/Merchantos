import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Heart, Wifi, Server, Package } from 'lucide-react';

export function HealthCheck() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>('/health');
      setHealth(data);
    } catch (err: any) {
      setHealth({ status: 'error', error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkHealth(); }, []);

  if (loading) return <div className="text-center py-12">Checking server health...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold">System Health</h2>
      <div className="space-y-4">
        <div className={`p-4 rounded-lg border ${health?.status === 'ok' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-center gap-3">
            <Wifi className={`w-5 h-5 ${health?.status === 'ok' ? 'text-green-400' : 'text-red-400'}`} />
            <div>
              <h3 className="font-semibold">{health?.status === 'ok' ? 'All Systems Operational' : 'System Error'}</h3>
              <p className="text-sm text-muted-foreground">
                {health?.status === 'ok'
                  ? `Service: ${health.service || 'MERCHANTOS AI'} • Updated: ${health.timestamp}`
                  : `Error: ${health?.error || 'Unknown'}`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Server className="w-4 h-4" /> API Endpoints</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2"><Heart className="w-3 h-3 text-green-400" /> /api/health</div>
            <div className="flex items-center gap-2"><Package className="w-3 h-3 text-blue-400" /> /api/catalog/products</div>
            <div className="flex items-center gap-2"><Package className="w-3 h-3 text-purple-400" /> /api/order</div>
            <div className="flex items-center gap-2"><Package className="w-3 h-3 text-amber-400" /> /api/analytics</div>
            <div className="flex items-center gap-2"><Package className="w-3 h-3 text-cyan-400" /> /api/chat</div>
            <div className="flex items-center gap-2"><Package className="w-3 h-3 text-red-400" /> /api/payment</div>
          </div>
        </div>
      </div>
    </div>
  );
}
