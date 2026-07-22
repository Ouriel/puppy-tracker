import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-Memory REST Store fallback per householdId when PostgreSQL database is connected
const dogsStore: Record<string, any[]> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Household-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const householdId =
      (req.headers['x-household-id'] as string) ||
      (req.query.householdId as string) ||
      'FAMILY-COCKER-2026';

    if (!dogsStore[householdId]) {
      dogsStore[householdId] = [];
    }

    // GET /api/dogs -> List all dogs for the household
    if (req.method === 'GET') {
      const dogId = req.query.id as string;
      if (dogId) {
        const dog = dogsStore[householdId].find((d) => d.id === dogId);
        if (!dog) return res.status(404).json({ error: 'Dog profile not found' });
        return res.status(200).json(dog);
      }
      return res.status(200).json(dogsStore[householdId]);
    }

    // POST /api/dogs -> Create a new dog profile linked to household
    if (req.method === 'POST') {
      const { name, breed, birthDate, weightKg, dailyFoodGramGoal, targetMealsPerDay, notes, avatarUrl } = req.body || {};
      if (!name || !breed) {
        return res.status(400).json({ error: 'Missing required dog fields: name and breed' });
      }

      const newDog = {
        id: req.body.id || `dog-${Date.now()}`,
        householdId,
        name,
        breed,
        birthDate: birthDate || new Date().toISOString().slice(0, 10),
        weightKg: Number(weightKg) || 4.5,
        dailyFoodGramGoal: Number(dailyFoodGramGoal) || 200,
        targetMealsPerDay: Number(targetMealsPerDay) || 3,
        notes: notes || '',
        avatarUrl: avatarUrl || '',
        createdAt: new Date().toISOString(),
      };

      // Add or update
      const existingIdx = dogsStore[householdId].findIndex((d) => d.id === newDog.id);
      if (existingIdx >= 0) {
        dogsStore[householdId][existingIdx] = newDog;
      } else {
        dogsStore[householdId].push(newDog);
      }

      return res.status(201).json(newDog);
    }

    // PUT /api/dogs -> Update existing dog profile
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing dog id' });

      const idx = dogsStore[householdId].findIndex((d) => d.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Dog profile not found' });

      dogsStore[householdId][idx] = {
        ...dogsStore[householdId][idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      return res.status(200).json(dogsStore[householdId][idx]);
    }

    // DELETE /api/dogs?id=xxx -> Delete dog profile
    if (req.method === 'DELETE') {
      const dogId = req.query.id as string || req.body?.id;
      if (!dogId) return res.status(400).json({ error: 'Missing dog id parameter' });

      dogsStore[householdId] = dogsStore[householdId].filter((d) => d.id !== dogId);
      return res.status(200).json({ success: true, deletedId: dogId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'REST API Error' });
  }
}
