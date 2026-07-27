import { OAuth2Client } from 'google-auth-library';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../src/db/schema';
import type { VercelRequest } from '@vercel/node';
import crypto from 'node:crypto';

const client = new OAuth2Client();
const JWT_SECRET = process.env.JWT_SECRET || 'puppace-app-secret-key-2026-fallback';

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signSessionToken(payload: { email: string; name: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): { email: string; name?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return { email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

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
  const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID;

  let email: string | null = null;

  // 1. Try verifying as PupPace 30-day session token
  const session = verifySessionToken(token);
  if (session && session.email) {
    email = session.email;
  } else {
    // 2. Fallback to Google OAuth ID token verification
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      if (payload && payload.email) {
        email = payload.email;
      }
    } catch (err: any) {
      throw { status: 401, message: `Invalid authentication token: ${err?.message || err}` };
    }
  }

  if (!email) {
    throw { status: 401, message: 'Invalid token payload' };
  }

  // Look up the user in the database
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw { status: 500, message: 'Database connection URL missing' };
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    throw { status: 403, message: 'User not registered. Ask Super Admin for access.' };
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
