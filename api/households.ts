import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { caretakersTable, householdsTable } from '../src/db/schema';
import { verifyAuth } from './_auth';

function getDb() {
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  return drizzle(sql);
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
  const db = getDb();

  try {
    // GET /api/households — Fetch household info and its caretakers
    if (req.method === 'GET') {
      // Ensure household exists
      const [household] = await db
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.familyPackId, householdId));

      const caretakers = await db
        .select()
        .from(caretakersTable)
        .where(eq(caretakersTable.householdId, householdId));

      return res.status(200).json({
        id: household?.id || householdId,
        familyPackId: householdId,
        name: household?.name || 'My Household',
        caretakers,
      });
    }

    // POST /api/households — Create/upsert household or add a caretaker
    if (req.method === 'POST') {
      const body = req.body || {};

      // If body has caretaker fields, add a caretaker
      if (body.name && body.role) {
        const id = body.id || `car-${Date.now()}`;

        const [existing] = await db
          .select()
          .from(caretakersTable)
          .where(eq(caretakersTable.id, id));

        if (existing) {
          return res.status(200).json(existing);
        }

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

      // Otherwise, create/upsert the household itself
      const [existing] = await db
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.familyPackId, householdId));

      if (!existing) {
        const [created] = await db
          .insert(householdsTable)
          .values({
            id: `hh-${Date.now()}`,
            familyPackId: householdId,
            name: body.householdName || 'My Household',
          })
          .returning();
        return res.status(201).json(created);
      }

      return res.status(200).json(existing);
    }

    // DELETE /api/households?caretakerId=xxx — Remove a caretaker
    if (req.method === 'DELETE') {
      const id = (req.query.caretakerId as string) || req.body?.id;
      if (!id) return res.status(400).json({ error: 'caretakerId is required' });

      await db.delete(caretakersTable).where(eq(caretakersTable.id, id));
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/households error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
