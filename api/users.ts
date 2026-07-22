import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../src/db/schema';

function getDb() {
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  return drizzle(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Household-ID');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const householdId = (req.headers['x-household-id'] as string) || 'FAMILY-COCKER-2026';
  const db = getDb();

  try {
    // GET /api/users — List users, or look up by email
    if (req.method === 'GET') {
      const email = req.query.email as string;
      if (email) {
        const [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email.toLowerCase()));
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json(user);
      }
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.householdId, householdId));
      return res.status(200).json(users);
    }

    // POST /api/users — Register or upsert a user
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.email) return res.status(400).json({ error: 'email is required' });

      const email = body.email.toLowerCase();

      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));

      if (existing) {
        const [updated] = await db
          .update(usersTable)
          .set({
            name: body.name || existing.name,
            role: body.role || existing.role,
            status: body.status || existing.status,
          })
          .where(eq(usersTable.id, existing.id))
          .returning();
        return res.status(200).json(updated);
      }

      const [created] = await db
        .insert(usersTable)
        .values({
          id: `usr-${Date.now()}`,
          householdId,
          email,
          name: body.name || email.split('@')[0],
          role: body.role || 'Member',
          status: body.status || 'PENDING_APPROVAL',
        })
        .returning();
      return res.status(201).json(created);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/users error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
