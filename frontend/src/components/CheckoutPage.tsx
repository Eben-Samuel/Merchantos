import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, useAuth } from '../App';
import { api } from '../api/client';
import {
  MapPin, CreditCard, Banknote, Smartphone, Landmark, Package,
  CheckCircle2, ArrowRight, ShieldCheck, Truck, Sparkles, ChevronLeft,
} from 'lucide-react';

interface Accessory {
  id: string; name: string; price: number; original_price: number;
  discount_percent: number; emoji: string; stock: number; reason: string;
}

const PAYMENTS = [
  { id: 'UPI', icon: Smartphone, desc: 'GPay, PhonePe, Paytm - instant' },
  { id: 'Card', icon: CreditCard, desc: 'Credit / Debit cards, EMI' },
  { id: 'NetBanking', icon: Landmark, desc: 'All major Indian banks' },
  { id: 'COD', icon: Banknote, desc: 'Cash on delivery - pay at doorstep' },
];

export function CheckoutPage() {
  const { items, total, itemCount, clearCart, addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ order_id: string; total: number } | null>(null);
  const [payment, setPayment] = useState('UPI');
  const [address, setAddress] = useState({
    name: user?.name || '', phone: '98765 43210', pincode: '560001',
    line: '42, MG Road, 8th Cross', city: 'Bengaluru', state: 'Karnataka',
  });
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(() => {
    try { const c = JSON.parse(localStorage.getItem('merchantos_coupon') || 'null'); return c?.code ? c : null; } catch { return null; }
  });

  const bundleDiscount = itemCount >= 2 ? Math.round(total * 0.05) : 0;
  const couponDiscount = coupon ? Math.round((total * coupon.percent) / 100) : 0;
  const shipping = total - bundleDiscount >= 499 || itemCount >= 2 ? 0 : 40;
  const grandTotal = Math.max(0, total - bundleDiscount - couponDiscount + shipping);
  const savings = bundleDiscount + couponDiscount;
  const eta = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const formatINR = (n: number) => `\u20B9${n.toLocaleString('en-IN')}`;
  const imageUrl = (id: string) => `/api/catalog/image/${id}.svg?v=2`;

  useEffect(() => {
    if (items.length === 0) return;
    api.post<{ accessories: Accessory[] }>('/catalog/accessories', { ids: items.map((i) => i.product_id) })
      .then((d) => setAccessories((d.accessories || []).filter((a) => !items.some((i) => i.product_id === a.id)).slice(0, 4)))
      .catch(() => setAccessories([]));
  }, [items.length]);

  if (items.length === 0 && !placed) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">Add some products before checking out.</p>
        <Link to="/" className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90">Start shopping</Link>
      </div>
    );
  }

  const placeOrder = async () => {
    if (placing) return;
    setPlacing(true);
    try {
      const res = await api.post<{ success: boolean; order_id: string }>('/order', {
        customer_name: address.name || user?.name || 'Guest Customer',
        payment_method: payment,
        items: items.map((i) => ({ product_id: i.product_id, name: i.name, price: i.price, quantity: i.quantity })),
      });
      window.dispatchEvent(new CustomEvent('merchantos:order', { detail: { amount: grandTotal } }));
      localStorage.removeItem('merchantos_coupon');
      clearCart();
      setPlaced({ order_id: res.order_id, total: grandTotal });
      window.scrollTo({ top: 0 });
    } catch {
      alert('Could not place the order. Please try again.');
    } finally { setPlacing(false); }
  };
  if (placed) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-black mb-2">Order confirmed!</h1>
        <p className="text-muted-foreground mb-1">Order <span className="font-bold text-foreground">{placed.order_id}</span> for {formatINR(placed.total)}</p>
        <p className="text-sm text-muted-foreground mb-6">Arriving by <span className="font-semibold text-foreground">{eta}</span> · Payment: {payment}</p>
        <div className="bg-card border border-border rounded-2xl p-4 text-sm text-left mb-6">
          <p className="font-semibold mb-1 flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Track your order</p>
          <p className="text-muted-foreground">Live tracking is available in Order History. You also earned loyalty points on this purchase.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate('/orders')} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90">View my orders</button>
          <button onClick={() => navigate('/')} className="px-6 py-3 border border-border rounded-xl font-semibold hover:bg-muted">Keep shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <button onClick={() => navigate('/cart')} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-4"><ChevronLeft className="w-4 h-4" /> Back to cart</button>
      <h1 className="text-2xl font-black mb-6">Checkout</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold flex items-center gap-2 mb-4"><MapPin className="w-5 h-5 text-primary" /> Delivery address</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {([['name', 'Full name'], ['phone', 'Phone'], ['pincode', 'Pincode'], ['city', 'City'], ['state', 'State']] as const).map(([k, label]) => (
                <label key={k} className="text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <input value={(address as any)[k]} onChange={(e) => setAddress({ ...address, [k]: e.target.value })}
                    className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </label>
              ))}
              <label className="text-xs sm:col-span-2">
                <span className="text-muted-foreground">Address line</span>
                <input value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </label>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold flex items-center gap-2 mb-4"><CreditCard className="w-5 h-5 text-primary" /> Payment method</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {PAYMENTS.map((p) => (
                <button key={p.id} onClick={() => setPayment(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${payment === p.id ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border hover:bg-muted/50'}`}>
                  <p.icon className={`w-5 h-5 ${payment === p.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div><p className="text-sm font-semibold">{p.id}</p><p className="text-[11px] text-muted-foreground">{p.desc}</p></div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Payments are simulated in test mode - no real money is charged.</p>
          </section>
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold flex items-center gap-2 mb-4"><Package className="w-5 h-5 text-primary" /> Review items ({itemCount})</h2>
            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.product_id} className="flex items-center gap-3">
                  <img src={imageUrl(i.product_id)} alt={i.name} className="w-14 h-14 rounded-lg object-cover bg-muted/50" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium line-clamp-1">{i.name}</p><p className="text-xs text-muted-foreground">Qty {i.quantity}</p></div>
                  <p className="font-bold text-sm">{formatINR(i.price * i.quantity)}</p>
                </div>
              ))}
            </div>
          </section>

          {accessories.length > 0 && (
            <section className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-bold flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-amber-400" /> Frequently bought together</h2>
              <p className="text-xs text-muted-foreground mb-4">Add any of these and get 5% OFF + FREE shipping on the bundle.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {accessories.map((a) => {
                  const added = addedIds.has(a.id);
                  return (
                    <div key={a.id} className="flex gap-3 items-center p-3 border border-border rounded-xl">
                      <img src={imageUrl(a.id)} alt={a.name} className="w-14 h-14 rounded-lg object-cover bg-muted/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{a.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{a.reason}</p>
                        <p className="font-bold text-primary text-sm mt-0.5">{formatINR(a.price)}</p>
                      </div>
                      <button onClick={() => { addToCart({ product_id: a.id, name: a.name, price: a.price, quantity: 1, emoji: a.emoji || '\uD83D\uDCE6' }); setAddedIds((prev) => new Set(prev).add(a.id)); }}
                        disabled={added || a.stock <= 0}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${added ? 'bg-green-500/20 text-green-500' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                        {added ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 h-fit">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">Price details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Items ({itemCount})</span><span>{formatINR(total)}</span></div>
              {bundleDiscount > 0 && <div className="flex justify-between text-green-500"><span>Bundle discount (5%)</span><span>-{formatINR(bundleDiscount)}</span></div>}
              {couponDiscount > 0 && <div className="flex justify-between text-green-500"><span>Coupon {coupon?.code}</span><span>-{formatINR(couponDiscount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{shipping === 0 ? <span className="text-green-500 font-semibold">FREE</span> : formatINR(shipping)}</span></div>
              <div className="border-t border-border my-2" />
              <div className="flex justify-between text-lg font-black"><span>Total payable</span><span className="text-primary">{formatINR(grandTotal)}</span></div>
              {savings > 0 && <p className="text-xs text-green-500 font-semibold">You save {formatINR(savings)} on this order</p>}
            </div>
            <button onClick={placeOrder} disabled={placing || itemCount === 0}
              className="mt-5 w-full py-3.5 bg-amber-500 text-black rounded-xl font-bold hover:bg-amber-400 disabled:opacity-60 flex items-center justify-center gap-2">
              {placing ? 'Placing order…' : <>Place order <ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">Safe and secure payments · Easy returns</p>
          </div>
        </aside>
      </div>
    </div>
  );
}