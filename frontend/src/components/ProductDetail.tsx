import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../App';
import { ShoppingCart, ChevronRight, Truck, Shield, Zap, Flame, CalendarDays, RotateCcw } from 'lucide-react';
import { WishHeart } from './WishHeart';

interface Product {
  id: string; name: string; description: string; category: string;
  price: number; discount_percent: number; stock: number;
  attributes_json: string; attributes?: any; tags: string;
}

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setQty(1);
    api.get<Product>(`/catalog/products/${id}`).then((p) => {
      setProduct(p);
      api.get<{ products: Product[] }>(`/catalog/products?category=${encodeURIComponent(p.category)}&limit=5`).then((data) => {
        setRelated(data.products.filter((r) => r.id !== p.id).slice(0, 4));
      }).catch(console.error);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const getAttr = (p: any) => { if (p?.attributes && typeof p.attributes === 'object') return p.attributes; try { return JSON.parse(p?.attributes_json || '{}'); } catch { return {}; } };
  const discountedPrice = (p: Product) => Math.round(p.price * (1 - (p.discount_percent || 0) / 100));

  if (loading) return <div className="text-center py-16 text-muted-foreground">Loading...</div>;
  if (!product) return <div className="text-center py-16"><p className="text-xl">Product not found</p><Link to="/" className="text-primary hover:underline">Go home</Link></div>;
  const dp = discountedPrice(product);
  const buyers = 18 + ((product.id.length * 7) % 40);
  const deliveryDate = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const addToCartHandler = (p: Product, q: number = 1) => {
    const a = getAttr(p);
    addToCart({ product_id: p.id, name: p.name, price: discountedPrice(p), quantity: q, emoji: a.emoji || '📦' });
  };
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/" className="hover:text-primary">Home</Link><ChevronRight className="w-3 h-3" />
        <Link to={`/category/${encodeURIComponent(product.category)}`} className="hover:text-primary">{product.category}</Link><ChevronRight className="w-3 h-3" />
        <span className="text-foreground line-clamp-1">{product.name}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="group bg-card border border-border rounded-2xl aspect-square relative overflow-hidden">
          <img src={`/api/catalog/image/${product.id}.svg?v=2`} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          {product.discount_percent > 0 && <span className="absolute top-4 left-4 px-3 py-1 bg-destructive text-destructive-foreground text-sm font-bold rounded-lg">{product.discount_percent}% OFF</span>}
        </div>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">{product.description}</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">{formatINR(dp)}</span>
            {product.discount_percent > 0 && <span className="text-lg text-muted-foreground line-through">{formatINR(product.price)}</span>}
            <WishHeart id={product.id} name={product.name} price={dp} emoji={getAttr(product).emoji} className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors" />
            {product.discount_percent > 0 && <span className="text-sm font-semibold text-green-400">You save {formatINR(product.price - dp)}</span>}
          </div>
          {product.stock > 0 && product.stock < 10 && <p className="text-sm text-amber-400 font-medium">Hurry! Only {product.stock} left in stock</p>}
          {product.stock === 0 && <p className="text-sm text-destructive font-medium">Out of stock</p>}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center border border-border rounded-lg overflow-hidden h-12">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-full flex items-center justify-center hover:bg-muted text-lg">-</button>
              <span className="w-10 text-center font-medium">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))} className="w-10 h-full flex items-center justify-center hover:bg-muted text-lg">+</button>
            </div>
            <button onClick={() => addToCartHandler(product, qty)} disabled={product.stock === 0} className="flex-1 min-w-[140px] py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Add to Cart
            </button>
            <button onClick={() => { addToCartHandler(product, qty); navigate('/cart'); }} disabled={product.stock === 0} className="flex-1 min-w-[140px] py-3 bg-amber-500 text-black rounded-lg font-bold hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2">Buy Now</button>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <p className="text-amber-400 flex items-center gap-1.5"><Flame className="w-4 h-4" /> {buyers} people bought this in the last 24 hours</p>
            <p className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Free delivery by {deliveryDate} if ordered today</p>
            <p className="text-muted-foreground flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> 7-day easy returns · 1-year warranty</p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"><Truck className="w-5 h-5 text-primary" /><div><p className="text-xs font-medium">Free Shipping</p><p className="text-xs text-muted-foreground">On ₹499+</p></div></div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"><Shield className="w-5 h-5 text-green-400" /><div><p className="text-xs font-medium">Secure</p><p className="text-xs text-muted-foreground">Razorpay</p></div></div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"><Zap className="w-5 h-5 text-amber-400" /><div><p className="text-xs font-medium">5% Bundle</p><p className="text-xs text-muted-foreground">Buy 2+ items</p></div></div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-4">You might also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all">
                <div className="aspect-square bg-muted/50"><img src={`/api/catalog/image/${p.id}.svg?v=2`} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /></div>
                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary">{p.name}</h3>
                  <p className="font-bold text-primary mt-1">{formatINR(discountedPrice(p))}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}