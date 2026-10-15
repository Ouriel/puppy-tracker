import { randomUUID } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { usersTable } from '../src/db/schema.js';
import { SUPER_ADMIN_EMAIL } from '../src/utils/auth.js';
import { UserInputSchema } from '../src/utils/schemas.js';
import { verifyAuth, setCorsHeaders } from './_auth.js';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const sql = neon(connectionString);
const db = drizzle(sql);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (err: unknown) {
    const status = (err && typeof err === 'object' && 'status' in err) ? (err as { status: number }).status : 500;
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Internal server error';
    return res.status(status).json({ error: message });
  }

  const householdId = auth.householdId;
  const isSuperAdmin = auth.role === 'SuperAdmin';

  try {
    // GET /api/users — List users for household (or all users for SuperAdmin), or look up by email
    if (req.method === 'GET') {
      const email = req.query.email as string;
      if (email) {
        const whereClause = isSuperAdmin
          ? eq(usersTable.email, email.toLowerCase())
          : and(eq(usersTable.email, email.toLowerCase()), eq(usersTable.householdId, householdId));
        const [user] = await db
          .select()
          .from(usersTable)
          .where(whereClause);
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json(user);
      }

      const users = isSuperAdmin
        ? await db.select().from(usersTable)
        : await db.select().from(usersTable).where(eq(usersTable.householdId, householdId));
      return res.status(200).json(users);
    }

    // Admin role check for mutation operations (POST, PUT, DELETE)
    if (auth.role !== 'Admin' && auth.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Only admins can perform user management actions' });
    }

    // POST /api/users — Pre-approve or register a user
    if (req.method === 'POST') {
      const parsed = UserInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid user payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      const email = body.email.toLowerCase();
      if (body.householdId && body.householdId !== householdId && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin can choose another household.' });
      }
      const targetHouseholdId = body.householdId || householdId;

      if (body.role === 'SuperAdmin' && email !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ error: 'SuperAdmin role assignment is restricted.' });
      }

      // Looked up in every household: the email is unique, so an existing account is moved, never re-created.
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));

      if (existing) {
        const isMove = existing.householdId !== targetHouseholdId;
        // Only the owner moves accounts between households, and only once confirmed. Refusals carry no row data.
        if (isMove && !isSuperAdmin) {
          return res.status(403).json({ error: 'This person already has an account. Ask the owner to add them.' });
        }
        if (isMove && !body.confirmMove) {
          return res.status(409).json({ error: 'This person already has an account in another household.' });
        }
        const [updated] = await db
          .update(usersTable)
          .set({
            // Never the name: the account keeps its Google name.
            role: body.role || existing.role,
            status: body.status || existing.status,
            ...(isMove ? { householdId: targetHouseholdId } : {}),
          })
          .where(eq(usersTable.id, existing.id))
          .returning();
        return res.status(200).json(updated);
      }

      const [created] = await db
        .insert(usersTable)
        .values({
          id: `usr-${randomUUID()}`,
          householdId: targetHouseholdId,
          email,
          name: body.name || email.split('@')[0],
          role: body.role || 'Member',
          status: body.status || 'PENDING_APPROVAL',
        })
        .returning();
      return res.status(201).json(created);
    }

    // PUT /api/users — Update user role, status, or household assignment
    if (req.method === 'PUT') {
      const parsed = UserInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid user payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      const targetEmail = body.email.toLowerCase();

      if (targetEmail === SUPER_ADMIN_EMAIL && auth.email.toLowerCase() !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ error: 'SuperAdmin account can only be managed by SuperAdmin.' });
      }

      if (body.role === 'SuperAdmin' && targetEmail !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ error: 'SuperAdmin role assignment is restricted.' });
      }

      if (body.householdId && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin can reassign households.' });
      }

      const updateFields: Record<string, any> = {};
      if (body.role) updateFields.role = body.role;
      if (body.status) updateFields.status = body.status;
      if (body.name) updateFields.name = body.name;
      if (body.householdId && isSuperAdmin) updateFields.householdId = body.householdId;

      const whereClause = isSuperAdmin
        ? eq(usersTable.email, targetEmail)
        : and(eq(usersTable.email, targetEmail), eq(usersTable.householdId, householdId));

      const [updated] = await db
        .update(usersTable)
        .set(updateFields)
        .where(whereClause)
        .returning();

      if (!updated) return res.status(404).json({ error: 'User not found in household' });
      return res.status(200).json(updated);
    }

    // DELETE /api/users?email=xxx — Remove a user
    if (req.method === 'DELETE') {
      const rawEmail = (req.query.email as string) || req.body?.email;
      if (!rawEmail) return res.status(400).json({ error: 'email is required' });
      const targetEmail = rawEmail.toLowerCase();

      if (targetEmail === SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ error: 'SuperAdmin account cannot be deleted.' });
      }

      if (targetEmail === auth.email.toLowerCase()) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const whereClause = isSuperAdmin
        ? eq(usersTable.email, targetEmail)
        : and(eq(usersTable.email, targetEmail), eq(usersTable.householdId, householdId));

      await db
        .delete(usersTable)
        .where(whereClause);
      return res.status(200).json({ success: true, deletedEmail: targetEmail });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    console.error('API /api/users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
