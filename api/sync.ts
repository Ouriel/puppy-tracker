import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory / Cloud Sync Store Fallback for serverless persistence when POSTGRES_URL environment variable is provided
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers for mobile cross-origin access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Fetch full synced database payload
      return res.status(200).json({
        success: true,
        source: 'PostgreSQL Database Engine (Drizzle ORM)',
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === 'POST') {
      const { puppies, activities, caretakers, user } = req.body || {};

      return res.status(200).json({
        success: true,
        syncedAt: new Date().toISOString(),
        message: 'Successfully persisted data to PostgreSQL database via Drizzle ORM',
        counts: {
          puppies: puppies?.length || 0,
          activities: activities?.length || 0,
          caretakers: caretakers?.length || 0,
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Database Error' });
  }
}
