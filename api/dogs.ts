import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { puppiesTable } from '../src/db/schema.js';
import { verifyAuth } from './_auth.js';
import { z } from 'zod';

const DogSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  breed: z.string().min(1, 'Breed is required'),
  birthDate: z.string().optional(),
  weightKg: z.number().or(z.string()).optional(),
  dailyFoodGramGoal: z.number().or(z.string()).optional(),
  targetMealsPerDay: z.number().or(z.string()).optional(),
  notes: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
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
    // GET /api/dogs
    if (req.method === 'GET') {
      const dogId = req.query.id as string;
      if (dogId) {
        const [dog] = await db
          .select()
          .from(puppiesTable)
          .where(and(eq(puppiesTable.id, dogId), eq(puppiesTable.householdId, householdId)));
        if (!dog) return res.status(404).json({ error: 'Dog not found' });
        return res.status(200).json(dog);
      }
      const dogs = await db
        .select()
        .from(puppiesTable)
        .where(eq(puppiesTable.householdId, householdId));
      return res.status(200).json(dogs);
    }

    // POST /api/dogs
    if (req.method === 'POST') {
      const parsed = DogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid dog payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      const id = body.id || `dog-${Date.now()}`;

      const [existing] = await db
        .select()
        .from(puppiesTable)
        .where(and(eq(puppiesTable.id, id), eq(puppiesTable.householdId, householdId)));

      if (existing) {
        const [updated] = await db
          .update(puppiesTable)
          .set({
            name: body.name,
            breed: body.breed,
            birthDate: body.birthDate || existing.birthDate,
            weightKg: Number(body.weightKg) || existing.weightKg,
            dailyFoodGramGoal: Number(body.dailyFoodGramGoal) || existing.dailyFoodGramGoal,
            targetMealsPerDay: Number(body.targetMealsPerDay) || existing.targetMealsPerDay,
            notes: body.notes ?? existing.notes,
            avatarUrl: body.avatarUrl ?? existing.avatarUrl,
            updatedAt: new Date(),
          })
          .where(and(eq(puppiesTable.id, id), eq(puppiesTable.householdId, householdId)))
          .returning();
        return res.status(200).json(updated);
      }

      const [created] = await db
        .insert(puppiesTable)
        .values({
          id,
          householdId,
          name: body.name,
          breed: body.breed,
          birthDate: body.birthDate || new Date().toISOString().slice(0, 10),
          weightKg: Number(body.weightKg) || 4.5,
          dailyFoodGramGoal: Number(body.dailyFoodGramGoal) || 200,
          targetMealsPerDay: Number(body.targetMealsPerDay) || 3,
          notes: body.notes || '',
          avatarUrl: body.avatarUrl || '',
        })
        .returning();
      return res.status(201).json(created);
    }

    // PUT /api/dogs
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });

      const [updated] = await db
        .update(puppiesTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(puppiesTable.id, id), eq(puppiesTable.householdId, householdId)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Dog not found' });
      return res.status(200).json(updated);
    }

    // DELETE /api/dogs
    if (req.method === 'DELETE') {
      if (auth.role !== 'Admin' && auth.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Only admins can delete dogs' });
      }

      const dogId = (req.query.id as string) || req.body?.id;
      if (!dogId) return res.status(400).json({ error: 'id is required' });

      await db
        .delete(puppiesTable)
        .where(and(eq(puppiesTable.id, dogId), eq(puppiesTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: dogId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/dogs error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
