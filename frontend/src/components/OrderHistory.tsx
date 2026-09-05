import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Package, ChevronRight } from 'lucide-react';

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  variant_id?: string;
  item_type: string;
}

interface Payment {
  id: string;
  order_id: string;
  razorpay_payment_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
}

interface Order {
  id: string;
  session_id: string;
  customer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  is_ai_assisted: number;
  upsell_applied: number;
  cross_sell_applied: number;
  ai_confidence: number;
  created_at: string;
  items?: OrderItem[];
  payment?: Payment;
}

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    api.get<{ orders: Order[]; count: number }>('/order')
      .then((data) => setOrders(data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  if (loading) return <div className="text-center py-12">Loading orders...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Order History</h2>
      <p className="text-sm text-muted-foreground">{orders.length} orders total</p>

      <div className="grid gap-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">Order #{order.id}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString('en-IN', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </p>
                {order.customer_name && <p className="text-sm">{order.customer_name}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatINR(order.total_amount)}</p>
                <span className={`text-xs px-2 py-1 rounded ${
                  order.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                  order.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>

            {order.is_ai_assisted && (
              <div className="mt-2 text-xs text-muted-foreground">
                AI-assisted • Confidence: {(order.ai_confidence * 100).toFixed(0)}%
                {order.upsell_applied && ' • Upsell applied'}
                {order.cross_sell_applied && ' • Cross-sell applied'}
              </div>
            )}

            <button
              onClick={() => setSelectedOrder(order)}
              className="mt-3 text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            >
              View details <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Order #{selectedOrder.id}</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Items</h4>
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-border/50">
                    <span>{item.product_name} × {item.quantity}</span>
                    <span>{formatINR(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium mb-2">Payment</h4>
                <p>Amount: {formatINR(selectedOrder.total_amount)}</p>
                <p>Status: <span className="text-green-400">{selectedOrder.payment?.status || selectedOrder.status}</span></p>
                <p>Method: {selectedOrder.payment?.method || 'N/A'}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className="mt-4 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
