const fs = require('fs');
const path = require('path');

const files = {
  'ProductListing.tsx': `import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../App';
import { ShoppingCart, Filter, ChevronRight } from 'lucide-react';

interface Product { id: string; name: string; category: string; price: number; discount_percent: number; stock: number; attributes_json: string; }

const CAT_NAMES: Record<string, string> = { electronics: 'Electronics & Gadgets', groceries: 'Groceries', 'home-kitchen': 'Home & Kitchen', clothing: 'Clothing', stationery: 'Stationery', books: 'Books', accessories: 'Accessories' };

export function ProductListing() {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('relevance');
  const { addToCart } = useCart();
  useEffect(() => { setLoading(true); const url = query ? \`/catalog/search?q=\${encodeURIComponent(query)}&limit=50\` : \`/catalog/products?category=\${category || ''}&limit=50\`; api.get(url).then((d) => setProducts(d.products)).catch(console.error).finally(() => setLoading(false)); }, [category, query]);
  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
  const attr = (j: string) => { try { return JSON.parse(j); } catch { return {}; } };
  const discountedPrice = (p: Product) => Math.round(p.price * (1 - (p.discount_percent || 0) / 100));
  const sorted = [...products].sort((a, b) => { if (sortBy === 'price-low') return discountedPrice(a) - discountedPrice(b); if (sortBy === 'price-high') return discountedPrice(b) - discountedPrice(a); if (sortBy === 'discount') return (b.discount_percent || 0) - (a.discount_percent || 0); return 0; });
  const add = (p: Product) => { const a = attr(p.attributes_json); addToCart({ product_id: p.id, name: p.name, price: discountedPrice(p), quantity: 1, emoji: a.emoji || '📦' }); };
  const title = query ? \`Search: "\${query}"\` : CAT_NAMES[category || ''] || 'All Products';
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><Link to="/" className="hover:text-primary">Home</Link><ChevronRight className="w-3 h-3" /><span className="text-foreground">{title}</span></div>
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{products.length} products</p></div><div className="flex items-center gap-2"><Filter className="w-4 h-4 text-muted-foreground" /><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none"><option value="relevance">Relevance</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="discount">Best Discount</option></select></div></div>
      {loading ? <div className="text-center py-16 text-muted-foreground">Loading...</div> : sorted.length === 0 ? <div className="text-center py-16"><p className="text-xl text-muted-foreground">No products found</p></div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((p) => { const a = attr(p.attributes_json); const d = discountedPrice(p); return (
            <div key={p.id} className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30">
              <Link to={\`/product/\${p.id}\`} className="block"><div className="aspect-square bg-muted/50 flex items-center justify-center text-5xl relative">{a.emoji || '📦'}{p.discount_percent > 0 && <span className="absolute top-2 left-2 px-2 py-0.5 bg-destructive text-destructive-foreground text-xs font-bold rounded">{p.discount_percent}% OFF</span>}</div><div className="p-3"><h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary">{p.name}</h3><p className="text-xs text-muted-foreground mb-2">{p.category}</p><div className="flex items-center gap-2"><span className="font-bold text-primary">{fmt(d)}</span>{p.discount_percent > 0 && <span className="text-xs text-muted-foreground line-through">{fmt(p.price)}</span>}</div>{p.stock > 0 && p.stock < 10 && <p className="text-xs text-amber-400 mt-1">Only {p.stock} left!</p>}{p.stock === 0 && <p className="text-xs text-destructive mt-1">Out of stock</p>}</div></Link>
              <div className="px-3 pb-3"><button onClick={() => add(p)} disabled={p.stock === 0} className="w-full py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary hover:text-primary-foreground flex items-center justify-center gap-1 disabled:opacity-50"><ShoppingCart className="w-3 h-3" />{p.stock === 0 ? 'Out of Stock' : 'Add to Cart'}</button></div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}`,
};

const baseDir = 'd:\\College created on 02.10.24\\5th Sem 23.07.26\\Non-Academic\\Rayzorpayproj\\frontend\\src\\components';
for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(baseDir, name), content, 'utf8');
  console.log('Written:', name);
}