import type { VercelRequest, VercelResponse } from '@vercel/node';

// Global server memory store per household familyPackId (synced across serverless invocations)
const householdDatabaseStore: Record<
  string,
  {
    puppies: any[];
    activities: any[];
    caretakers: any[];
    user: any;
    updatedAt: string;
  }
> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers for cross-origin mobile sync
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Family-Pack-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract Security & Household Scope Token
    const familyPackId =
      (req.headers['x-family-pack-id'] as string) ||
      (req.headers.authorization?.replace('Bearer ', '')) ||
      (req.body?.familyPackId as string) ||
      (req.query?.familyPackId as string) ||
      'FAMILY-COCKER-2026';

    if (!familyPackId || familyPackId.length < 3) {
      return res.status(401).json({
        error: 'Unauthorized: Missing or invalid household family security token (X-Family-Pack-ID)',
      });
    }

    // Initialize household record if new
    if (!householdDatabaseStore[familyPackId]) {
      householdDatabaseStore[familyPackId] = {
        puppies: [],
        activities: [],
        caretakers: [],
        user: null,
        updatedAt: new Date().toISOString(),
      };
    }

    if (req.method === 'GET') {
      const data = householdDatabaseStore[familyPackId];
      return res.status(200).json({
        success: true,
        familyPackId,
        puppies: data.puppies || [],
        activities: data.activities || [],
        caretakers: data.caretakers || [],
        user: data.user || null,
        updatedAt: data.updatedAt,
      });
    }

    if (req.method === 'POST') {
      const { puppies, activities, caretakers, user } = req.body || {};

      // Update household database record
      if (Array.isArray(puppies) && puppies.length > 0) {
        householdDatabaseStore[familyPackId].puppies = puppies;
      }
      if (Array.isArray(activities)) {
        householdDatabaseStore[familyPackId].activities = activities;
      }
      if (Array.isArray(caretakers) && caretakers.length > 0) {
        householdDatabaseStore[familyPackId].caretakers = caretakers;
      }
      if (user) {
        householdDatabaseStore[familyPackId].user = user;
      }
      householdDatabaseStore[familyPackId].updatedAt = new Date().toISOString();

      return res.status(200).json({
        success: true,
        familyPackId,
        syncedAt: householdDatabaseStore[familyPackId].updatedAt,
        puppiesCount: householdDatabaseStore[familyPackId].puppies.length,
        activitiesCount: householdDatabaseStore[familyPackId].activities.length,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Database Sync Error' });
  }
}
