import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-saas-key';

// Mock DB databases in memory
export const acceptedUsers = new Set<string>(['matthieu.jacquet@gmail.com', 'spouse@family.com']);
export const pendingInvitations = new Set<string>(['sarah@family.com', 'walker@paws.com']);
export const usersDb: any[] = [];

/**
 * Standard Email/Password Sign-In
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  const user = usersDb.find((u) => u.email === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Issue secure JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, familyPackId: user.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { name: user.name, email: user.email, role: user.role, familyPackId: user.familyPackId } });
});

/**
 * Google OAuth SSO Callback Simulation
 */
router.post('/google-sso', (req: Request, res: Response) => {
  const { email, name, googleToken } = req.body;

  if (!email || !googleToken) {
    return res.status(400).json({ error: 'Google SSO credentials incomplete.' });
  }

  const userEmail = email.toLowerCase();

  // Enforce SaaS onboarding check: check if accepted by Admin
  if (!acceptedUsers.has(userEmail)) {
    return res.status(403).json({
      error: 'Registration pending. Matthieu must accept your request before you can log in.',
    });
  }

  let user = usersDb.find((u) => u.email === userEmail);
  if (!user) {
    // Auto-create user profile if approved by admin
    user = {
      id: `usr-${Date.now()}`,
      email: userEmail,
      name: name || email.split('@')[0],
      role: userEmail === 'matthieu.jacquet@gmail.com' ? 'Husband' : 'Partner',
      familyPackId: 'FAMILY-COCKER-2026',
      passwordHash: '', // SSO users do not need standard password
    };
    usersDb.push(user);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, familyPackId: user.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { name: user.name, email: user.email, role: user.role, familyPackId: user.familyPackId } });
});

/**
 * Request Access / Registration Onboarding
 */
router.post('/request-access', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const targetEmail = email.toLowerCase();
  if (acceptedUsers.has(targetEmail)) {
    return res.status(400).json({ error: 'Email already accepted. Proceed to log in.' });
  }

  pendingInvitations.add(targetEmail);
  res.json({ message: 'Request sent! Matthieu has been notified to accept your account.' });
});

export default router;
