import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, ne } from 'drizzle-orm';
import { caretakersTable, householdsTable, invitesTable, puppiesTable, usersTable } from '../src/db/schema.js';
import { isSuperAdminEmail } from '../src/utils/auth.js';
import { verifyAuth, sendAuthError, setCorsHeaders } from './_auth.js';
import { getDatabaseUrl } from './_db.js';

const connectionString = getDatabaseUrl();
const sql = neon(connectionString);
const db = drizzle(sql);

/**
 * The invitee answers an invite (POST /api/users stores it): POST {id} joins its household with its role, DELETE ?id= declines.
 * Only the invite's own email answers it: anyone else gets 404, as for an invite that does not exist.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (error: unknown) {
    return sendAuthError(res, error);
  }

  const id = req.method === 'POST' ? req.body?.id : req.query.id;
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'invite id is required' });
  if (req.method === 'POST' && isSuperAdminEmail(auth.email)) {
    return res.status(403).json({ error: "The owner's account never moves." });
  }

  try {
    const email = auth.email.toLowerCase();
    const [invite] = await db.select().from(invitesTable).where(and(eq(invitesTable.id, id), eq(invitesTable.email, email)));
    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    // Decline, or an invite into the household the account is already in (the owner moved it there since)
    if (req.method === 'DELETE' || invite.householdId === auth.householdId) {
      await db.delete(invitesTable).where(eq(invitesTable.id, invite.id));
      return res.status(200).json({ success: true });
    }

    // Joining leaves the old household empty: only one with no other account and no dog (deleted ones too), so nothing is lost
    const oldHouseholdId = auth.householdId;
    const [otherAccounts, dogs] = await Promise.all([
      db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.householdId, oldHouseholdId), ne(usersTable.email, email))).limit(1),
      db.select({ id: puppiesTable.id }).from(puppiesTable).where(eq(puppiesTable.householdId, oldHouseholdId)).limit(1),
    ]);
    if (otherAccounts.length > 0 || dogs.length > 0) {
      return res.status(409).json({ error: 'Your household has dogs or other members.', code: 'inviteLeaveFirst' });
    }

    // shortcut: checked before the batch, as in deleteAccount (api/users.ts); a dog or an account added to the old household
    // meanwhile would be left there. One conditional statement if households ever see concurrent changes.
    await db.batch([
      db.update(usersTable).set({ householdId: invite.householdId, role: invite.role }).where(eq(usersTable.email, email)),
      db.delete(invitesTable).where(eq(invitesTable.id, invite.id)),
      // What the old household leaves behind: badges, invites into it and its row
      db.delete(caretakersTable).where(eq(caretakersTable.householdId, oldHouseholdId)),
      db.delete(invitesTable).where(eq(invitesTable.householdId, oldHouseholdId)),
      db.delete(householdsTable).where(eq(householdsTable.id, oldHouseholdId)),
    ]);
    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    console.error('API /api/invites error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
