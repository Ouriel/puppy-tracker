import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { puppiesTable } from '../src/db/schema.js';
import { DogInputSchema, DeleteSchema } from '../src/utils/schemas.js';
import { verifyAuth, setCorsHeaders } from './_auth.js';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const sql = neon(connectionString);
const db = drizzle(sql);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (err: unknown) {
    const status = (err && typeof err === 'object' && 'status' in err) ? (err as { status: number }).status : 500;
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Internal server error';
    return res.status(status).json({ error: message });
  }

  const householdId = auth.householdId;

  try {
    // GET /api/dogs
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=60');
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
      if (auth.role !== 'Admin' && auth.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Only admins can manage dog profiles' });
      }
      const parsed = DogInputSchema.safeParse(req.body);
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
            gender: body.gender ?? existing.gender,
            expectedAdultWeightKg: body.expectedAdultWeightKg ?? existing.expectedAdultWeightKg,
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
          breed: body.breed || 'Unknown',
          birthDate: body.birthDate || new Date().toISOString().slice(0, 10),
          weightKg: Number(body.weightKg) || 4.5,
          dailyFoodGramGoal: Number(body.dailyFoodGramGoal) || 200,
          targetMealsPerDay: Number(body.targetMealsPerDay) || 3,
          notes: body.notes || '',
          avatarUrl: body.avatarUrl || '',
          gender: body.gender || null,
          expectedAdultWeightKg: body.expectedAdultWeightKg || null,
        })
        .returning();
      return res.status(201).json(created);
    }

    // PUT /api/dogs
    if (req.method === 'PUT') {
      if (auth.role !== 'Admin' && auth.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Only admins can manage dog profiles' });
      }
      const parsed = DogInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid dog payload', details: parsed.error.issues });
      }
      const { id, weightKg, dailyFoodGramGoal, targetMealsPerDay, ...rest } = parsed.data;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const [updated] = await db
        .update(puppiesTable)
        .set({
          ...rest,
          ...(weightKg !== undefined ? { weightKg: Number(weightKg) } : {}),
          ...(dailyFoodGramGoal !== undefined ? { dailyFoodGramGoal: Number(dailyFoodGramGoal) } : {}),
          ...(targetMealsPerDay !== undefined ? { targetMealsPerDay: Number(targetMealsPerDay) } : {}),
          updatedAt: new Date(),
        })
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

      const rawId = (typeof req.query.id === 'string' && req.query.id) || (req.body && typeof req.body === 'object' && req.body.id);
      const deleteParsed = DeleteSchema.safeParse({ id: rawId });
      if (!deleteParsed.success) return res.status(400).json({ error: 'Valid id is required' });
      const deleteId = deleteParsed.data.id;

      await db
        .delete(puppiesTable)
        .where(and(eq(puppiesTable.id, deleteId), eq(puppiesTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: deleteId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/dogs error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
