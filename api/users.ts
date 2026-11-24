import { randomUUID } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, ne, lt, gte, desc, sql as sqlTag } from 'drizzle-orm';
import { activitiesTable, caretakersTable, healthRecordsTable, householdsTable, invitesTable, puppiesTable, usersTable } from '../src/db/schema.js';
import { isSuperAdminEmail } from '../src/utils/auth.js';
import { HOUSEHOLD_LIMITS, UserInputSchema } from '../src/utils/schemas.js';
import { verifyAuth, sendAuthError, sendLimitReached, setCorsHeaders, newHouseholdId } from './_auth.js';
import { getDatabaseUrl } from './_db.js';

const connectionString = getDatabaseUrl();
const sql = neon(connectionString);
const db = drizzle(sql);

type UserRow = typeof usersTable.$inferSelect;

function householdHasOtherUser(account: UserRow) {
  return db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.householdId, account.householdId), ne(usersTable.id, account.id)))
    .limit(1)
    .then((rows) => rows.length > 0);
}

// An invite nobody answered is deleted at the next invite anyone sends after this
const INVITE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
// The owner's account list loads at most this many accounts, and says how many there are
export const OWNER_ACCOUNT_LIST_LIMIT = 500;

/**
 * Every account deletion (its own, the owner's, an Admin's): the account, the invites addressed to its email and its badges
 * in its household go. The household's last account takes the whole household with it: dogs (deleted ones too), logs, health
 * records, badges, invites into it and the household row.
 */
async function deleteAccount(account: UserRow) {
  const { householdId, email } = account;
  // shortcut: checked before the batch, so an account joining the household meanwhile finds it emptied, and two last accounts
  // deleted at once both keep it; one SQL statement (DELETE ... WHERE NOT EXISTS) if households ever see concurrent changes.
  const isLastAccount = !(await householdHasOtherUser(account));
  await db.batch([
    db.delete(usersTable).where(eq(usersTable.id, account.id)),
    db.delete(invitesTable).where(eq(invitesTable.email, email.toLowerCase())),
    ...(isLastAccount
      ? [
          ...[puppiesTable, activitiesTable, healthRecordsTable, caretakersTable, invitesTable].map((table) => db.delete(table).where(eq(table.householdId, householdId))),
          db.delete(householdsTable).where(eq(householdsTable.id, householdId)),
        ]
      : [db.delete(caretakersTable).where(and(eq(caretakersTable.householdId, householdId), sqlTag`lower(${caretakersTable.email}) = ${email.toLowerCase()}`))]),
  ]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (error: unknown) {
    return sendAuthError(res, error);
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

      if (isSuperAdmin) {
        // The owner's own account (the panel reads its household from it), then pending and revoked ones, then the newest
        const [users, total] = await Promise.all([
          db
            .select()
            .from(usersTable)
            .orderBy(
              desc(sqlTag`${usersTable.email} = ${auth.email.toLowerCase()}`),
              desc(sqlTag`${usersTable.status} <> 'ACTIVE'`),
              sqlTag`${usersTable.createdAt} desc nulls last`
            )
            .limit(OWNER_ACCOUNT_LIST_LIMIT),
          db.$count(usersTable),
        ]);
        return res.status(200).json({ users, total });
      }
      const users = await db.select().from(usersTable).where(eq(usersTable.householdId, householdId));
      return res.status(200).json({ users, total: users.length });
    }

    // DELETE /api/users?email=<own email> — anyone but the owner deletes their own account, found from the session
    const deleteEmail = req.method === 'DELETE' ? ((req.query.email as string) || req.body?.email || '').toLowerCase() : '';
    if (deleteEmail && deleteEmail === auth.email.toLowerCase()) {
      if (isSuperAdminEmail(auth.email)) {
        return res.status(403).json({ error: 'SuperAdmin account cannot be deleted.' });
      }
      const [account] = await db.select().from(usersTable).where(eq(usersTable.email, auth.email.toLowerCase()));
      if (!account) return res.status(404).json({ error: 'User not found' });
      await deleteAccount(account);
      return res.status(200).json({ success: true, deletedEmail: account.email });
    }

    // Admin role check for mutation operations (POST, PUT, DELETE)
    if (auth.role !== 'Admin' && auth.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Only admins can perform user management actions' });
    }

    // POST /api/users — Invite an email into a household. It never creates, activates or moves an account: the invitee
    // joins with their own yes (api/invites.ts). The answer is the same whether or not the email has an account.
    if (req.method === 'POST') {
      const parsed = UserInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid user payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      const email = body.email.toLowerCase();
      if (body.newHouseholdName && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin creates households.' });
      }
      if (body.householdId && body.householdId !== householdId && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin can choose another household.' });
      }
      // An admin's invitees are Members of the admin's own family.
      if (body.role && body.role !== 'Member' && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin can choose a role.' });
      }
      // The owner's invite into a new household: its row and the invite, as its Admin, are written in one batch
      const newHousehold = body.newHouseholdName ? { id: newHouseholdId(), name: body.newHouseholdName } : null;
      const targetHouseholdId = newHousehold?.id || body.householdId || householdId;
      const role = newHousehold ? 'Admin' : 'Member';

      // The owner's household select lists the households that have a row or an account
      if (targetHouseholdId !== householdId && !newHousehold) {
        const [[namedHousehold], [householdAccount]] = await Promise.all([
          db.select({ id: householdsTable.id }).from(householdsTable).where(eq(householdsTable.id, targetHouseholdId)),
          db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.householdId, targetHouseholdId)).limit(1),
        ]);
        if (!namedHousehold && !householdAccount) return res.status(404).json({ error: 'Household not found' });
      }
      // Pending invites into that household for other emails: a new invite to an email already invited updates its row
      const [[existing], pendingInvites] = await Promise.all([
        db.select({ householdId: usersTable.householdId }).from(usersTable).where(eq(usersTable.email, email)),
        isSuperAdmin
          ? 0
          : db.$count(invitesTable, and(
            eq(invitesTable.householdId, targetHouseholdId),
            ne(invitesTable.email, email),
            gte(invitesTable.createdAt, new Date(Date.now() - INVITE_MAX_AGE_MS))
          )),
      ]);
      // Already in that household, or the owner (whose account never moves): nothing to write, and the same answer
      if (existing?.householdId === targetHouseholdId || isSuperAdminEmail(email)) {
        return res.status(201).json({ email });
      }
      // shortcut: two invites at once can both pass the count and go one over; fine at this load, a conditional insert if it matters
      if (pendingInvites >= HOUSEHOLD_LIMITS.pendingInvites) return sendLimitReached(res);

      await db.batch([
        db.delete(invitesTable).where(lt(invitesTable.createdAt, new Date(Date.now() - INVITE_MAX_AGE_MS))),
        db
          .insert(invitesTable)
          .values({ id: `inv-${randomUUID()}`, email, householdId: targetHouseholdId, role, invitedBy: auth.name })
          .onConflictDoUpdate({ target: [invitesTable.email, invitesTable.householdId], set: { role, invitedBy: auth.name, createdAt: new Date() } }),
        ...(newHousehold ? [db.insert(householdsTable).values({ id: newHousehold.id, familyPackId: newHousehold.id, name: newHousehold.name })] : []),
      ]);
      return res.status(201).json({ email });
    }

    // PUT /api/users — Update user role, status, or household assignment
    if (req.method === 'PUT') {
      const parsed = UserInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid user payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      const targetEmail = body.email.toLowerCase();

      if (isSuperAdminEmail(targetEmail) && !isSuperAdminEmail(auth.email)) {
        return res.status(403).json({ error: 'SuperAdmin account can only be managed by SuperAdmin.' });
      }

      if (body.role === 'SuperAdmin' && !isSuperAdminEmail(targetEmail)) {
        return res.status(403).json({ error: 'SuperAdmin role assignment is restricted.' });
      }

      if (body.householdId && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin can reassign households.' });
      }

      // Approve, revoke and restore are the owner's: an Admin could otherwise undo the owner's revoke
      if (body.status && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin changes an account status.' });
      }

      // As in POST: an Admin's family members are Members.
      if (body.role && body.role !== 'Member' && !isSuperAdmin) {
        return res.status(403).json({ error: 'Only SuperAdmin can choose a role.' });
      }

      const updateFields: Record<string, any> = {};
      if (body.role) updateFields.role = body.role;
      if (body.status) updateFields.status = body.status;
      if (body.name) updateFields.name = body.name;
      if (body.householdId && isSuperAdmin) updateFields.householdId = body.householdId;

      // The owner's approval of a sign-up that stays alone in its own household makes it that family's Admin,
      // who can then invite the rest of the family. An Admin approved or moved into another household is a Member there.
      if (isSuperAdmin && (body.status === 'ACTIVE' || body.householdId)) {
        const [account] = await db.select().from(usersTable).where(eq(usersTable.email, targetEmail));
        const isMove = !!account && !!body.householdId && body.householdId !== account.householdId;
        // A stale Admin panel row (an Admin took the sign-up in since) must not move it back out.
        if (isMove && body.status === 'ACTIVE' && account?.status !== 'PENDING_APPROVAL') {
          return res.status(409).json({ error: 'This account is no longer waiting for approval.' });
        }
        if (!body.role && isMove && account?.role === 'Admin') {
          updateFields.role = 'Member';
        } else if (!body.role && !isMove && body.status === 'ACTIVE' && account?.status === 'PENDING_APPROVAL' && !(await householdHasOtherUser(account))) {
          updateFields.role = 'Admin';
        }
      }

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

      if (isSuperAdminEmail(targetEmail)) {
        return res.status(403).json({ error: 'SuperAdmin account cannot be deleted.' });
      }

      const whereClause = isSuperAdmin
        ? eq(usersTable.email, targetEmail)
        : and(eq(usersTable.email, targetEmail), eq(usersTable.householdId, householdId));

      const [account] = await db.select().from(usersTable).where(whereClause);
      if (account) await deleteAccount(account);
      return res.status(200).json({ success: true, deletedEmail: targetEmail });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    console.error('API /api/users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
