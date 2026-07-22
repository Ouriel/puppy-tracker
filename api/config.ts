import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Lightweight config table for household-level settings (OAuth keys, etc.)
const configTable = pgTable('household_config', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

function getDb() {
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  return drizzle(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Household-ID');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const householdId = (req.headers['x-household-id'] as string) || 'FAMILY-COCKER-2026';
  const db = getDb();

  try {
    // Ensure the config table exists (idempotent create)
    const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
    await sql`CREATE TABLE IF NOT EXISTS household_config (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

    // GET /api/config?key=google_client_id — Fetch a config value
    if (req.method === 'GET') {
      const key = req.query.key as string;
      if (!key) return res.status(400).json({ error: 'key query parameter is required' });

      const [row] = await db
        .select()
        .from(configTable)
        .where(eq(configTable.key, key));

      return res.status(200).json({
        key,
        value: row?.value || null,
      });
    }

    // POST /api/config — Save a config key-value pair (super admin only)
    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key || typeof value !== 'string') {
        return res.status(400).json({ error: 'key and value are required' });
      }

      const id = `cfg-${householdId}-${key}`;

      const [existing] = await db
        .select()
        .from(configTable)
        .where(eq(configTable.id, id));

      if (existing) {
        await db
          .update(configTable)
          .set({ value, updatedAt: new Date() })
          .where(eq(configTable.id, id));
      } else {
        await db
          .insert(configTable)
          .values({ id, householdId, key, value });
      }

      return res.status(200).json({ success: true, key, value });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/config error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
