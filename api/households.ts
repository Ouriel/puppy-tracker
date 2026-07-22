import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-Memory REST Store for household caretakers
const caretakersStore: Record<string, any[]> = {
  'FAMILY-COCKER-2026': [
    { id: '1', householdId: 'FAMILY-COCKER-2026', name: 'Matthieu', role: 'Member', color: '#6366F1' },
  ],
};

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

    if (!caretakersStore[householdId]) {
      caretakersStore[householdId] = [];
    }

    // GET /api/households -> Fetch household info & caretakers
    if (req.method === 'GET') {
      return res.status(200).json({
        id: householdId,
        familyPackId: householdId,
        caretakers: caretakersStore[householdId],
      });
    }

    // POST /api/households -> Add caretaker to household
    if (req.method === 'POST') {
      const { name, role, color, email } = req.body || {};
      if (!name) return res.status(400).json({ error: 'Missing caretaker name' });

      const newCaretaker = {
        id: req.body.id || `car-${Date.now()}`,
        householdId,
        name,
        role: role || 'Member',
        color: color || '#6366F1',
        email,
        createdAt: new Date().toISOString(),
      };

      caretakersStore[householdId].push(newCaretaker);
      return res.status(201).json(newCaretaker);
    }

    // DELETE /api/households?caretakerId=xxx -> Remove caretaker
    if (req.method === 'DELETE') {
      const id = req.query.caretakerId as string || req.body?.id;
      if (!id) return res.status(400).json({ error: 'Missing caretaker id' });

      caretakersStore[householdId] = caretakersStore[householdId].filter((c) => c.id !== id);
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'REST API Error' });
  }
}
