const { seedDatabase } = require('./dist/db/seed');
const { getDb } = require('./dist/config/database');
(async () => {
  await seedDatabase();
  const db = await getDb();
  const row = await db.get('SELECT COUNT(*) c FROM products');
  const stand = await db.get("SELECT COUNT(*) c FROM products WHERE id = 'p_laptop_stand_01'");
  console.log('total', row.c, '| laptop_stand', stand.c);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });