import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../src/db/schema.js';
import { isSuperAdminEmail } from '../src/utils/auth.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function setCorsHeaders(req: VercelRequest, res: VercelResponse, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  const origin = (req.headers.origin as string) || '';
  const isAllowed =
    !origin ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'https://puppace.vercel.app' ||
    /^https:\/\/puppy-tracker-[a-z0-9-]+-matthieus-projects\.vercel\.app$/.test(origin);

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    // In development, derive from POSTGRES_URL if available
    if (process.env.POSTGRES_URL) {
      return createHmac('sha256', 'puppace-salt-2026').update(process.env.POSTGRES_URL).digest('hex');
    }
    throw new Error('FATAL: SESSION_SECRET or AUTH_SECRET environment variable is required in production');
  }
  return secret;
}

export interface AuthContext {
  email: string;
  name: string;
  householdId: string;
  role: string;
}

/**
 * Generates a signed, long-lived PupPace App Session Token (default 90-day longevity)
 */
export function signAppSessionToken(payload: Omit<AuthContext, 'exp' | 'iat'>, expiresInDays = 90): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60);
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signature = createHmac('sha256', getSessionSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Cryptographically verifies PupPace App Session Token signature & expiration
 */
export function verifyAppSessionToken(token: string): AuthContext | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = createHmac('sha256', getSessionSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (signature.length !== expectedSignature.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    if (!payload.email || !payload.householdId) return null;

    const userEmail = payload.email.toLowerCase();
    const isSuperAdmin = isSuperAdminEmail(userEmail);
    const verifiedRole = isSuperAdmin
      ? 'SuperAdmin'
      : (payload.role === 'SuperAdmin' ? 'Member' : (payload.role || 'Member'));

    return {
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      householdId: payload.householdId,
      role: verifiedRole,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticates incoming API requests:
 * 1. Checks long-lived PupPace App Session Token (90 days, 0ms fast path)
 * 2. Fallback: Verifies Google OAuth ID token on initial SSO login & issues long-lived session
 */
export async function verifyAuth(req: VercelRequest): Promise<AuthContext> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing Authorization header' };
  }

  const token = authHeader.slice(7);

  // 1. Try verifying as PupPace App Session Token (90-day validity, 0ms fast path)
  const appSession = verifyAppSessionToken(token);
  if (appSession) {
    return appSession;
  }

  // 2. Fallback: Verify as Google OAuth ID Token (Google SSO initial login)
  const googleClientId =
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    '8924902082-52mf1l272khij6ac2racnh4p34h7fh08.apps.googleusercontent.com';
  let payload: { email?: string; email_verified?: boolean; name?: string } | undefined;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      throw new Error(`Google token validation failed (${res.status})`);
    }
    const data = (await res.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
    };
    if (data.aud !== googleClientId) {
      throw new Error('Token audience mismatch');
    }
    payload = {
      email: data.email,
      email_verified: data.email_verified === true || data.email_verified === 'true',
      name: data.name,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw { status: 401, message: `Invalid authentication token: ${message}` };
  }

  if (!payload || !payload.email || !payload.email_verified) {
    throw { status: 401, message: 'Invalid token payload' };
  }

  // Look up user in database
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
    const isSuperAdmin = isSuperAdminEmail(userEmail);
    const newHouseholdId = isSuperAdmin ? 'FAMILY-COCKER-2026' : `house-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const [created] = await db
      .insert(usersTable)
      .values({
        id: `usr-${Date.now()}`,
        householdId: newHouseholdId,
        email: userEmail,
        name: payload.name || userEmail.split('@')[0],
        role: isSuperAdmin ? 'SuperAdmin' : 'Member',
        status: isSuperAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
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
