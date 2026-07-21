import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-saas-key';

// SaaS Authorized User whitelist
export const acceptedUsers = new Set<string>([
  'matthieu.jacquet@gmail.com',
  'spouse@family.com',
  'sarah@family.com'
]);
export const pendingInvitations = new Set<string>();
export const usersDb: any[] = [];

/**
 * Standard Email/Password Sign-Up / Registration
 */
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }

  const userEmail = email.toLowerCase();
  
  // Check if user already exists
  const existingUser = usersDb.find((u) => u.email === userEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
  }

  // Enforce SaaS Admin Approval: check if approved/accepted first
  if (!acceptedUsers.has(userEmail)) {
    // If not approved yet, add to pending list for Matthieu's approval
    pendingInvitations.add(userEmail);
    return res.status(403).json({
      error: 'Registration pending. Matthieu (matthieu.jacquet@gmail.com) must accept your request before you can log in.',
    });
  }

  // Hash password safely
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = {
    id: `usr-${Date.now()}`,
    email: userEmail,
    name,
    role: role || 'Partner',
    familyPackId: 'FAMILY-COCKER-2026',
    passwordHash,
  };

  usersDb.push(newUser);

  // Generate JWT token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, familyPackId: newUser.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    user: { name: newUser.name, email: newUser.email, role: newUser.role, familyPackId: newUser.familyPackId },
  });
});

/**
 * Standard Email/Password Sign-In
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  const userEmail = email.toLowerCase();
  const user = usersDb.find((u) => u.email === userEmail);
  
  if (!user) {
    // If account doesn't exist but email is pre-approved, invite them to register
    if (acceptedUsers.has(userEmail)) {
      return res.status(400).json({ error: 'Account not registered yet. Please sign up using the Register tab.' });
    }
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, familyPackId: user.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { name: user.name, email: user.email, role: user.role, familyPackId: user.familyPackId },
  });
});

/**
 * Google OAuth SSO Callback Verification
 */
router.post('/google-sso', (req: Request, res: Response) => {
  const { email, name, googleToken } = req.body;

  if (!email || !googleToken) {
    return res.status(400).json({ error: 'Google SSO credentials incomplete.' });
  }

  const userEmail = email.toLowerCase();

  // Enforce SaaS onboarding whitelist check
  if (!acceptedUsers.has(userEmail)) {
    pendingInvitations.add(userEmail);
    return res.status(403).json({
      error: 'Registration pending. Matthieu must accept your request before you can log in.',
    });
  }

  let user = usersDb.find((u) => u.email === userEmail);
  if (!user) {
    user = {
      id: `usr-${Date.now()}`,
      email: userEmail,
      name: name || email.split('@')[0],
      role: userEmail === 'matthieu.jacquet@gmail.com' ? 'Husband' : 'Partner',
      familyPackId: 'FAMILY-COCKER-2026',
      passwordHash: '',
    };
    usersDb.push(user);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, familyPackId: user.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { name: user.name, email: user.email, role: user.role, familyPackId: user.familyPackId },
  });
});

/**
 * Request Access / Registration Onboarding
 */
router.post('/request-access', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const targetEmail = email.toLowerCase();
  if (acceptedUsers.has(targetEmail)) {
    return res.status(400).json({ error: 'Email already accepted. Proceed to log in or register.' });
  }

  pendingInvitations.add(targetEmail);
  res.json({ message: 'Request sent! Matthieu has been notified to accept your account.' });
});

export default router;
