import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Search, X, Package, MessageCircle, Sun, Moon, Heart, Mic } from 'lucide-react';
import { useSpeech } from './lib/speech';
import { api } from './api/client';
import { ChatInterface } from './components/ChatInterface';
import { WishlistPage } from './components/WishlistPage';
import { AccountPage } from './components/AccountPage';
import { getWishlist } from './lib/wishlist';
import { OrderHistory } from './components/OrderHistory';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { HealthCheck } from './components/HealthCheck';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { ProductListing } from './components/ProductListing';
import { ProductDetail } from './components/ProductDetail';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';

// Auth context
interface AuthUser {
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Cart context
interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

export const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  total: 0,
  itemCount: 0,
});

export const useCart = () => useContext(CartContext);

// Theme context
type Theme = 'dark' | 'light';
interface ThemeContextType { theme: Theme; toggleTheme: () => void; }
export const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

/** Scroll to top on every route change so pages always open at the top. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
      className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />}
    </button>
  );
}

function WishlistButton() {
  const [count, setCount] = useState(getWishlist().length);
  useEffect(() => {
    const sync = () => setCount(getWishlist().length);
    window.addEventListener('merchantos:wishlist', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('merchantos:wishlist', sync); window.removeEventListener('storage', sync); };
  }, []);
  return (
    <Link to="/wishlist" className="relative flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-muted transition-colors" title="Wishlist">
      <Heart className="w-5 h-5" />
      {count > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white rounded-full text-xs flex items-center justify-center font-bold">{count}</span>}
      <span className="text-xs font-medium hidden md:block">Saved</span>
    </Link>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link to={to} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
      {label}
    </Link>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('merchantos_token'));
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('merchantos_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem('merchantos_theme', theme);
    root.classList.add('theme-transition');
    const t = setTimeout(() => root.classList.remove('theme-transition'), 500);
    return () => clearTimeout(t);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // 🏆 Loyalty points (gamification) — earn 1 pt per ₹100 spent
  const [points, setPoints] = useState<number>(() => parseInt(localStorage.getItem('merchantos_points') || '0', 10));
  useEffect(() => {
    const onOrder = (e: Event) => {
      const amount = (e as CustomEvent).detail?.amount || 0;
      const gained = Math.max(10, Math.round(amount / 100));
      setPoints((p) => { const n = p + gained; localStorage.setItem('merchantos_points', String(n)); return n; });
    };
    window.addEventListener('merchantos:order', onOrder);
    return () => window.removeEventListener('merchantos:order', onOrder);
  }, []);

  useEffect(() => {
    if (token) {
      api.get<{ user: AuthUser }>('/auth/me').then((data) => { setUser(data.user); }).catch(() => { localStorage.removeItem('merchantos_token'); setToken(null); });
    }
  }, [token]);

  const login = (t: string, u: AuthUser) => { localStorage.setItem('merchantos_token', t); setToken(t); setUser(u); };
  const logout = () => { localStorage.removeItem('merchantos_token'); setToken(null); setUser(null); };
  const addToCart = (item: CartItem) => { const q = Math.max(1, item.quantity || 1); setCartItems((p) => { const e = p.find((i) => i.product_id === item.product_id); if (e) return p.map((i) => i.product_id === item.product_id ? { ...i, quantity: i.quantity + q } : i); return [...p, { ...item, quantity: q }]; }); };
  const removeFromCart = (id: string) => { setCartItems((p) => p.filter((i) => i.product_id !== id)); };
  const updateQuantity = (id: string, qty: number) => { if (qty <= 0) { removeFromCart(id); return; } setCartItems((p) => p.map((i) => i.product_id === id ? { ...i, quantity: qty } : i)); };
  const clearCart = () => setCartItems([]);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  // Voice search: speak a query, land on results
  const { listening: voiceListening, supported: voiceSupported, toggle: toggleVoiceSearch } = useSpeech((text: string) => {
    if (text.trim()) { window.location.href = `/search?q=${encodeURIComponent(text.trim())}`; }
  });

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (searchQuery.trim()) window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`; };
  const tier = points >= 1000 ? { name: 'Platinum', pct: 100 } : points >= 500 ? { name: 'Gold', pct: (points - 500) / 5 } : points >= 200 ? { name: 'Silver', pct: (points - 200) / 3 } : { name: 'Bronze', pct: points / 2 };

  return (
    <Router>
      <ScrollToTop />
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AuthContext.Provider value={{ user, token, login, logout }}>
        <CartContext.Provider value={{ items: cartItems, addToCart, removeFromCart, updateQuantity, clearCart, total: cartTotal, itemCount: cartCount }}>
          <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
              <div className="container mx-auto px-4 py-2 flex items-center gap-4">
                <Link to="/" className="flex items-center gap-2 shrink-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">M</span>
                  </div>
                  <span className="text-lg font-bold hidden sm:block">Merchantos</span>
                </Link>
                <form onSubmit={handleSearch} className="flex-1 flex">
                  <div className="flex-1 flex bg-background border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products..." className="flex-1 px-4 py-2 bg-transparent outline-none text-sm" />
                    {voiceSupported && (
                      <button type="button" onClick={toggleVoiceSearch} title={voiceListening ? 'Listening - tap to stop' : 'Voice search'}
                        className={`px-3 text-muted-foreground hover:text-primary transition-colors ${voiceListening ? 'animate-pulse text-red-500' : ''}`}>
                        <Mic className="w-4 h-4" />
                      </button>
                    )}
                    <button type="submit" className="px-4 bg-primary text-primary-foreground hover:bg-primary/90"><Search className="w-4 h-4" /></button>
                  </div>
                </form>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <WishlistButton />
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border" title="Loyalty points — earn 1 pt for every ₹100 spent">
                    <span className="text-base">🏆</span>
                    <div className="w-24">
                      <div className="text-[10px] leading-3 whitespace-nowrap">
                        <span className="font-bold">{points} pts</span>
                        <span className="text-primary"> · {tier.name}</span>
                      </div>
                      <div className="h-1 bg-border rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-purple-400 transition-all" style={{ width: `${Math.min(100, tier.pct)}%` }} />
                      </div>
                    </div>
                  </div>
                  <Link to={user ? '/account' : '/login'} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
                    <User className="w-5 h-5" />
                    <div className="hidden md:block text-left">
                      <p className="text-xs text-muted-foreground">{user ? `Hi, ${user.name.split(' ')[0]}` : 'Hello, sign in'}</p>
                      <p className="text-xs font-medium">{user ? 'Account' : 'Login'}</p>
                    </div>
                  </Link>
                  <Link to="/cart" className="relative flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
                    <ShoppingCart className="w-5 h-5" />
                    {cartCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center font-bold">{cartCount}</span>}
                    <span className="text-xs font-medium hidden md:block">Cart</span>
                  </Link>
                </div>
              </div>
              <div className="border-t border-border bg-muted/30">
                <div className="container mx-auto px-4 py-1.5 flex items-center gap-1 overflow-x-auto text-sm">
                  <Link to="/category/electronics" className="px-3 py-1 rounded hover:bg-muted whitespace-nowrap">Electronics</Link>
                  <Link to="/category/groceries" className="px-3 py-1 rounded hover:bg-muted whitespace-nowrap">Groceries</Link>
                  <Link to="/category/home-kitchen" className="px-3 py-1 rounded hover:bg-muted whitespace-nowrap">Home & Kitchen</Link>
                  <Link to="/category/clothing" className="px-3 py-1 rounded hover:bg-muted whitespace-nowrap">Clothing</Link>
                  <Link to="/category/stationery" className="px-3 py-1 rounded hover:bg-muted whitespace-nowrap">Stationery</Link>
                  <Link to="/category/books" className="px-3 py-1 rounded hover:bg-muted whitespace-nowrap">Books</Link>
                  <Link to="/category/accessories" className="px-3 py-1 rounded hover:bg-muted whitespace-nowrap">Accessories</Link>
                </div>
              </div>
            </header>
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/category/:category" element={<ProductListing />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/search" element={<ProductListing />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/orders" element={<OrderHistory />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/health" element={<HealthCheck />} />
                <Route path="/chat" element={<ChatInterface />} />
              </Routes>
            </main>
            <footer className="border-t border-border bg-card mt-10">
              <div className="container mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center"><span className="text-primary-foreground font-bold text-xs">M</span></div>
                    <span className="font-bold">Merchantos</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">India's AI-powered supermarket. Shop by chat, voice, or click — with bundle savings on every order.</p>
                  <span className="inline-block mt-3 px-2 py-1 rounded bg-muted text-[10px]">MERCHANTOS - EBEN SAMUEL E</span>
                </div>
                <div>
                  <p className="font-semibold mb-3">Shop</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {['electronics', 'groceries', 'home-kitchen', 'clothing', 'stationery', 'books', 'accessories'].map((c) => (
                      <Link key={c} to={`/category/${c}`} className="text-muted-foreground hover:text-primary capitalize transition-colors">{c.replace('-', ' & ')}</Link>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold mb-3">Your Account</p>
                  <div className="flex flex-col gap-2 text-xs">
                    <Link to="/account" className="text-muted-foreground hover:text-primary transition-colors">My Account</Link>
                    <Link to="/wishlist" className="text-muted-foreground hover:text-primary transition-colors">Wishlist</Link>
                    <Link to="/cart" className="text-muted-foreground hover:text-primary transition-colors">Cart</Link>
                    <Link to="/orders" className="text-muted-foreground hover:text-primary transition-colors">Order History</Link>
                  </div>
                </div>
                <div>
                  <p className="font-semibold mb-3">Explore</p>
                  <div className="flex flex-col gap-2 text-xs">
                    <button onClick={() => setShowChat(true)} className="text-left text-muted-foreground hover:text-primary transition-colors">🤖 AI Shopping Assistant</button>
                    <Link to="/analytics" className="text-muted-foreground hover:text-primary transition-colors">📊 Live Analytics</Link>
                    <Link to="/health" className="text-muted-foreground hover:text-primary transition-colors">💚 System Health</Link>
                  </div>
                  <p className="mt-4 text-[10px] text-muted-foreground">Sample logins: admin/admin123 · user/user123 · seller/seller123</p>
                </div>
              </div>
              <div className="border-t border-border py-3 text-center text-[11px] text-muted-foreground">
                © {new Date().getFullYear()} Merchantos — AI-powered supermarket · Payments secured by Razorpay
              </div>
            </footer>
            <button onClick={() => setShowChat(!showChat)} className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 flex items-center justify-center z-50 transition-transform hover:scale-110">
              {showChat ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </button>
            {showChat && (
              <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[70vh] bg-card border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
                <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" /><span className="font-medium">Merchantos AI Assistant</span>
                </div>
                <div className="flex-1 overflow-hidden"><ChatInterface embedded /></div>
              </div>
            )}
          </div>
        </CartContext.Provider>
      </AuthContext.Provider>
      </ThemeContext.Provider>
    </Router>
  );
}
