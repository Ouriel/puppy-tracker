import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../src/db/schema';
import { signSessionToken } from './_auth';

const client = new OAuth2Client();

function getDb() {
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  return drizzle(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : 'https://puppace.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID;

    // Verify Google ID Token
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      return res.status(401).json({ error: `Google authentication failed: ${err?.message || err}` });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token payload' });
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];
    const db = getDb();

    // Look up or auto-register user in DB
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (!user) {
      const isSuperAdmin = email === 'matthieu.jacquet@gmail.com';
      const [created] = await db
        .insert(usersTable)
        .values({
          id: `usr-${Date.now()}`,
          householdId: 'FAMILY-COCKER-2026',
          email,
          name,
          role: isSuperAdmin ? 'SuperAdmin' : 'Member',
          status: isSuperAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
        })
        .returning();
      user = created;
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Account pending activation by Super Admin Matthieu (matthieu.jacquet@gmail.com).',
        isPending: true,
      });
    }

    // Issue 30-day PupPace Session Token
    const sessionToken = signSessionToken({ email: user.email, name: user.name });

    return res.status(200).json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        householdId: user.householdId,
      },
    });
  } catch (error: any) {
    console.error('API /api/auth error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
