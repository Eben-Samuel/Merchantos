import { Router } from 'express';
import { asyncHandler } from '../utils/helpers';
import { resetDb, initDb } from '../config/database';
import { seedDatabase } from '../db/seed';
import { seedDemoTransactions } from '../db/demoSeeds';

const router = Router();

/** POST /api/demo/seed — Seed demo data */
router.post('/seed', asyncHandler(async (req, res) => {
  const db = await initDb();
  const count = await db.get('SELECT COUNT(*) as c FROM products');
  if (count.c === 0) await seedDatabase();
  await seedDemoTransactions(db);
  res.json({ message: 'Demo data seeded', products: (await db.get('SELECT COUNT(*) as c FROM products')).c, orders: (await db.get('SELECT COUNT(*) as c FROM orders')).c });
}));

/** POST /api/demo/reset — Reset database */
router.post('/reset', asyncHandler(async (_req, res) => {
  await resetDb(); await seedDatabase();
  const db = await initDb(); await seedDemoTransactions(db);
  res.json({ message: 'Database reset and reseeded' });
}));

/** POST /api/demo/start — One-click demo start */
router.post('/start', asyncHandler(async (_req, res) => {
  await resetDb(); await seedDatabase();
  const db = await initDb(); await seedDemoTransactions(db);
  res.json({ message: 'Demo started', demo_mode: true, instructions: 'Use /api/chat/start to begin' });
}));

export default router;
