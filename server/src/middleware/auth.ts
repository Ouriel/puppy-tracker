import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-saas-key';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    familyPackId?: string;
  };
}

export type AuthRequest = AuthenticatedRequest;

/**
 * Standard JWT Authentication Middleware
 * Enforces security on all API routes
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Session expired or invalid token.' });
    }
    req.user = decoded as AuthenticatedRequest['user'];
    next();
  });
}

/**
 * Backend Admin Verification Middleware
 * strictly restricts access to matthieu.jacquet@gmail.com
 */
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.email !== 'matthieu.jacquet@gmail.com') {
    return res.status(403).json({ error: 'Access Denied: Only Matthieu (matthieu.jacquet@gmail.com) can manage invitations and users.' });
  }
  next();
}
