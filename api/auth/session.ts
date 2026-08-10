import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, signAppSessionToken } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : 'https://puppace.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await verifyAuth(req);
    const sessionToken = signAppSessionToken(auth, 90); // 90-day long-lived session

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
  } catch (err: any) {
    return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }
}
