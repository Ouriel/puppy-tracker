import { OAuth2Client } from 'google-auth-library';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../src/db/schema.js';
import type { VercelRequest } from '@vercel/node';

const client = new OAuth2Client();

export interface AuthContext {
  email: string;
  name: string;
  householdId: string;
  role: string;
}

export async function verifyAuth(req: VercelRequest): Promise<AuthContext> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing Authorization header' };
  }

  const token = authHeader.slice(7);
  const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

  // Verify the Google JWT cryptographically
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      ...(googleClientId ? { audience: googleClientId } : {}),
    });
    payload = ticket.getPayload();
  } catch (err: any) {
    throw { status: 401, message: `Invalid authentication token: ${err?.message || err}` };
  }

  if (!payload || !payload.email) {
    throw { status: 401, message: 'Invalid token payload' };
  }

  // Look up the user in the database
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw { status: 500, message: 'Database connection URL missing' };
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);
  const userEmail = payload.email.toLowerCase();

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, userEmail));

  // Auto-register user in DB if logging in for the first time
  if (!user) {
    const isSuperAdmin = userEmail === 'matthieu.jacquet@gmail.com';
    const [created] = await db
      .insert(usersTable)
      .values({
        id: `usr-${Date.now()}`,
        householdId: 'FAMILY-COCKER-2026',
        email: userEmail,
        name: payload.name || userEmail.split('@')[0],
        role: isSuperAdmin ? 'SuperAdmin' : 'Member',
        status: isSuperAdmin ? 'ACTIVE' : 'ACTIVE',
      })
      .returning();
    user = created;
  }

  if (user.status !== 'ACTIVE') {
    throw { status: 403, message: 'Account pending activation by Super Admin.' };
  }

  return {
    email: user.email,
    name: user.name,
    householdId: user.householdId,
    role: user.role,
  };
}
