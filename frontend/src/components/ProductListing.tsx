import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../App';
import { WishHeart } from './WishHeart';
import { ShoppingCart, Filter, ChevronRight } from 'lucide-react';

interface Product {
  id: string; name: string; description: string; category: string;
  price: number; discount_percent: number; stock: number;
  attributes_json: string; attributes?: any; tags: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  electronics: 'Electronics & Gadgets', groceries: 'Groceries', 'home-kitchen': 'Home & Kitchen',
  clothing: 'Clothing', stationery: 'Stationery', books: 'Books', accessories: 'Accessories',
};

export function ProductListing() {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('relevance');
  const { addToCart } = useCart();

  useEffect(() => {
    setLoading(true);
    const url = query ? `/catalog/search?q=${encodeURIComponent(query)}&limit=50` : `/catalog/products?category=${category || ''}&limit=50`;
    api.get<{ products: Product[] }>(url).then((data) => { setProducts(data.products); }).catch(console.error).finally(() => setLoading(false));
  }, [category, query]);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const getAttr = (p: any) => { if (p?.attributes && typeof p.attributes === 'object') return p.attributes; try { return JSON.parse(p?.attributes_json || '{}'); } catch { return {}; } };
  const discountedPrice = (p: Product) => Math.round(p.price * (1 - (p.discount_percent || 0) / 100));
  const sorted = [...products].sort((a, b) => { if (sortBy === 'price-low') return discountedPrice(a) - discountedPrice(b); if (sortBy === 'price-high') return discountedPrice(b) - discountedPrice(a); if (sortBy === 'discount') return (b.discount_percent || 0) - (a.discount_percent || 0); return 0; });
  const addToCartHandler = (p: Product) => { const attr = getAttr(p); addToCart({ product_id: p.id, name: p.name, price: discountedPrice(p), quantity: 1, emoji: attr.emoji || '📦' }); };
  const title = query ? `Search: "${query}"` : CATEGORY_NAMES[category || ''] || 'All Products';

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/" className="hover:text-primary">Home</Link><ChevronRight className="w-3 h-3" /><span className="text-foreground">{title}</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{products.length} products found</p></div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none">
            <option value="relevance">Relevance</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="discount">Best Discount</option>
          </select>
        </div>
      </div>
      {loading ? (<div className="text-center py-16 text-muted-foreground">Loading products...</div>) : sorted.length === 0 ? (
        <div className="text-center py-16"><p className="text-xl text-muted-foreground mb-2">No products found</p><p className="text-sm text-muted-foreground">Try a different search or browse our categories</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((product) => {
            const attr = getAttr(product); const dp = discountedPrice(product);
            return (
              <div key={product.id} className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all hover:border-primary/30">
                <Link to={`/product/${product.id}`} className="block">
                  <div className="aspect-square relative bg-muted/50">
                    <img src={`/api/catalog/image/${product.id}.svg?v=2`} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
                    {product.discount_percent > 0 && <span className="absolute top-2 left-2 px-2 py-0.5 bg-destructive text-destructive-foreground text-xs font-bold rounded">{product.discount_percent}% OFF</span>}
                    <WishHeart id={product.id} name={product.name} price={dp} emoji={getAttr(product).emoji} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors" />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
                    <div className="flex items-center gap-2"><span className="font-bold text-primary">{formatINR(dp)}</span>{product.discount_percent > 0 && <span className="text-xs text-muted-foreground line-through">{formatINR(product.price)}</span>}</div>
                    {product.stock > 0 && product.stock < 10 && <p className="text-xs text-amber-400 mt-1">Only {product.stock} left!</p>}
                    {product.stock === 0 && <p className="text-xs text-destructive mt-1">Out of stock</p>}
                  </div>
                </Link>
                <div className="px-3 pb-3">
                  <button onClick={() => addToCartHandler(product)} disabled={product.stock === 0} className="w-full py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ShoppingCart className="w-3 h-3" /> {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
