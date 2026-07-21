import { Router, Response } from 'express';
import { authenticateToken, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { acceptedUsers, pendingInvitations } from './auth';

const router = Router();

/**
 * GET Admin Overview
 * Restricted to matthieu.jacquet@gmail.com
 */
router.get('/overview', authenticateToken, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    accepted: Array.from(acceptedUsers),
    pending: Array.from(pendingInvitations),
  });
});

/**
 * POST Accept User Access Request
 * Restricted to matthieu.jacquet@gmail.com
 */
router.post('/accept', authenticateToken, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Target email is required.' });
  }

  const targetEmail = email.toLowerCase();
  pendingInvitations.delete(targetEmail);
  acceptedUsers.add(targetEmail);

  res.json({
    message: `Successfully accepted user ${targetEmail}! They can now log in using SSO or password.`,
    accepted: Array.from(acceptedUsers),
    pending: Array.from(pendingInvitations),
  });
});

/**
 * POST Send Direct Registration Invitation
 * Restricted to matthieu.jacquet@gmail.com
 */
router.post('/invite', authenticateToken, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Target invitation email is required.' });
  }

  const targetEmail = email.toLowerCase();
  acceptedUsers.add(targetEmail);

  res.json({
    message: `Sent invitation to ${targetEmail}! User has been pre-approved.`,
    accepted: Array.from(acceptedUsers),
    pending: Array.from(pendingInvitations),
  });
});

export default router;
