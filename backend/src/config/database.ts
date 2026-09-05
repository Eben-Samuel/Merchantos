import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { SCHEMA_SQL } from './schema';

dotenv.config();
let dbInstance: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function initDb(): Promise<Database<any, any>> {
  if (dbInstance) return dbInstance;
  const dbPath = process.env.DATABASE_PATH || './data/merchantos.db';
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  dbInstance = await open({ filename: dbPath, driver: sqlite3.Database });
  await dbInstance.exec(SCHEMA_SQL);
  await dbInstance.run(
    `INSERT OR IGNORE INTO merchants (id, name, email, timezone, currency) VALUES (?, ?, ?, ?, ?)`,
    'm1', 'Demo Merchant', 'merchant@example.com', 'Asia/Kolkata', 'INR'
  );
  return dbInstance;
}

export async function getDb(): Promise<Database<any, any>> {
  if (!dbInstance) return initDb();
  return dbInstance;
}

export async function resetDb(): Promise<void> {
  if (!dbInstance) throw new Error('Database not initialized');
  const tables: any[] = await dbInstance.all(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  );
  for (const { name } of tables) await dbInstance.run(`DELETE FROM ${name}`);
}
