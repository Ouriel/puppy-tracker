import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc } from 'drizzle-orm';
import { activitiesTable } from '../src/db/schema';
import { verifyAuth } from './_auth';
import { z } from 'zod';

const ActivitySchema = z.object({
  id: z.string().optional(),
  puppyId: z.string().min(1, 'puppyId is required'),
  type: z.enum(['pee', 'poop', 'food', 'walk', 'weight', 'medication']),
  timestamp: z.string().optional(),
  loggedBy: z.string().optional(),
  pottyLocation: z.string().nullable().optional(),
  stoolConsistency: z.string().nullable().optional(),
  foodType: z.string().nullable().optional(),
  quantityGrams: z.number().or(z.string()).nullable().optional(),
  quantityCups: z.number().or(z.string()).nullable().optional(),
  durationMinutes: z.number().or(z.string()).nullable().optional(),
  weightKg: z.number().or(z.string()).nullable().optional(),
  medicationName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

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
    // GET /api/activities
    if (req.method === 'GET') {
      const puppyId = req.query.puppyId as string;
      const conditions = puppyId
        ? and(eq(activitiesTable.householdId, householdId), eq(activitiesTable.puppyId, puppyId))
        : eq(activitiesTable.householdId, householdId);

      const activities = await db
        .select()
        .from(activitiesTable)
        .where(conditions)
        .orderBy(desc(activitiesTable.timestamp));
      return res.status(200).json(activities);
    }

    // POST /api/activities
    if (req.method === 'POST') {
      const parsed = ActivitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid activity payload', details: parsed.error.issues });
      }

      const body = parsed.data;
      const id = body.id || `act-${Date.now()}`;

      const [existing] = await db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, id));

      if (existing) {
        return res.status(200).json(existing);
      }

      const [created] = await db
        .insert(activitiesTable)
        .values({
          id,
          householdId,
          puppyId: body.puppyId,
          type: body.type,
          timestamp: body.timestamp || new Date().toISOString(),
          loggedBy: body.loggedBy || 'Caretaker',
          pottyLocation: body.pottyLocation || null,
          stoolConsistency: body.stoolConsistency || null,
          foodType: body.foodType || null,
          quantityGrams: body.quantityGrams ? Number(body.quantityGrams) : null,
          quantityCups: body.quantityCups ? Number(body.quantityCups) : null,
          durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : null,
          weightKg: body.weightKg ? Number(body.weightKg) : null,
          medicationName: body.medicationName || null,
          notes: body.notes || null,
        })
        .returning();
      return res.status(201).json(created);
    }

    // DELETE /api/activities
    if (req.method === 'DELETE') {
      const actId = (req.query.id as string) || req.body?.id;
      if (!actId) return res.status(400).json({ error: 'id is required' });

      await db
        .delete(activitiesTable)
        .where(and(eq(activitiesTable.id, actId), eq(activitiesTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: actId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/activities error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
