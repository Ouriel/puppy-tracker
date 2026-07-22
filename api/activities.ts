import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc } from 'drizzle-orm';
import { activitiesTable } from '../src/db/schema';

function getDb() {
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  return drizzle(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Household-ID');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const householdId = (req.headers['x-household-id'] as string) || 'FAMILY-COCKER-2026';
  const db = getDb();

  try {
    // GET /api/activities — List activities for household, optionally filtered by puppyId
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

    // POST /api/activities — Log a new activity
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.puppyId || !body.type) {
        return res.status(400).json({ error: 'puppyId and type are required' });
      }

      const id = body.id || `act-${Date.now()}`;

      // Upsert: skip if this exact activity id already exists
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

    // DELETE /api/activities?id=xxx — Delete an activity log
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
