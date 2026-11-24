import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, count, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { privacyRequestsTable } from '../src/db/schema.js';
import { PrivacyRequestSchema, PrivacyRequestHandledSchema } from '../src/utils/schemas.js';
import { isSuperAdminEmail } from '../src/utils/auth.js';
import { verifyAuth, sendAuthError, setCorsHeaders } from './_auth.js';
import { getDatabaseUrl } from './_db.js';

const db = drizzle(neon(getDatabaseUrl()));

// The form is public: past this many requests in an hour (all senders), it answers "try again later", so a bot
// cannot fill the database. A family app gets a few requests a year.
export const HOURLY_REQUEST_CAP = 20;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Back to the form's language half of /privacy, on the box that says whether the request went through. */
function backToPolicy(res: VercelResponse, lang: string | undefined, sent: boolean) {
  const anchor = lang === 'fr' ? (sent ? 'demande-envoyee' : 'demande-echouee') : (sent ? 'request-sent' : 'request-failed');
  return res.redirect(303, `/privacy#${anchor}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST: the /privacy form (a plain HTML form, no sign-in), answered with a redirect back to the page
  if (req.method === 'POST') {
    const parsed = PrivacyRequestSchema.safeParse(req.body);
    const lang = typeof req.body?.lang === 'string' ? req.body.lang : undefined;
    if (!parsed.success) return backToPolicy(res, lang, false);
    // A bot filled the trap field: it sees the usual answer, nothing is stored
    if (parsed.data.website) return backToPolicy(res, lang, true);
    try {
      const [{ value: lastHour }] = await db
        .select({ value: count() })
        .from(privacyRequestsTable)
        .where(gt(privacyRequestsTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)));
      if (lastHour >= HOURLY_REQUEST_CAP) return backToPolicy(res, lang, false);
      await db.insert(privacyRequestsTable).values({
        id: `prq-${randomUUID()}`,
        email: parsed.data.email.toLowerCase(),
        kind: parsed.data.kind,
        message: parsed.data.message?.trim() || null,
        lang: parsed.data.lang,
      });
      return backToPolicy(res, lang, true);
    } catch (error) {
      console.error('Privacy request not stored:', error);
      return backToPolicy(res, lang, false);
    }
  }

  // GET and PUT: the owner only, from the Admin panel
  let auth;
  try {
    auth = await verifyAuth(req);
  } catch (error: unknown) {
    return sendAuthError(res, error);
  }
  if (!isSuperAdminEmail(auth.email)) return res.status(403).json({ error: 'Only the owner reads privacy requests' });

  try {
    if (req.method === 'GET') {
      // Kept one year after the answer, and one never answered one year after it was sent, as the privacy policy says
      const yearAgo = new Date(Date.now() - YEAR_MS);
      await db.delete(privacyRequestsTable).where(or(
        lt(privacyRequestsTable.handledAt, yearAgo),
        and(isNull(privacyRequestsTable.handledAt), lt(privacyRequestsTable.createdAt, yearAgo)),
      ));
      const rows = await db.select().from(privacyRequestsTable).orderBy(desc(privacyRequestsTable.createdAt));
      return res.status(200).json(rows.map((row) => ({
        ...row,
        createdAt: row.createdAt?.toISOString() ?? null,
        handledAt: row.handledAt?.toISOString() ?? null,
      })));
    }

    if (req.method === 'PUT') {
      const parsed = PrivacyRequestHandledSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'id is required' });
      const [row] = await db
        .update(privacyRequestsTable)
        .set({ handledAt: new Date() })
        .where(eq(privacyRequestsTable.id, parsed.data.id))
        .returning();
      if (!row) return res.status(404).json({ error: 'Request not found' });
      return res.status(200).json({ ...row, createdAt: row.createdAt?.toISOString() ?? null, handledAt: row.handledAt?.toISOString() ?? null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Privacy requests API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
