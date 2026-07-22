import type { VercelRequest, VercelResponse } from '@vercel/node';

const usersStore: any[] = [
  { id: 'usr-1', householdId: 'FAMILY-COCKER-2026', email: 'matthieu.jacquet@gmail.com', name: 'Matthieu', role: 'Member', status: 'ACTIVE' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Household-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const householdId = (req.headers['x-household-id'] as string) || 'FAMILY-COCKER-2026';

    // GET /api/users -> List user accounts
    if (req.method === 'GET') {
      const email = req.query.email as string;
      if (email) {
        const u = usersStore.find((user) => user.email.toLowerCase() === email.toLowerCase());
        if (!u) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json(u);
      }
      return res.status(200).json(usersStore.filter((u) => u.householdId === householdId));
    }

    // POST /api/users -> Register or pre-approve user
    if (req.method === 'POST') {
      const { email, name, role } = req.body || {};
      if (!email) return res.status(400).json({ error: 'Missing user email' });

      const newUser = {
        id: `usr-${Date.now()}`,
        householdId,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        role: role || 'Member',
        status: email.toLowerCase() === 'matthieu.jacquet@gmail.com' ? 'ACTIVE' : 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
      };

      const existingIdx = usersStore.findIndex((u) => u.email === newUser.email);
      if (existingIdx >= 0) {
        usersStore[existingIdx] = { ...usersStore[existingIdx], ...newUser };
      } else {
        usersStore.push(newUser);
      }

      return res.status(201).json(newUser);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'REST API Error' });
  }
}
