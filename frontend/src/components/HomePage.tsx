import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { WishHeart } from './WishHeart';
import { useCart } from '../App';
import { ShoppingCart, TrendingUp, Flame, Clock, ArrowRight, Bot, Star, Zap, ChevronRight, Sparkles, Truck, ShieldCheck, RotateCcw, BadgePercent } from 'lucide-react';

interface Product {
  id: string; name: string; description: string; category: string;
  price: number; discount_percent: number; stock: number;
  attributes_json: string; attributes?: any; tags: string;
}

interface Deal {
  id: string; name: string; category: string; price: number;
  discount_percent: number; discounted_price: number; emoji: string; stock: number;
}

interface Hero {
  total_products: number; active_deals: number; in_stock: number; categories: number;
  tagline: string; perks: Array<{ icon: string; title: string; desc: string }>;
}

const CATEGORIES = [
  { id: 'electronics', name: 'Electronics', desc: 'Mobiles, laptops, earbuds & more', img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop&q=80' },
  { id: 'groceries', name: 'Groceries', desc: 'Rice, atta, tea, coffee & staples', img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=400&fit=crop&q=80' },
  { id: 'home-kitchen', name: 'Home & Kitchen', desc: 'Cookers, pans, vessels & dinner sets', img: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600&h=400&fit=crop&q=80' },
  { id: 'clothing', name: 'Clothing', desc: 'Shirts, trousers, formal wear', img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop&q=80' },
  { id: 'stationery', name: 'Stationery', desc: 'Notebooks, pens, art supplies', img: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=600&h=400&fit=crop&q=80' },
  { id: 'books', name: 'Books', desc: 'Fiction, non-fiction, academic', img: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=400&fit=crop&q=80' },
  { id: 'accessories', name: 'Accessories', desc: 'Ties, belts, watches, bags', img: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&h=400&fit=crop&q=80' },
];

/* ===================== Reveal-on-scroll wrapper ===================== */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('revealed'); io.disconnect(); }
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* ===================== Animated counter ===================== */
function useCountUp(target: number | undefined, run: boolean, duration = 1200): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run || target === undefined) return;
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return val;
}

/* ===================== Countdown to midnight ===================== */
function useCountdown(): string {
  const [left, setLeft] = useState('--:--:--');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      const p = (n: number) => String(n).padStart(2, '0');
      setLeft(`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

/* ===================== Self-typing AI demo (hero tile) ===================== */
const DEMO_SCRIPT = [
  { role: 'user', text: 'Gaming laptop under 70K with 1TB + graphics' },
  { role: 'ai', text: 'Found 3! HP Victus — RTX 3050, 16GB RAM, 1TB SSD — ₹58,499 🎮' },
  { role: 'user', text: 'Add a mouse & bag too' },
  { role: 'ai', text: 'Bundle done — 5% OFF + FREE shipping. Total ₹62,424 (saved ₹3,582) 💜' },
];

function AIChatDemo() {
  const [lines, setLines] = useState<Array<{ role: string; text: string }>>([]);
  const [cur, setCur] = useState('');
  const [curRole, setCurRole] = useState<'user' | 'ai'>('user');
  useEffect(() => {
    let line = 0, char = 0, timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (line >= DEMO_SCRIPT.length) {
        timer = setTimeout(() => { setLines([]); setCur(''); line = 0; char = 0; setCurRole('user'); step(); }, 4000);
        return;
      }
      const msg = DEMO_SCRIPT[line];
      setCurRole(msg.role as 'user' | 'ai');
      if (char <= msg.text.length) {
        setCur(msg.text.slice(0, char));
        char += 1;
        timer = setTimeout(step, msg.role === 'ai' ? 26 : 38);
      } else {
        setLines((p) => [...p.slice(-2), { role: msg.role, text: msg.text }]);
        setCur('');
        line += 1; char = 0;
        timer = setTimeout(step, 750);
      }
    };
    step();
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
        AI Assistant — live demo
      </div>
      <div className="flex-1 flex flex-col justify-end gap-1.5 overflow-hidden">
        {lines.map((l, i) => (
          <div key={i} className={`max-w-[92%] text-[11px] leading-snug px-2.5 py-1.5 rounded-xl ${l.role === 'user' ? 'self-end bg-primary text-primary-foreground rounded-br-sm' : 'self-start bg-muted/80 border border-border rounded-bl-sm'}`}>{l.text}</div>
        ))}
        {cur && (
          <div className={`max-w-[92%] text-[11px] leading-snug px-2.5 py-1.5 rounded-xl ${curRole === 'user' ? 'self-end bg-primary text-primary-foreground rounded-br-sm' : 'self-start bg-muted/80 border border-border rounded-bl-sm'}`}>
            {cur}<span className="type-cursor">▍</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== 3D tilt glass tile ===================== */
function TiltTile({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${ -py * 10}deg) translateZ(6px)`;
    el.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
    el.style.setProperty('--my', `${(py + 0.5) * 100}%`);
  };
  const onLeave = () => { const el = ref.current; if (el) el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)'; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`tilt-tile spotlight glass rounded-2xl border border-white/10 p-4 transition-transform duration-200 will-change-transform ${className}`}>
      {children}
    </div>
  );
}

const SPIN_PRIZES = [5, 8, 10, 15, 0, 5, 8, 0];
const WHEEL_BG = 'conic-gradient(#8b5cf6 0deg 45deg, #6366f1 45deg 90deg, #ec4899 90deg 135deg, #8b5cf6 135deg 180deg, #6366f1 180deg 225deg, #ec4899 225deg 270deg, #8b5cf6 270deg 315deg, #6366f1 315deg 360deg)';

/* ===================== HomePage ===================== */
export function HomePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [trending, setTrending] = useState<Deal[]>([]);
  const [hero, setHero] = useState<Hero | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinResult, setSpinResult] = useState<{ win: boolean; percent: number; code?: string } | null>(null);
  const [spinsLeft, setSpinsLeft] = useState(() => {
    const today = new Date().toDateString();
    try {
      const saved = JSON.parse(localStorage.getItem('merchantos_spins') || 'null');
      if (saved && saved.day === today) return Math.max(0, Math.min(5, Number(saved.left)));
    } catch { /* ignore */ }
    return 5;
  });
  const clientId = (() => {
    let id = localStorage.getItem('merchantos_cid');
    if (!id) { id = 'c_' + Math.random().toString(36).slice(2, 12); localStorage.setItem('merchantos_cid', id); }
    return id;
  })();
  const [recentlyViewed, setRecentlyViewed] = useState<Array<{ id: string; name: string; price: number; category: string; emoji: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('merchantos_recently_viewed') || '[]'); } catch { return []; }
  });
  const { addToCart } = useCart();
  const countdown = useCountdown();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    api.get<{ deals: Deal[] }>('/catalog/deals?limit=8').then((d) => setDeals(d.deals)).catch(() => {});
    api.get<{ trending: Deal[] }>('/catalog/trending?limit=10').then((d) => setTrending(d.trending)).catch(() => {});
    api.get<Hero>('/catalog/hero').then(setHero).catch(() => {});
    api.get<{ counts: Record<string, number> }>('/catalog/counts').then((d) => setCounts(d.counts)).catch(() => {});
  }, []);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const getAttr = (p: any) => {
    if (p?.attributes && typeof p.attributes === 'object') return p.attributes;
    try { return JSON.parse(p?.attributes_json || '{}'); } catch { return {}; }
  };
  const discountedPrice = (p: Product) => Math.round(p.price * (1 - (p.discount_percent || 0) / 100));
  const imageUrl = (id: string) => `/api/catalog/image/${id}.svg?v=2`;
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.src.includes('raw=1')) img.src = img.src.split('?')[0] + '?raw=1';
  };
  const catCount = (id: string) => counts[id] ?? '…';

  const quickAdd = (p: { product_id: string; name: string; price: number; emoji?: string }) =>
    addToCart({ product_id: p.product_id, name: p.name, price: p.price, quantity: 1, emoji: p.emoji || '📦' });

    const doSpin = async () => {
    if (spinning || spinsLeft <= 0) return;
    setSpinning(true); setSpinResult(null);
    const turns = 5 + Math.floor(Math.random() * 3);
    setSpinAngle((a) => a + turns * 360 + Math.floor(Math.random() * 360));
    try {
      const data = await api.post<{ win: boolean; percent: number; code?: string; message: string; spins_left: number }>('/catalog/spin', { client_id: clientId });
      setTimeout(() => {
        setSpinResult({ win: data.win, percent: data.percent, code: data.code });
        const left = typeof data.spins_left === 'number' ? data.spins_left : Math.max(0, spinsLeft - 1);
        setSpinsLeft(left);
        localStorage.setItem('merchantos_spins', JSON.stringify({ day: new Date().toDateString(), left }));
        setSpinning(false);
      }, 3200);
    } catch { setSpinning(false); }
  };


  return (
    <div className="pb-14 space-y-14">
      {/* ============ BENTO COMMAND CENTER ============ */}
      <section className="container mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[minmax(150px,auto)]">
          {/* HERO HEADLINE TILE */}
          <Reveal className="md:col-span-12 lg:col-span-7 lg:row-span-2">
            <div className="relative overflow-hidden rounded-3xl h-full min-h-[340px] bg-gradient-to-br from-primary/30 via-card to-fuchsia-500/20 border border-border">
              <div className="absolute inset-0 aurora-layer" />
              <div className="relative h-full flex flex-col justify-center p-7 md:p-10">
                <span className="inline-flex w-fit items-center gap-2 px-4 py-1.5 glass rounded-full text-xs font-semibold mb-5 text-primary">
                  <Sparkles className="w-3.5 h-3.5" /> MERCHANTOS · AI COMMERCE OS
                </span>
                <h1 className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight">
                  Shop the way
                  <br />
                  <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-primary bg-clip-text text-transparent animate-shimmer-text">you think.</span>
                </h1>
                <p className="text-muted-foreground mt-4 max-w-md text-sm md:text-base">
                  Just say what you need — budget, specs, occasion — and our AI builds your cart, applies bundles and checks out for you.
                </p>
                <div className="flex flex-wrap gap-3 mt-7">
                  <Link to="/chat" className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 shadow-lg shadow-primary/25 flex items-center gap-2">
                    <Bot className="w-4 h-4" /> Ask the AI
                  </Link>
                  <Link to="/category/electronics" className="px-6 py-3 glass border border-white/10 rounded-xl font-semibold hover:bg-white/10 flex items-center gap-2">
                    Browse catalog <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-8 text-xs text-muted-foreground">
                  {(hero?.perks || []).slice(0, 4).map((p) => (
                    <span key={p.title} className="inline-flex items-center gap-1.5"><span>{p.icon}</span>{p.title}</span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* AI LIVE DEMO TILE */}
          <Reveal delay={80} className="md:col-span-6 lg:col-span-5">
            <TiltTile className="h-full min-h-[190px]">
              <AIChatDemo />
            </TiltTile>
          </Reveal>

          {/* SPIN & WIN TILE */}
          <Reveal delay={140} className="md:col-span-6 lg:col-span-5">
            <TiltTile className="h-full min-h-[190px] flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-full border-4 border-white/20 shadow-xl"
                  style={{ background: WHEEL_BG, transform: `rotate(${spinAngle}deg)`, transition: spinning || spinResult ? 'transform 3s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none' }} />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-lg">▼</div>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm flex items-center gap-1.5"><span>🎡</span> Spin & Win daily</p>
                {spinResult ? (
                  spinResult.win ? (
                    <p className="text-xs mt-1.5 text-green-400 font-medium">🎉 You won {spinResult.percent}% OFF — code <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{spinResult.code}</span></p>
                  ) : (
                    <p className="text-xs mt-1.5 text-muted-foreground">😅 No luck — FREE shipping unlocked instead. Come back tomorrow!</p>
                  )
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mt-1">Up to 15% OFF coupons. 5 free spins every day.</p>
                    <p className="text-[10px] text-primary font-semibold mt-0.5">Spins left today: {spinsLeft}/5</p>
                    <button onClick={doSpin} disabled={spinning || spinsLeft <= 0}
                      className="mt-2 px-4 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-primary to-fuchsia-500 text-white disabled:opacity-40 hover:opacity-90">
                      {spinning ? 'Spinning...' : spinsLeft > 0 ? 'SPIN NOW' : 'No spins left today'}
                    </button>
                  </>
                )}
              </div>
            </TiltTile>
          </Reveal>


          {/* ANIMATED STATS TILES */}
          {[
            { label: 'Products live', icon: <TrendingUp className="w-5 h-5" />, val: hero?.total_products, tint: 'text-primary', chip: '📦' },
            { label: 'Active deals', icon: <Flame className="w-5 h-5" />, val: hero?.active_deals, tint: 'text-orange-400', chip: '🔥' },
            { label: 'In stock now', icon: <Zap className="w-5 h-5" />, val: hero?.in_stock, tint: 'text-green-400', chip: '⚡' },
            { label: 'Curated categories', icon: <Star className="w-5 h-5" />, val: hero?.categories, tint: 'text-fuchsia-400', chip: '🧭' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={180 + i * 60} className="md:col-span-6 lg:col-span-3">
              <TiltTile className="h-full flex items-center gap-3 min-h-[110px]">
                <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${s.tint}`}>{s.icon}</div>
                <div>
                  <p className="text-3xl font-black tracking-tight">{s.val !== undefined ? s.val : '…'}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                </div>
              </TiltTile>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ DEALS OF THE DAY — live countdown ============ */}
      <section className="container mx-auto px-4">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-400/30 flex items-center justify-center text-orange-400"><Flame className="w-5 h-5" /></span>
                Deals of the Day
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5">Hand-picked by the AI · prices drop at midnight</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border font-mono text-sm">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-muted-foreground text-xs mr-1">ends in</span>
              <span className="font-bold tabular-nums text-orange-400">{countdown}</span>
            </div>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {deals.slice(0, 8).map((d, i) => (
            <Reveal key={d.id} delay={i * 50}>
              <div className="group relative bg-card border border-border rounded-2xl overflow-hidden card-lift">
                <Link to={`/product/${d.id}`} className="block">
                  <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-primary/10 via-muted/40 to-fuchsia-500/10">
                    <img src={imageUrl(d.id)} onError={onImgError} alt={d.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-gradient-to-r from-orange-500 to-red-500 text-white text-[11px] font-black">{d.discount_percent}% OFF</span>
                    {d.stock > 0 && d.stock < 12 && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-amber-300 text-[10px] font-bold">Only {d.stock} left</span>}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-primary">{d.name}</h3>
                      <WishHeart id={d.id} name={d.name} price={d.discounted_price} emoji={d.emoji} className="shrink-0 w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-black text-primary">{formatINR(d.discounted_price)}</span>
                      <span className="text-xs text-muted-foreground line-through">{formatINR(d.price)}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" style={{ width: `${Math.min(92, 100 - d.stock * 2)}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Selling fast — claim yours</p>
                  </div>
                </Link>
                <button onClick={() => quickAdd({ product_id: d.id, name: d.name, price: d.discounted_price, emoji: d.emoji })}
                  className="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all" title="Quick add">
                  <ShoppingCart className="w-4 h-4" />
                </button>
              </div>
            </Reveal>
          ))}
          {deals.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8">Loading today's best deals…</div>}
        </div>
      </section>


      {/* ============ SHOP BY CATEGORY — image mosaic ============ */}
      <section className="container mx-auto px-4">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1.5">Explore every aisle</h2>
          <p className="text-xs text-muted-foreground mb-5">{hero ? `${hero.total_products} products · ${hero.categories} categories` : 'Loading catalog…'}</p>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.id} delay={i * 40} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
              <Link to={`/category/${c.id}`} className={`group relative block overflow-hidden rounded-2xl border border-border card-lift ${i === 0 ? 'h-full min-h-[280px]' : 'h-36'}`}>
                <img src={c.img} alt={c.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white font-bold text-sm leading-tight">{c.name}</p>
                  <p className={`text-white/70 text-[10px] mt-0.5 ${i === 0 ? 'block' : 'hidden group-hover:block'}`}>{c.desc}</p>
                  <p className="text-primary text-[11px] font-bold mt-1">{catCount(c.id)} items →</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ TRENDING NOW — rank rail ============ */}
      <section className="container mx-auto px-4">
        <Reveal>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary"><TrendingUp className="w-5 h-5" /></span>
                Trending Now
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5">What India is buying this week</p>
            </div>
          </div>
        </Reveal>
        <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-4 px-4">
          {trending.map((t, i) => (
            <div key={t.id} className="snap-start shrink-0 w-44 md:w-52">
              <div className="relative bg-card border border-border rounded-2xl overflow-hidden card-lift">
                {i < 3 && <span className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-black text-xs font-black flex items-center justify-center shadow-lg">#{i + 1}</span>}
                <Link to={`/product/${t.id}`}>
                  <div className="aspect-square overflow-hidden bg-gradient-to-br from-primary/10 via-muted/40 to-fuchsia-500/10">
                    <img src={imageUrl(t.id)} onError={onImgError} alt={t.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold line-clamp-1">{t.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-black text-primary">{formatINR(t.discounted_price)}</span>
                      {t.discount_percent > 0 && <span className="text-[10px] text-green-400 font-bold">{t.discount_percent}% off</span>}
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          ))}
          {trending.length === 0 && <div className="text-muted-foreground py-8">Loading trending picks…</div>}
        </div>
      </section>

      {/* ============ RECENTLY VIEWED ============ */}
      {recentlyViewed.length > 0 && (
        <section className="container mx-auto px-4">
          <Reveal>
            <h2 className="text-xl font-black tracking-tight mb-4 flex items-center gap-2">⏱️ Recently viewed by you</h2>
          </Reveal>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {recentlyViewed.map((r) => (
              <Link key={r.id} to={`/product/${r.id}`} className="shrink-0 w-32 bg-card border border-border rounded-xl p-2.5 card-lift">
                <img src={imageUrl(r.id)} onError={onImgError} alt={r.name} loading="lazy" className="w-full aspect-square object-cover rounded-lg mb-2" />
                <p className="text-xs font-medium line-clamp-1">{r.name}</p>
                <p className="text-xs font-bold text-primary">{formatINR(r.price)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============ TRUST STRIP ============ */}
      <section className="container mx-auto px-4">
        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <Truck className="w-5 h-5" />, t: 'Free shipping', s: 'On orders ₹499+' },
              { icon: <ShieldCheck className="w-5 h-5" />, t: 'Razorpay secure', s: 'PCI-DSS payments' },
              { icon: <RotateCcw className="w-5 h-5" />, t: '7-day returns', s: 'No-questions refunds' },
              { icon: <BadgePercent className="w-5 h-5" />, t: '5% bundle OFF', s: 'On 2+ items' },
            ].map((x) => (
              <div key={x.t} className="glass rounded-2xl border border-white/10 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">{x.icon}</div>
                <div><p className="text-sm font-bold">{x.t}</p><p className="text-[11px] text-muted-foreground">{x.s}</p></div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </div>
  );
}
