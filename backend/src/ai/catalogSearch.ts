import { getDb } from '../config/database';
import { Product, Recommendation } from '../types';

/**
 * CatalogAgent — Searches and retrieves products from the catalog.
 * Provides text search, filtering, and inventory checking.
 */

/** Build a case/slug-insensitive SQL category filter.
 *  Accepts "electronics", "Electronics", "home-kitchen", "Home & Kitchen", etc. */
function categoryFilter(category: string): { sql: string; values: string[] } {
  const raw = category.trim().toLowerCase().replace(/\s+/g, ' ');
  const variants = new Set<string>([raw, raw.replace(/-/g, ' '), raw.replace(/_/g, ' ')]);
  // Common alias expansions
  if (variants.has('home kitchen') || variants.has('home-kitchen') || variants.has('home and kitchen')) {
    variants.add('home & kitchen'); variants.add('home and kitchen'); variants.add('kitchen');
  }
  if (variants.has('electronics')) variants.add('electronics & gadgets');
  const list = Array.from(variants).map((v) => v.trim()).filter(Boolean);
  return { sql: `LOWER(category) IN (${list.map(() => '?').join(',')})`, values: list };
}

export class CatalogAgent {
  private lastWordCount = 0;

  async searchProducts(params: {
    search?: string;
    category?: string;
    maxPrice?: number;
    inStock?: boolean;
    tags?: string;
    limit?: number;
  }): Promise<Product[]> {
    const db = await getDb();
    const conditions: string[] = [];
    const values: any[] = [];

    // Text search across name, description, tags (word-level: all words must match somewhere)
    if (params.search) {
      const words = params.search.toLowerCase().split(/[^a-z0-9]+/).map(w => w.trim()).filter(w => w.length > 1);
      if (words.length > 0) {
        const wordConds = words.map(() => `(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)`);
        conditions.push(`(${wordConds.join(' AND ')})`);
        for (const w of words) values.push(`%${w}%`, `%${w}%`, `%${w}%`);
        this.lastWordCount = words.length;
      }
    }

    // Category filter — accept slug ("home-kitchen"), label ("Home & Kitchen"), or any case variant
    if (params.category) {
      const cf = categoryFilter(params.category);
      conditions.push(cf.sql);
      values.push(...cf.values);
    }

    if (params.maxPrice) {
      conditions.push(`price <= ?`);
      values.push(params.maxPrice);
    }

    if (params.inStock) {
      conditions.push(`stock > 0`);
    }

    if (params.tags) {
      const tagLower = params.tags.toLowerCase();
      conditions.push(`LOWER(tags) LIKE ?`);
      values.push(`%${tagLower}%`);
    }

    conditions.push(`is_active = 1`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;

    let rows = await db.all(
      `SELECT * FROM products ${whereClause} ORDER BY ai_readiness_score DESC, price LIMIT ?`,
      ...values, limit
    );

    // Progressive relaxation: if strict AND matched nothing, retry with one word dropped
    // (tries dropping each search word in turn before falling back to OR)
    if (rows.length === 0 && params.search && this.lastWordCount > 1) {
      const words = params.search.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
      const catCond = params.category ? ` AND ${categoryFilter(params.category).sql}` : '';
      const catVals = params.category ? categoryFilter(params.category).values : [];
      for (let drop = words.length - 1; drop >= 0 && rows.length === 0; drop--) {
        const kept = words.filter((_, i) => i !== drop);
        if (kept.length === 0) break;
        const conds = kept.map(() => `(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)`);
        const vals: any[] = [];
        for (const w of kept) vals.push(`%${w}%`, `%${w}%`, `%${w}%`);
        rows = await db.all(
          `SELECT * FROM products WHERE (${conds.join(' AND ')}) AND is_active = 1 ${catCond} ${params.maxPrice ? 'AND price <= ?' : ''} ORDER BY ai_readiness_score DESC, price LIMIT ?`,
          ...vals, ...catVals, ...(params.maxPrice ? [params.maxPrice] : []), limit
        );
      }
    }

    // OR-fallback when strict multi-word AND matched nothing (any single word match)
    if (rows.length === 0 && params.search && this.lastWordCount > 1) {
      const words = params.search.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
      const wordConds = words.map(() => `(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)`);
      const orValues: any[] = [];
      for (const w of words) orValues.push(`%${w}%`, `%${w}%`, `%${w}%`);
      const catCond = params.category ? ` AND ${categoryFilter(params.category).sql}` : '';
      const catVals = params.category ? categoryFilter(params.category).values : [];
      rows = await db.all(
        `SELECT * FROM products WHERE (${wordConds.join(' OR ')}) AND is_active = 1 ${catCond} ${params.maxPrice ? 'AND price <= ?' : ''} ORDER BY ai_readiness_score DESC, price LIMIT ?`,
        ...orValues, ...catVals, ...(params.maxPrice ? [params.maxPrice] : []), limit
      );
    }

    return rows.map(this.mapRowToProduct);
  }

  async getProduct(id: string): Promise<Product | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM products WHERE id = ?', id);
    return row ? this.mapRowToProduct(row) : null;
  }

  async checkInventory(productId: string): Promise<{ in_stock: boolean; stock: number }> {
    const product = await this.getProduct(productId);
    if (!product) return { in_stock: false, stock: 0 };
    return { in_stock: product.stock > 0, stock: product.stock };
  }

  async getCompatibleProducts(productId: string): Promise<Product[]> {
    const product = await this.getProduct(productId);
    if (!product || !product.compatible_products) return [];
    const ids = product.compatible_products.split(',').map(s => s.trim()).filter(Boolean);
    const db = await getDb();
    const rows = await db.all(
      `SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`,
      ...ids
    );
    return rows.map(this.mapRowToProduct);
  }

  async getFrequentlyBoughtTogether(productId: string): Promise<Product[]> {
    const product = await this.getProduct(productId);
    if (!product || !product.frequently_bought_together) return [];
    const ids = product.frequently_bought_together.split(',').map(s => s.trim()).filter(Boolean);
    const db = await getDb();
    const rows = await db.all(
      `SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`,
      ...ids
    );
    return rows.map(this.mapRowToProduct);
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return this.searchProducts({ category, limit: 100 });
  }

  private mapRowToProduct(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      price: row.price,
      discount_percent: row.discount_percent,
      stock: row.stock,
      attributes: row.attributes_json ? JSON.parse(row.attributes_json) : {},
      variants: row.variants_json ? JSON.parse(row.variants_json) : [],
      tags: row.tags || '',
      compatible_products: row.compatible_products || '',
      frequently_bought_together: row.frequently_bought_together || '',
      target_use_cases: row.target_use_cases || '',
      customer_segments: row.customer_segments || '',
      merchant_rule_json: row.merchant_rule_json || '{}',
      ai_readiness_score: row.ai_readiness_score || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const catalogAgent = new CatalogAgent();
