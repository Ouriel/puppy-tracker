import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, isNull } from 'drizzle-orm';
import { puppiesTable } from '../src/db/schema.js';
import { DogInputSchema, parseDeleteId } from '../src/utils/schemas.js';
import { verifyAuth, sendAuthError, setCorsHeaders, canDeleteHouseholdData } from './_auth.js';
import { getDatabaseUrl } from './_db.js';

const connectionString = getDatabaseUrl();
const sql = neon(connectionString);
const db = drizzle(sql);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (error: unknown) {
    return sendAuthError(res, error);
  }

  const householdId = auth.householdId;

  try {
    // GET /api/dogs: a deleted dog (deleted_at set) is never returned
    if (req.method === 'GET') {
      const dogId = req.query.id as string;
      if (dogId) {
        const [dog] = await db
          .select()
          .from(puppiesTable)
          .where(and(eq(puppiesTable.id, dogId), eq(puppiesTable.householdId, householdId), isNull(puppiesTable.deletedAt)));
        if (!dog) return res.status(404).json({ error: 'Dog not found' });
        return res.status(200).json(dog);
      }
      const dogs = await db
        .select()
        .from(puppiesTable)
        .where(and(eq(puppiesTable.householdId, householdId), isNull(puppiesTable.deletedAt)));
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

      // A deleted dog is not edited (its id stays taken): the owner restores it first
      if (existing?.deletedAt) return res.status(404).json({ error: 'Dog not found' });

      if (existing) {
        const [updated] = await db
          .update(puppiesTable)
          .set({
            name: body.name,
            breed: body.breed,
            birthDate: body.birthDate,
            dailyFoodGramGoal: body.dailyFoodGramGoal ?? existing.dailyFoodGramGoal,
            targetMealsPerDay: body.targetMealsPerDay ?? existing.targetMealsPerDay,
            notes: body.notes ?? existing.notes,
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
          // No weight_kg: a new dog stores none (it used to get a made-up 4.5 kg); its weight is its weight events
          dailyFoodGramGoal: body.dailyFoodGramGoal ?? 200,
          targetMealsPerDay: body.targetMealsPerDay ?? 3,
          notes: body.notes || '',
          gender: body.gender || null,
          expectedAdultWeightKg: body.expectedAdultWeightKg || null,
        })
        .returning();
      return res.status(201).json(created);
    }

    // PUT /api/dogs?id=xxx&restore=true: the owner brings a deleted dog back, with its logs and health records
    if (req.method === 'PUT' && req.query.restore === 'true') {
      if (!canDeleteHouseholdData(auth)) {
        return res.status(403).json({ error: 'Only the owner can restore dogs' });
      }
      const restoreParsed = parseDeleteId(req);
      if (!restoreParsed.success) return res.status(400).json({ error: 'Valid id is required' });

      const [restored] = await db
        .update(puppiesTable)
        .set({ deletedAt: null })
        .where(and(eq(puppiesTable.id, restoreParsed.data.id), eq(puppiesTable.householdId, householdId)))
        .returning();
      if (!restored) return res.status(404).json({ error: 'Dog not found' });
      return res.status(200).json(restored);
    }

    // PUT /api/dogs
    if (req.method === 'PUT') {
      const parsed = DogInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid dog payload', details: parsed.error.issues });
      }
      const { id, dailyFoodGramGoal, targetMealsPerDay, ...rest } = parsed.data;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const [updated] = await db
        .update(puppiesTable)
        .set({
          ...rest,
          ...(dailyFoodGramGoal !== undefined ? { dailyFoodGramGoal: Number(dailyFoodGramGoal) } : {}),
          ...(targetMealsPerDay !== undefined ? { targetMealsPerDay: Number(targetMealsPerDay) } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(puppiesTable.id, id), eq(puppiesTable.householdId, householdId), isNull(puppiesTable.deletedAt)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Dog not found' });
      return res.status(200).json(updated);
    }

    // DELETE /api/dogs: hides the dog (deleted_at), keeps its logs and health records; the owner can restore it
    if (req.method === 'DELETE') {
      if (!canDeleteHouseholdData(auth)) {
        return res.status(403).json({ error: 'Only the owner can delete dogs' });
      }

      const deleteParsed = parseDeleteId(req);
      if (!deleteParsed.success) return res.status(400).json({ error: 'Valid id is required' });
      const deleteId = deleteParsed.data.id;

      await db
        .update(puppiesTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(puppiesTable.id, deleteId), eq(puppiesTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: deleteId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    console.error('API /api/dogs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
