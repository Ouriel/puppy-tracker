import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../../src/db/schema.js';
import { isSuperAdminEmail } from '../../src/utils/auth.js';
import { verifyAuth, sendAuthError, signAppSessionToken, setCorsHeaders } from '../_auth.js';
import { getDatabaseUrl } from '../_db.js';

const connectionString = getDatabaseUrl();
const sql = neon(connectionString);
const db = drizzle(sql);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await verifyAuth(req);

    // Sync latest user details (householdId, role, status) directly from database
    if (connectionString) {
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
  } catch (error: unknown) {
    return sendAuthError(res, error);
  }
}
