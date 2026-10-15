import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { puppiesTable } from '../src/db/schema.js';
import { DogInputSchema, parseDeleteId } from '../src/utils/schemas.js';
import { verifyAuth, setCorsHeaders, canDeleteHouseholdData } from './_auth.js';

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
            birthDate: body.birthDate,
            weightKg: Number(body.weightKg) || existing.weightKg,
            dailyFoodGramGoal: body.dailyFoodGramGoal ?? existing.dailyFoodGramGoal,
            targetMealsPerDay: body.targetMealsPerDay ?? existing.targetMealsPerDay,
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
          breed: body.breed,
          birthDate: body.birthDate,
          weightKg: Number(body.weightKg) || 4.5,
          dailyFoodGramGoal: body.dailyFoodGramGoal ?? 200,
          targetMealsPerDay: body.targetMealsPerDay ?? 3,
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
      if (!canDeleteHouseholdData(auth)) {
        return res.status(403).json({ error: 'Only the owner can delete dogs' });
      }

      const deleteParsed = parseDeleteId(req);
      if (!deleteParsed.success) return res.status(400).json({ error: 'Valid id is required' });
      const deleteId = deleteParsed.data.id;

      await db
        .delete(puppiesTable)
        .where(and(eq(puppiesTable.id, deleteId), eq(puppiesTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: deleteId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    console.error('API /api/dogs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
