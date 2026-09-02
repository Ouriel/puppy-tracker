import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { caretakersTable, householdsTable } from '../src/db/schema.js';
import { CaretakerInputSchema } from '../src/utils/schemas.js';
import { verifyAuth, setCorsHeaders } from './_auth.js';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const sql = neon(connectionString);
const db = drizzle(sql);

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
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=60');
      
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
      if (auth.role !== 'SuperAdmin' && auth.role !== 'Husband' && auth.role !== 'Wife') {
        return res.status(403).json({ error: 'Only household admins can manage caretakers' });
      }
      const parsed = CaretakerInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid caretaker payload', details: parsed.error.issues });
      }
      const body = parsed.data;

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
          email: body.email || null,
        })
        .returning();

      return res.status(201).json(created);
    }

    // PUT /api/households — Update an existing caretaker
    if (req.method === 'PUT') {
      if (auth.role !== 'SuperAdmin' && auth.role !== 'Husband' && auth.role !== 'Wife') {
        return res.status(403).json({ error: 'Only household admins can manage caretakers' });
      }
      const parsed = CaretakerInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid caretaker payload', details: parsed.error.issues });
      }
      const body = parsed.data;
      if (!body.id) return res.status(400).json({ error: 'caretaker id is required' });

      const [existing] = await db
        .select()
        .from(caretakersTable)
        .where(and(eq(caretakersTable.id, body.id), eq(caretakersTable.householdId, householdId)));

      if (!existing) return res.status(404).json({ error: 'Caretaker not found' });

      const updatedRole = body.role || existing.role || 'Member';

      const [updated] = await db
        .update(caretakersTable)
        .set({
          name: body.name,
          role: updatedRole,
          ...(body.color ? { color: body.color } : {}),
          ...(body.email !== undefined ? { email: body.email || null } : {}),
        })
        .where(and(eq(caretakersTable.id, body.id), eq(caretakersTable.householdId, householdId)))
        .returning();

      return res.status(200).json(updated);
    }

    // DELETE /api/households?id=ct-xxx — Remove a caretaker
    if (req.method === 'DELETE') {
      if (auth.role !== 'SuperAdmin' && auth.role !== 'Husband' && auth.role !== 'Wife') {
        return res.status(403).json({ error: 'Only household admins can manage caretakers' });
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
