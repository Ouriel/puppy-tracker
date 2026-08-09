import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { caretakersTable, householdsTable } from '../src/db/schema.js';
import { verifyAuth } from './_auth.js';
import { z } from 'zod';

const CaretakerInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role is required'),
  color: z.string().optional(),
  email: z.string().email('Invalid email format').nullable().optional().or(z.literal('')),
});

function getDb() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  const sql = neon(connectionString);
  return drizzle(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : 'https://puppace.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=60');
      const [household] = await db
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.id, householdId));

      const caretakers = await db
        .select()
        .from(caretakersTable)
        .where(eq(caretakersTable.householdId, householdId));

      return res.status(200).json({
        household: household || { id: householdId, familyPackId: (auth as any).familyPackId, name: 'Family Pack' },
        caretakers,
      });
    }

    // POST /api/households — Add a new caretaker
    if (req.method === 'POST') {
      const parsed = CaretakerInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid caretaker payload', details: parsed.error.issues });
      }
      const body = parsed.data;

      const id = body.id || `ct-${Date.now()}`;
      const color = body.color || 'bg-amber-500';

      const [created] = await db
        .insert(caretakersTable)
        .values({
          id,
          householdId,
          name: body.name,
          role: body.role,
          color,
          email: body.email || null,
        })
        .returning();

      return res.status(201).json(created);
    }

    // PUT /api/households — Update an existing caretaker
    if (req.method === 'PUT') {
      const parsed = CaretakerInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid caretaker payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      if (!body.id) return res.status(400).json({ error: 'caretaker id is required' });

      const [updated] = await db
        .update(caretakersTable)
        .set({
          name: body.name,
          role: body.role,
          ...(body.color ? { color: body.color } : {}),
          ...(body.email !== undefined ? { email: body.email || null } : {}),
        })
        .where(and(eq(caretakersTable.id, body.id), eq(caretakersTable.householdId, householdId)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Caretaker not found' });
      return res.status(200).json(updated);
    }

    // DELETE /api/households?caretakerId=xxx — Remove a caretaker
    if (req.method === 'DELETE') {
      const caretakerId = (req.query.caretakerId as string) || req.body?.caretakerId;
      if (!caretakerId) return res.status(400).json({ error: 'caretakerId is required' });

      await db
        .delete(caretakersTable)
        .where(and(eq(caretakersTable.id, caretakerId), eq(caretakersTable.householdId, householdId)));

      return res.status(200).json({ success: true, deletedId: caretakerId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/households error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
