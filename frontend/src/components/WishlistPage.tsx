import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { useCart } from '../App';
import { getWishlist, removeFromWishlist, WishItem } from '../lib/wishlist';

export function WishlistPage() {
  const [items, setItems] = useState<WishItem[]>(getWishlist());
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setItems(getWishlist());
    window.addEventListener('merchantos:wishlist', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('merchantos:wishlist', sync); window.removeEventListener('storage', sync); };
  }, []);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center"><Heart className="w-5 h-5 text-red-500 fill-red-500" /></div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">My Wishlist</h1>
          <p className="text-sm text-muted-foreground">{items.length} saved {items.length === 1 ? 'item' : 'items'}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 glass rounded-3xl border border-white/10">
          <div className="text-6xl mb-4">💔</div>
          <p className="text-xl font-bold mb-1">Nothing saved yet</p>
          <p className="text-muted-foreground text-sm mb-6">Tap the ♡ on any product to save it here for later.</p>
          <Link to="/category/electronics" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90">
            Start exploring <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((w) => (
            <div key={w.id} className="group bg-card border border-border rounded-2xl overflow-hidden card-lift">
              <Link to={`/product/${w.id}`} className="block">
                <div className="aspect-square relative bg-muted/50">
                  <img src={`/api/catalog/image/${w.id}.svg?v=2`} alt={w.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary">{w.name}</h3>
                  <p className="font-bold text-primary mt-1">{formatINR(w.price)}</p>
                </div>
              </Link>
              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={() => { addToCart({ product_id: w.id, name: w.name, price: w.price, quantity: 1, emoji: w.emoji }); navigate('/cart'); }}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-1"
                >
                  <ShoppingCart className="w-3 h-3" /> Add to Cart
                </button>
                <button
                  onClick={() => removeFromWishlist(w.id)}
                  title="Remove from wishlist"
                  className="w-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
