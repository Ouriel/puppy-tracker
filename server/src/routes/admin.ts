import { Router, Response } from 'express';
import { authenticateToken, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { usersDb } from './auth';

const router = Router();

/**
 * GET Admin Overview & User Status
 * Strictly restricted to matthieu.jacquet@gmail.com
 */
router.get('/overview', authenticateToken, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  const active = usersDb.filter((u) => u.status === 'ACTIVE');
  const pending = usersDb.filter((u) => u.status === 'PENDING_APPROVAL');

  res.json({
    activeUsers: active.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })),
    pendingUsers: pending.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt })),
  });
});

/**
 * POST Activate Account Endpoint
 * Strictly restricted to matthieu.jacquet@gmail.com
 */
router.post('/activate', authenticateToken, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Target email is required.' });
  }

  const targetEmail = email.toLowerCase().trim();
  const user = usersDb.find((u) => u.email === targetEmail);

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  user.status = 'ACTIVE';

  const active = usersDb.filter((u) => u.status === 'ACTIVE');
  const pending = usersDb.filter((u) => u.status === 'PENDING_APPROVAL');

  res.json({
    message: `Account for ${targetEmail} activated successfully! They can now log in.`,
    activeUsers: active.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })),
    pendingUsers: pending.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })),
  });
});

/**
 * POST Deactivate / Revoke Access
 */
router.post('/deactivate', authenticateToken, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Target email is required.' });
  }

  const targetEmail = email.toLowerCase().trim();

  if (targetEmail === 'matthieu.jacquet@gmail.com') {
    return res.status(400).json({ error: 'Cannot deactivate the Super Admin owner account.' });
  }

  const user = usersDb.find((u) => u.email === targetEmail);
  if (user) {
    user.status = 'PENDING_APPROVAL';
  }

  res.json({ message: `Access for ${targetEmail} has been revoked.` });
});

export default router;
