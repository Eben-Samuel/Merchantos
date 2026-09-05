import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../App';
import { api } from '../api/client';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Truck, Shield, X, Sparkles, Check } from 'lucide-react';

interface Accessory {
  id: string;
  name: string;
  category: string;
  price: number;
  original_price: number;
  discount_percent: number;
  emoji: string;
  stock: number;
  reason: string;
  in_stock: boolean;
}

export function CartPage() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, addToCart, total, itemCount } = useCart();
  const [showRecs, setShowRecs] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(() => {
    try { const c = JSON.parse(localStorage.getItem('merchantos_coupon') || 'null'); return c?.code ? c : null; } catch { return null; }
  });
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const shipping = total >= 499 || itemCount >= 2 ? 0 : 40;
  const bundleDiscount = itemCount >= 2 ? Math.round(total * 0.05) : 0;
  const couponDiscount = coupon ? Math.round(total * coupon.percent / 100) : 0;
  const grandTotal = Math.max(0, total - bundleDiscount - couponDiscount + shipping);
  const imageUrl = (id: string) => `/api/catalog/image/${id}.svg?v=2`;

  const applyCoupon = async (codeStr?: string) => {
    const c = (codeStr || couponInput).trim().toUpperCase();
    if (!c) return;
    try {
      const data = await api.get<{ valid: boolean; percent: number; code: string }>(`/catalog/coupon/${encodeURIComponent(c)}`);
      if (data.valid) {
        const cc = { code: data.code, percent: data.percent };
        setCoupon(cc);
        localStorage.setItem('merchantos_coupon', JSON.stringify(cc));
        setCouponMsg(`✅ ${data.percent}% OFF applied!`);
      } else setCouponMsg('❌ Invalid or already-used coupon');
    } catch { setCouponMsg('❌ Invalid or already-used coupon'); }
  };
  const removeCoupon = () => { setCoupon(null); localStorage.removeItem('merchantos_coupon'); setCouponMsg(''); };

  const proceedToCheckout = async () => {
    setShowRecs(true);
    setLoadingRecs(true);
    try {
      const data = await api.post<{ accessories: Accessory[] }>('/catalog/accessories', {
        ids: items.map((i) => i.product_id),
      });
      setAccessories(data.accessories || []);
    } catch (e) {
      setAccessories([]);
      console.error(e);
    } finally {
      setLoadingRecs(false);
    }
  };

  const addAccessory = (acc: Accessory) => {
    addToCart({ product_id: acc.id, name: acc.name, price: acc.price, quantity: 1, emoji: acc.emoji || '📦' });
    setAddedIds((prev) => new Set(prev).add(acc.id));
  };

  const continueCheckout = () => {
    setShowRecs(false);
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">Looks like you haven't added anything to your cart yet</p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">

      <h1 className="text-2xl font-bold mb-6">Shopping Cart ({itemCount} items)</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.product_id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
              <div className="w-16 h-16 bg-muted/50 rounded-lg overflow-hidden shrink-0">
                <img src={imageUrl(item.product_id)} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${item.product_id}`} className="font-medium text-sm hover:text-primary line-clamp-1">{item.name}</Link>
                <p className="text-sm text-muted-foreground">{formatINR(item.price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted"><Minus className="w-3 h-3" /></button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted"><Plus className="w-3 h-3" /></button>
              </div>
              <p className="font-bold text-primary w-20 text-right">{formatINR(item.price * item.quantity)}</p>
              <button onClick={() => removeFromCart(item.product_id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={clearCart} className="text-sm text-muted-foreground hover:text-destructive">Clear cart</button>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 h-fit sticky top-24">
          <h2 className="font-bold text-lg mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(total)}</span></div>
            {bundleDiscount > 0 && <div className="flex justify-between text-green-400"><span>Bundle Discount (5%)</span><span>-{formatINR(bundleDiscount)}</span></div>}
            {coupon && <div className="flex justify-between text-green-400"><span>🎟️ Coupon {coupon.code} ({coupon.percent}%)</span><span className="flex items-center gap-2">-{formatINR(couponDiscount)}<button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button></span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className={shipping === 0 ? 'text-green-400' : ''}>{shipping === 0 ? 'FREE' : formatINR(shipping)}</span></div>
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">{formatINR(grandTotal)}</span></div>
            {couponDiscount > 0 && <div className="text-xs text-green-400">You saved {formatINR(bundleDiscount + couponDiscount + (shipping === 0 ? 40 : 0))} on this order 🎉</div>}
          </div>
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-medium mb-2 flex items-center gap-1">🎟️ Have a coupon?</p>
            <div className="flex gap-2">
              <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                placeholder="Enter code e.g. SPIN10ABCD" className="flex-1 px-3 py-2 text-sm bg-input border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <button onClick={() => applyCoupon()} className="px-4 py-2 text-sm bg-muted rounded-lg font-medium hover:bg-primary hover:text-primary-foreground transition-colors">Apply</button>
            </div>
            {couponMsg && <p className={`text-xs mt-2 ${couponMsg.startsWith('✅') ? 'text-green-400' : 'text-destructive'}`}>{couponMsg}</p>}
          </div>
          {shipping === 0 && itemCount >= 2 && (
            <div className="mt-3 p-2 bg-green-400/10 text-green-400 text-xs rounded-lg flex items-center gap-2"><Truck className="w-3 h-3" /> You saved ₹40 on shipping + ₹{bundleDiscount} bundle discount!</div>
          )}
          <button onClick={() => navigate('/checkout')} className="w-full mt-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
            Proceed to Checkout <ArrowRight className="w-4 h-4" />
          </button>
          <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-primary mt-3">Continue Shopping</Link>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Shield className="w-3 h-3" /> Secure checkout powered by Razorpay</div>
        </div>
      </div>
{/* Recommended add-ons modal */}
      {showRecs && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="font-bold text-lg">Complete your purchase with add-ons</h2>
              </div>
              <button onClick={() => setShowRecs(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-sm text-muted-foreground mb-4">Hand-picked accessories that pair well with the items in your cart. Add any of them and save 5% + FREE shipping on a 2+ item bundle!</p>
              {loadingRecs ? (
                <p className="text-center text-muted-foreground py-10">Finding the perfect add-ons for you…</p>
              ) : accessories.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No accessory recommendations right now. You're all set to checkout!</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {accessories.map((acc) => {
                    const added = addedIds.has(acc.id);
                    return (
                      <div key={acc.id} className="flex gap-3 items-center p-3 border border-border rounded-xl hover:border-primary/40 transition-colors">
                        <img src={imageUrl(acc.id)} alt={acc.name} className="w-16 h-16 rounded-lg object-cover bg-muted/50 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{acc.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{acc.reason}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold text-primary text-sm">{formatINR(acc.price)}</span>
                            {acc.discount_percent > 0 && <span className="text-xs text-muted-foreground line-through">{formatINR(acc.original_price)}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => addAccessory(acc)}
                          disabled={added || acc.stock <= 0}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${added ? 'bg-green-500/20 text-green-400' : acc.stock <= 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                        >
                          {added ? 'Added ✓' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
              <button onClick={() => setShowRecs(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Skip</button>
              <button onClick={continueCheckout} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
