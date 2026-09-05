import { getDb } from '../config/database';
import { generateId, now } from '../utils/helpers';
import { rawProducts1a } from './products/data1a';
import { rawProducts1b } from './products/data1b';
import { rawProducts1c } from './products/data1c';
import { rawProducts2a } from './products/data2a';
import { rawProducts2b } from './products/data2b';
import { rawProducts3 } from './products/data3';
import { rawProducts4 } from './products/data4';
import { rawProducts5 } from './products/data5';
import { rawProducts6 } from './products/data6';
import { defaultPolicies } from './policies';

// Raw product interface (compact format)
interface RawProduct {
  id: string; n: string; d: string; c: string;
  p: number; dc: number; s: number;
  a: Record<string, any>; t: string;
  cp: string; fb: string;
  u: string; sg: string; sc: number;
}

// Normalize raw product to database format
function normalizeProduct(rp: RawProduct) {
  return {
    id: rp.id,
    name: rp.n,
    description: rp.d,
    category: rp.c,
    price: rp.p,
    discount_percent: rp.dc,
    stock: rp.s,
    attributes_json: JSON.stringify(rp.a),
    variants_json: JSON.stringify([]),
    tags: rp.t,
    compatible_products: rp.cp,
    frequently_bought_together: rp.fb,
    target_use_cases: rp.u,
    customer_segments: rp.sg,
    merchant_rule_json: JSON.stringify({}),
    ai_readiness_score: rp.sc,
    created_at: now(),
    updated_at: now(),
  };
}

const allRawProducts = [
  ...rawProducts1a, ...rawProducts1b, ...rawProducts1c,
  ...rawProducts2a, ...rawProducts2b,
  ...rawProducts3, ...rawProducts4,
  ...rawProducts5, ...rawProducts6,
];

export const seededProducts = allRawProducts.map(normalizeProduct);

export async function seedDatabase() {
  const db = await getDb();
  await db.run('BEGIN');
  try {
    for (const p of seededProducts) {
      await db.run(
        `INSERT OR REPLACE INTO products (id, name, description, category, price, discount_percent, stock, attributes_json, variants_json, tags, compatible_products, frequently_bought_together, target_use_cases, customer_segments, merchant_rule_json, ai_readiness_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.name, p.description, p.category, p.price, p.discount_percent, p.stock,
        p.attributes_json, p.variants_json, p.tags, p.compatible_products,
        p.frequently_bought_together, p.target_use_cases, p.customer_segments,
        p.merchant_rule_json, p.ai_readiness_score, p.created_at, p.updated_at
      );
    }
    for (const pol of defaultPolicies) {
      await db.run(
        `INSERT OR REPLACE INTO policies (id, key, value, description, category, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        generateId('pol'), pol.key, pol.value, pol.description, pol.category, now()
      );
    }
    await db.run('COMMIT');
    console.log(`[SEED] ${seededProducts.length} products, ${defaultPolicies.length} policies loaded`);
  } catch (err) {
    await db.run('ROLLBACK');
    console.error('[SEED] Error:', err);
    throw err;
  }
}
