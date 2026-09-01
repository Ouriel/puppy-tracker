import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../../src/db/schema.js';
import { isSuperAdminEmail } from '../../src/utils/auth.js';
import { verifyAuth, signAppSessionToken, setCorsHeaders } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await verifyAuth(req);

    // Sync latest user details (householdId, role, status) directly from database
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
    if (dbUrl) {
      const sql = neon(dbUrl);
      const db = drizzle(sql);
      const [dbUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, auth.email.toLowerCase()));

      if (dbUser) {
        if (dbUser.status !== 'ACTIVE' && !isSuperAdminEmail(auth.email)) {
          return res.status(403).json({ error: 'Account pending activation by Super Admin.' });
        }
        auth.householdId = dbUser.householdId;
        auth.name = dbUser.name || auth.name;
        auth.role = isSuperAdminEmail(auth.email) ? 'SuperAdmin' : dbUser.role;
      } else {
        return res.status(401).json({ error: 'User account not found' });
      }
    }

    const sessionToken = signAppSessionToken(auth, 90); // freshly signed with updated householdId

    return res.status(200).json({
      user: {
        email: auth.email,
        name: auth.name,
        householdId: auth.householdId,
        role: auth.role,
      },
      sessionToken,
      expiresInDays: 90,
    });
  } catch (err: unknown) {
    const status = (err && typeof err === 'object' && 'status' in err) ? (err as { status: number }).status : 500;
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Internal server error';
    return res.status(status).json({ error: message });
  }
}
