import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-Memory REST Store for activities per householdId
const activitiesStore: Record<string, any[]> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Household-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const householdId =
      (req.headers['x-household-id'] as string) ||
      (req.query.householdId as string) ||
      'FAMILY-COCKER-2026';

    if (!activitiesStore[householdId]) {
      activitiesStore[householdId] = [];
    }

    // GET /api/activities?puppyId=xxx -> List all activities for household / dog
    if (req.method === 'GET') {
      const puppyId = req.query.puppyId as string;
      let results = activitiesStore[householdId];
      if (puppyId) {
        results = results.filter((a) => a.puppyId === puppyId);
      }
      return res.status(200).json(results);
    }

    // POST /api/activities -> Log new activity (pee, poop, meal, walk, weight, meds)
    if (req.method === 'POST') {
      const { puppyId, type, timestamp, loggedBy, pottyLocation, stoolConsistency, foodType, quantityGrams, durationMinutes, weightKg, medicationName, notes } = req.body || {};

      if (!puppyId || !type) {
        return res.status(400).json({ error: 'Missing required activity fields: puppyId and type' });
      }

      const newActivity = {
        id: req.body.id || `act-${Date.now()}`,
        householdId,
        puppyId,
        type,
        timestamp: timestamp || new Date().toISOString(),
        loggedBy: loggedBy || 'Caretaker',
        pottyLocation,
        stoolConsistency,
        foodType,
        quantityGrams: quantityGrams ? Number(quantityGrams) : undefined,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        medicationName,
        notes,
        createdAt: new Date().toISOString(),
      };

      activitiesStore[householdId].unshift(newActivity);
      return res.status(201).json(newActivity);
    }

    // DELETE /api/activities?id=xxx -> Remove activity log
    if (req.method === 'DELETE') {
      const actId = req.query.id as string || req.body?.id;
      if (!actId) return res.status(400).json({ error: 'Missing activity id' });

      activitiesStore[householdId] = activitiesStore[householdId].filter((a) => a.id !== actId);
      return res.status(200).json({ success: true, deletedId: actId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'REST API Error' });
  }
}
