import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc } from 'drizzle-orm';
import { healthRecordsTable, puppiesTable } from '../src/db/schema.js';
import { verifyAuth, setCorsHeaders } from './_auth.js';
import { z } from 'zod';

const DeleteSchema = z.object({ id: z.string().min(1) });

const HealthRecordSchema = z.object({
  id: z.string().optional(),
  puppyId: z.string().min(1, 'puppyId is required'),
  type: z.string().min(1, 'type is required'),
  name: z.string().min(1, 'name is required'),
  date: z.string().min(1, 'date is required'),
  boosterDate: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  vetClinic: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  weightAtTime: z.number().or(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

function getDb() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  const sql = neon(connectionString);
  return drizzle(sql);
}

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
  const db = getDb();

  try {
    // GET /api/health-records?puppyId=xxx&type=xxx
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=60');
      const puppyId = req.query.puppyId as string;
      const type = req.query.type as string;

      if (!puppyId) return res.status(400).json({ error: 'puppyId is required' });

      const conditions = type
        ? and(eq(healthRecordsTable.householdId, householdId), eq(healthRecordsTable.puppyId, puppyId), eq(healthRecordsTable.type, type))
        : and(eq(healthRecordsTable.householdId, householdId), eq(healthRecordsTable.puppyId, puppyId));

      const records = await db
        .select()
        .from(healthRecordsTable)
        .where(conditions)
        .orderBy(desc(healthRecordsTable.date));
      return res.status(200).json(records);
    }

    // POST /api/health-records
    if (req.method === 'POST') {
      const parsed = HealthRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid health record payload', details: parsed.error.issues });
      }
      const body = parsed.data;

      // Verify puppy belongs to this household
      const [puppy] = await db
        .select()
        .from(puppiesTable)
        .where(and(eq(puppiesTable.id, body.puppyId), eq(puppiesTable.householdId, householdId)));
      if (!puppy) {
        return res.status(403).json({ error: 'Puppy not found in your household' });
      }

      const id = body.id || `hr-${Date.now()}`;

      const [created] = await db
        .insert(healthRecordsTable)
        .values({
          id,
          householdId,
          puppyId: body.puppyId,
          type: body.type,
          name: body.name,
          date: body.date,
          boosterDate: body.boosterDate || null,
          batchNumber: body.batchNumber || null,
          vetClinic: body.vetClinic || null,
          productName: body.productName || null,
          weightAtTime: body.weightAtTime ? Number(body.weightAtTime) : null,
          notes: body.notes || null,
        })
        .returning();
      return res.status(201).json(created);
    }

    // PUT /api/health-records
    if (req.method === 'PUT') {
      const parsed = HealthRecordSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid health record payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      if (!body.id) return res.status(400).json({ error: 'id is required' });

      const [updated] = await db
        .update(healthRecordsTable)
        .set({
          name: body.name,
          date: body.date,
          boosterDate: body.boosterDate || null,
          batchNumber: body.batchNumber || null,
          vetClinic: body.vetClinic || null,
          productName: body.productName || null,
          weightAtTime: body.weightAtTime ? Number(body.weightAtTime) : null,
          notes: body.notes || null,
        })
        .where(and(eq(healthRecordsTable.id, body.id), eq(healthRecordsTable.householdId, householdId)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Health record not found' });
      return res.status(200).json(updated);
    }

    // DELETE /api/health-records?id=xxx
    if (req.method === 'DELETE') {
      const rawId = (typeof req.query.id === 'string' && req.query.id) || (req.body && typeof req.body === 'object' && req.body.id);
      const deleteParsed = DeleteSchema.safeParse({ id: rawId });
      if (!deleteParsed.success) return res.status(400).json({ error: 'Valid id is required' });
      const deleteId = deleteParsed.data.id;

      await db
        .delete(healthRecordsTable)
        .where(and(eq(healthRecordsTable.id, deleteId), eq(healthRecordsTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: deleteId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/health-records error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
