import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Package, Heart, ShoppingCart, BarChart3, Activity, Bot, Trophy } from 'lucide-react';
import { useAuth } from '../App';

const TIERS = [
  { min: 1000, name: 'Platinum', icon: '💎' },
  { min: 500, name: 'Gold', icon: '🥇' },
  { min: 200, name: 'Silver', icon: '🥈' },
  { min: 0, name: 'Bronze', icon: '🥉' },
];

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [points, setPoints] = useState(0);
  const [wishCount, setWishCount] = useState(0);

  useEffect(() => {
    setPoints(parseInt(localStorage.getItem('merchantos_points') || '0', 10));
    try { setWishCount(JSON.parse(localStorage.getItem('merchantos_wishlist') || '[]').length); } catch { setWishCount(0); }
  }, []);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-2xl font-bold mb-2">Sign in to view your account</h1>
        <p className="text-muted-foreground mb-6">Your orders, wishlist and loyalty points live here.</p>
        <Link to="/login" className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90">Go to Login</Link>
      </div>
    );
  }

  const tier = TIERS.find((t) => points >= t.min) || TIERS[3];
  const nextTier = TIERS[Math.max(0, TIERS.indexOf(tier) - 1)];
  const progress = tier.name === 'Platinum' ? 100 : Math.round(((points - tier.min) / (nextTier.min - tier.min)) * 100);

  const tiles = [
    { to: '/orders', icon: <Package className="w-5 h-5" />, label: 'My Orders', emoji: '📦' },
    { to: '/wishlist', icon: <Heart className="w-5 h-5" />, label: 'Wishlist', badge: wishCount, emoji: '❤️' },
    { to: '/cart', icon: <ShoppingCart className="w-5 h-5" />, label: 'My Cart', emoji: '🛒' },
    { to: '/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics', emoji: '📊' },
    { to: '/health', icon: <Activity className="w-5 h-5" />, label: 'System Health', emoji: '🩺' },
    { to: '/chat', icon: <Bot className="w-5 h-5" />, label: 'AI Assistant', emoji: '🤖' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="glass rounded-3xl border border-white/10 p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 10%, hsl(var(--primary-glow) / 0.4), transparent 45%)' }} />
        <div className="flex items-center gap-4 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-primary/30">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">{user.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wide">{user.role}</span>
              <span className="text-xs text-muted-foreground">@{user.username}</span>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>

        <div className="mt-6 relative">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-bold flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-400" /> {tier.icon} {tier.name} member</span>
            <span className="text-muted-foreground">{points} points {tier.name !== 'Platinum' && <>· {nextTier.min - points} to {nextTier.name}</>}</span>
          </div>
          <div className="h-2.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(4, progress))}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Earn 1 point for every ₹100 you spend. Points never expire.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="glass rounded-2xl border border-white/10 p-4 flex items-center gap-3 card-lift group">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{t.icon}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{t.label}</p>
              {typeof t.badge === 'number' && t.badge > 0 && <p className="text-[11px] text-red-400 font-bold">{t.badge} saved</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
