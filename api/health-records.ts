import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc } from 'drizzle-orm';
import { healthRecordsTable } from '../src/db/schema.js';
import { verifyAuth } from './_auth.js';

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
    // GET /api/health-records?puppyId=xxx&type=xxx
    if (req.method === 'GET') {
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
      const body = req.body || {};
      if (!body.puppyId || !body.type || !body.name || !body.date) {
        return res.status(400).json({ error: 'puppyId, type, name, and date are required' });
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

    // DELETE /api/health-records?id=xxx
    if (req.method === 'DELETE') {
      const id = (req.query.id as string) || req.body?.id;
      if (!id) return res.status(400).json({ error: 'id is required' });

      await db
        .delete(healthRecordsTable)
        .where(and(eq(healthRecordsTable.id, id), eq(healthRecordsTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/health-records error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
