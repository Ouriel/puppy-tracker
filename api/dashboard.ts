import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc, gte } from 'drizzle-orm';
import { activitiesTable, caretakersTable, puppiesTable, healthRecordsTable } from '../src/db/schema.js';
import { verifyAuth, setCorsHeaders } from './_auth.js';
import { z } from 'zod';

const DashboardQuerySchema = z.object({
  puppyId: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  days: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? 14 : Number(val)),
    z.number().int().min(1).max(90).catch(14)
  ),
});

// Module-level connection pooling to stay warm across invocations
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const sql = neon(connectionString);
const db = drizzle(sql);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (err: unknown) {
    const status = (err && typeof err === 'object' && 'status' in err) ? (err as { status: number }).status : 500;
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Internal server error';
    return res.status(status).json({ error: message });
  }

  const householdId = auth.householdId;
  res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=60');

  try {
    const queryParsed = DashboardQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: queryParsed.error.issues });
    }
    const { puppyId, days } = queryParsed.data;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let activitiesWhere = and(
      eq(activitiesTable.householdId, householdId),
      gte(activitiesTable.timestamp, cutoffDate)
    );

    if (puppyId) {
      activitiesWhere = and(activitiesWhere, eq(activitiesTable.puppyId, puppyId));
    }

    // Execute all 4 dashboard queries concurrently in parallel
    const [puppies, caretakers, rawActivities, healthRecords] = await Promise.all([
      db.select().from(puppiesTable).where(eq(puppiesTable.householdId, householdId)),
      db.select().from(caretakersTable).where(eq(caretakersTable.householdId, householdId)),
      db
        .select()
        .from(activitiesTable)
        .where(activitiesWhere)
        .orderBy(desc(activitiesTable.timestamp))
        .limit(300),
      db
        .select()
        .from(healthRecordsTable)
        .where(eq(healthRecordsTable.householdId, householdId))
        .orderBy(desc(healthRecordsTable.date)),
    ]);

    const formattedActivities = rawActivities.map((activity) => ({
      ...activity,
      timestamp: activity.timestamp instanceof Date ? activity.timestamp.toISOString() : new Date(activity.timestamp).toISOString(),
    }));

    return res.status(200).json({
      puppies,
      caretakers,
      activities: formattedActivities,
      healthRecords,
    });
  } catch (err) {
    console.error('Error fetching dashboard payload:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard payload' });
  }
}
