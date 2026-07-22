import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { puppiesTable } from '../src/db/schema';

function getDb() {
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  return drizzle(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Household-ID');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const householdId = (req.headers['x-household-id'] as string) || 'FAMILY-COCKER-2026';
  const db = getDb();

  try {
    // GET /api/dogs — List all dogs for household, or fetch one by id
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

    // POST /api/dogs — Create or upsert a dog profile
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name || !body.breed) {
        return res.status(400).json({ error: 'name and breed are required' });
      }

      const id = body.id || `dog-${Date.now()}`;

      // Check if already exists (upsert)
      const [existing] = await db
        .select()
        .from(puppiesTable)
        .where(eq(puppiesTable.id, id));

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
          .where(eq(puppiesTable.id, id))
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

    // PUT /api/dogs — Update a dog profile
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

    // DELETE /api/dogs?id=xxx — Delete a dog profile
    if (req.method === 'DELETE') {
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
