import dotenv from 'dotenv';
import { initDb, getDb } from './config/database';
import { seedDatabase } from './db/seed';
import { seedDemoTransactions } from './db/demoSeeds';
import cors from 'cors';
import express from 'express';
import path from 'path';
import catalogRoutes from './routes/catalog';
import chatRoutes from './routes/chat';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/order';
import paymentRoutes from './routes/payment';
import webhookRoutes from './routes/webhook';
import analyticsRoutes from './routes/analytics';
import policyRoutes from './routes/policies';
import demoRoutes from './routes/demo';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || '*' : 'http://localhost:5173', credentials: true }));
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MERCHANTOS AI' }));
app.use('/api/catalog', catalogRoutes); app.use('/api/chat', chatRoutes); app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes); app.use('/api/payment', paymentRoutes); app.use('/api/webhooks', webhookRoutes);
app.use('/api/analytics', analyticsRoutes); app.use('/api/policies', policyRoutes); app.use('/api/demo', demoRoutes);
app.use('/api/auth', authRoutes);
app.use((err: any, _req: any, res: any, _next: any) => { console.error('[ERROR]', err.message || err); res.status(err.status || 500).json({ error: err.message || 'Internal server error' }); });

// Serve the built frontend (npm run build in /frontend outputs to ../backend/public)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (_req: any, res: any) => {
  if (_req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(publicDir, 'index.html'), (err: any) => { if (err) res.status(404).send('Frontend not built. Run: cd frontend && npm run build'); });
});

async function start() {
  await initDb(); console.log('[DB] Database connected');
  const db = await getDb();
  const count = await db.get('SELECT COUNT(*) as c FROM products');
  if (count.c === 0) { await seedDatabase(); console.log('[SEED] Products loaded'); }
  await seedDemoTransactions(db); console.log('[SEED] Demo transactions loaded');
  app.listen(PORT, () => { console.log(`[SERVER] MERCHANTOS AI backend on port ${PORT}`); });
}
start().catch((err) => { console.error('[FATAL]', err); process.exit(1); });
export default app;
