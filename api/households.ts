import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { caretakersTable, householdsTable } from '../src/db/schema.js';
import { verifyAuth } from './_auth.js';

function getDbAndSql() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  const sql = neon(connectionString);
  const db = drizzle(sql);
  return { db, sql };
}

let tablesChecked = false;

async function ensureTables(sql: ReturnType<typeof neon>) {
  if (tablesChecked) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS households (
        id TEXT PRIMARY KEY,
        family_pack_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS caretakers (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        color TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    tablesChecked = true;
  } catch (e) {
    console.error('Error ensuring households/caretakers tables exist:', e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : 'https://puppace.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (err: any) {
    return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }

  const householdId = auth.householdId;
  const { db, sql } = getDbAndSql();

  if (req.method === 'POST') {
    await ensureTables(sql);
  }

  try {
    // GET /api/households — Fetch household info and its caretakers
    if (req.method === 'GET') {
      const caretakers = await db
        .select()
        .from(caretakersTable)
        .where(eq(caretakersTable.householdId, householdId));

      return res.status(200).json({
        id: householdId,
        familyPackId: householdId,
        name: 'My Household',
        caretakers,
      });
    }

    // POST /api/households — Create/upsert a caretaker
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'name is required' });

      const id = body.id || `car-${Date.now()}`;

      const [created] = await db
        .insert(caretakersTable)
        .values({
          id,
          householdId,
          name: body.name,
          role: body.role || 'Member',
          color: body.color || '#6366F1',
          email: body.email || null,
        })
        .returning();
      return res.status(201).json(created);
    }

    // DELETE /api/households?caretakerId=xxx — Remove a caretaker
    if (req.method === 'DELETE') {
      const id = (req.query.caretakerId as string) || req.body?.id;
      if (!id) return res.status(400).json({ error: 'caretakerId is required' });

      await db
        .delete(caretakersTable)
        .where(and(eq(caretakersTable.id, id), eq(caretakersTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/households error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
