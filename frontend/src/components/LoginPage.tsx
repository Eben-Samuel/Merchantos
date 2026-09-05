import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../App';
import { LogIn, User, Shield, Store } from 'lucide-react';

const SAMPLE_USERS = [
  { username: 'admin', password: 'admin123', name: 'Store Admin', role: 'admin', icon: Shield, color: 'text-red-400', desc: 'Full access to analytics, products & orders' },
  { username: 'user', password: 'user123', name: 'Rahul Sharma', role: 'user', icon: User, color: 'text-blue-400', desc: 'Shop, chat with AI, track orders' },
  { username: 'seller', password: 'seller123', name: 'Sunrise Traders', role: 'seller', icon: Store, color: 'text-green-400', desc: 'List & manage your products' },
];

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post<{ token: string; user: any }>('/auth/login', { username, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: typeof SAMPLE_USERS[0]) => {
    setUsername(u.username);
    setPassword(u.password);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your Merchantos account</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" required />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" /> {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Sample accounts */}
        <div className="mt-6">
          <p className="text-center text-sm text-muted-foreground mb-3">Quick login with sample accounts</p>
          <div className="space-y-2">
            {SAMPLE_USERS.map((u) => {
              const Icon = u.icon;
              return (
                <button key={u.username} onClick={() => quickLogin(u)} className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-all text-left">
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${u.color}`}><Icon className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-muted-foreground">{u.username}</p>
                    <p className="text-xs text-muted-foreground">•••••••</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">Password shown in the field after clicking</p>
        </div>
      </div>
    </div>
  );
}