import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc, gte } from 'drizzle-orm';
import { activitiesTable, caretakersTable, puppiesTable, healthRecordsTable } from '../src/db/schema.js';
import { DashboardQuerySchema } from '../src/utils/schemas.js';
import { verifyAuth, sendAuthError, setCorsHeaders } from './_auth.js';
import { getDatabaseUrl } from './_db.js';

// Module-level connection pooling to stay warm across invocations
const connectionString = getDatabaseUrl();
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
  } catch (error: unknown) {
    return sendAuthError(res, error);
  }

  const householdId = auth.householdId;

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

    // Every weight event, whatever its date: weigh-ins come weeks apart, so the recent window often holds none
    let weightActivitiesWhere = and(eq(activitiesTable.householdId, householdId), eq(activitiesTable.type, 'weight'));

    if (puppyId) {
      activitiesWhere = and(activitiesWhere, eq(activitiesTable.puppyId, puppyId));
      weightActivitiesWhere = and(weightActivitiesWhere, eq(activitiesTable.puppyId, puppyId));
    }

    // Execute all 5 dashboard queries concurrently in a single HTTP batch pipe to Neon
    const [puppies, caretakers, rawActivities, healthRecords, rawWeightActivities] = await db.batch([
      db.select().from(puppiesTable).where(eq(puppiesTable.householdId, householdId)),
      db.select().from(caretakersTable).where(eq(caretakersTable.householdId, householdId)),
      db
        .select()
        .from(activitiesTable)
        .where(activitiesWhere)
        // Same timestamp: the log made last comes first, and predictions take the first one
        .orderBy(desc(activitiesTable.timestamp), desc(activitiesTable.createdAt))
        .limit(300),
      db
        .select()
        .from(healthRecordsTable)
        .where(eq(healthRecordsTable.householdId, householdId))
        .orderBy(desc(healthRecordsTable.date)),
      db
        .select()
        .from(activitiesTable)
        .where(weightActivitiesWhere)
        .orderBy(desc(activitiesTable.timestamp), desc(activitiesTable.createdAt)),
    ]);

    const formatActivity = (activity: typeof rawActivities[number]) => ({
      ...activity,
      timestamp: activity.timestamp instanceof Date ? activity.timestamp.toISOString() : new Date(activity.timestamp).toISOString(),
    });

    return res.status(200).json({
      puppies,
      caretakers,
      activities: rawActivities.map(formatActivity),
      healthRecords,
      weightActivities: rawWeightActivities.map(formatActivity),
    });
  } catch (err) {
    console.error('Error fetching dashboard payload:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard payload' });
  }
}
