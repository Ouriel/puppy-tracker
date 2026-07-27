import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { usersTable } from '../src/db/schema';
import { verifyAuth } from './_auth';

function getDb() {
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  return drizzle(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : 'https://puppace.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    // GET /api/users — List users for household, or look up by email
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

    // Admin role check for mutation operations
    if (auth.role !== 'Admin' && auth.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Only admins can perform user management actions' });
    }

    // POST /api/users — Pre-approve or register a user
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

    // PUT /api/users — Update user role or status
    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.email) return res.status(400).json({ error: 'email is required' });

      const email = body.email.toLowerCase();
      const [updated] = await db
        .update(usersTable)
        .set({
          ...(body.role ? { role: body.role } : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.name ? { name: body.name } : {}),
        })
        .where(and(eq(usersTable.email, email), eq(usersTable.householdId, householdId)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'User not found in household' });
      return res.status(200).json(updated);
    }

    // DELETE /api/users?email=xxx — Remove a user from household
    if (req.method === 'DELETE') {
      const email = (req.query.email as string) || req.body?.email;
      if (!email) return res.status(400).json({ error: 'email is required' });

      if (email.toLowerCase() === auth.email.toLowerCase()) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      await db
        .delete(usersTable)
        .where(and(eq(usersTable.email, email.toLowerCase()), eq(usersTable.householdId, householdId)));
      return res.status(200).json({ success: true, deletedEmail: email });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API /api/users error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
