import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { caretakersTable, householdsTable } from '../src/db/schema.js';
import { CaretakerInputSchema } from '../src/utils/schemas.js';
import { verifyAuth, setCorsHeaders, canDeleteHouseholdData, type AuthContext } from './_auth.js';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const sql = neon(connectionString);
const db = drizzle(sql);

type CaretakerRow = typeof caretakersTable.$inferSelect;

/**
 * Why a badge write is refused, or null. loggedBy is stored as a badge name and resolved by the badge email first,
 * so names and emails stay unique in a household, and only an admin links a badge to someone else's login.
 * `email`: undefined = unchanged, null = unlinked, else lower case.
 */
function badgeWriteRefusal(
  auth: AuthContext,
  householdBadges: CaretakerRow[],
  change: { name?: string; email?: string | null },
  existing?: CaretakerRow
): { status: number; error: string } | null {
  const otherBadges = householdBadges.filter((item) => item.id !== existing?.id);
  const name = change.name?.trim().toLowerCase();
  const isRename = name !== existing?.name?.trim().toLowerCase();
  if (name && isRename && otherBadges.some((item) => item.name.trim().toLowerCase() === name)) {
    return { status: 409, error: 'Another member already has this name.' };
  }
  const currentEmail = existing?.email?.toLowerCase() ?? null;
  if (change.email === undefined || change.email === currentEmail) return null;
  const ownEmail = auth.email.toLowerCase();
  const isAdmin = auth.role === 'Admin' || auth.role === 'SuperAdmin';
  const touchesOnlyOwnLink = [currentEmail, change.email].every((email) => email === null || email === ownEmail);
  if (!isAdmin && !touchesOnlyOwnLink) {
    return { status: 403, error: "Only an admin can link a member to someone else's login." };
  }
  if (change.email && otherBadges.some((item) => item.email?.toLowerCase() === change.email)) {
    return { status: 409, error: 'Another member is already linked to this email.' };
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (err: unknown) {
    const status = (err && typeof err === 'object' && 'status' in err) ? (err as { status: number }).status : 500;
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Internal server error';
    return res.status(status).json({ error: message });
  }

  const householdId = auth.householdId;

  try {
    // GET /api/households — Fetch household details & members (or all households for SuperAdmin)
    if (req.method === 'GET') {
      
      if (req.query.all === 'true' && auth.role === 'SuperAdmin') {
        const allHouseholds = await db.select().from(householdsTable);
        // Ensure default household is in the list if not in DB yet
        const hasMain = allHouseholds.some((h) => h.id === 'FAMILY-COCKER-2026');
        const list = hasMain
          ? allHouseholds
          : [{ id: 'FAMILY-COCKER-2026', familyPackId: 'FAMILY-COCKER-2026', name: 'Family Pack (Main)' }, ...allHouseholds];
        return res.status(200).json({ households: list });
      }

      const [household] = await db
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.id, householdId));

      const caretakers = await db
        .select()
        .from(caretakersTable)
        .where(eq(caretakersTable.householdId, householdId));

      return res.status(200).json({
        household: household || { id: householdId, familyPackId: (auth as any).familyPackId, name: 'Family Pack' },
        caretakers,
      });
    }

    // POST /api/households — Add a new caretaker
    if (req.method === 'POST') {
      const parsed = CaretakerInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid caretaker payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      const email = body.email ? body.email.toLowerCase() : null;

      const householdBadges = await db
        .select()
        .from(caretakersTable)
        .where(eq(caretakersTable.householdId, householdId));
      const refusal = badgeWriteRefusal(auth, householdBadges, { name: body.name, email });
      if (refusal) return res.status(refusal.status).json({ error: refusal.error });

      const id = body.id || `ct-${Date.now()}`;
      const color = body.color || 'bg-amber-500';
      const role = body.role || 'Member';

      const [created] = await db
        .insert(caretakersTable)
        .values({
          id,
          householdId,
          name: body.name,
          role,
          color,
          email,
        })
        .returning();

      return res.status(201).json(created);
    }

    // PUT /api/households — Update an existing caretaker
    if (req.method === 'PUT') {
      const parsed = CaretakerInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid caretaker payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      if (!body.id) return res.status(400).json({ error: 'caretaker id is required' });

      const householdBadges = await db
        .select()
        .from(caretakersTable)
        .where(eq(caretakersTable.householdId, householdId));
      const existing = householdBadges.find((item) => item.id === body.id);

      if (!existing) return res.status(404).json({ error: 'Caretaker not found' });

      const email = body.email === undefined ? undefined : body.email ? body.email.toLowerCase() : null;
      const refusal = badgeWriteRefusal(auth, householdBadges, { name: body.name, email }, existing);
      if (refusal) return res.status(refusal.status).json({ error: refusal.error });

      const updatedRole = body.role || existing.role || 'Member';

      const [updated] = await db
        .update(caretakersTable)
        .set({
          name: body.name,
          role: updatedRole,
          ...(body.color ? { color: body.color } : {}),
          ...(email !== undefined ? { email } : {}),
        })
        .where(and(eq(caretakersTable.id, body.id), eq(caretakersTable.householdId, householdId)))
        .returning();

      return res.status(200).json(updated);
    }

    // DELETE /api/households?id=ct-xxx — Remove a caretaker
    if (req.method === 'DELETE') {
      if (!canDeleteHouseholdData(auth)) {
        return res.status(403).json({ error: 'Only the owner can remove caretakers' });
      }
      const id = (req.query.id || req.query.caretakerId) as string;
      if (!id) return res.status(400).json({ error: 'caretaker id is required' });

      await db
        .delete(caretakersTable)
        .where(and(eq(caretakersTable.id, id), eq(caretakersTable.householdId, householdId)));

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Household API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
