import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-saas-key';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  familyPackId: string;
  passwordHash?: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL';
  createdAt: string;
}

// In-memory database with pre-activated Super Admin account
export const usersDb: UserRecord[] = [
  {
    id: 'usr-admin-1',
    email: 'matthieu.jacquet@gmail.com',
    name: 'Matthieu',
    role: 'Husband',
    familyPackId: 'FAMILY-COCKER-2026',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
];

/**
 * Single Unified Account Creation Endpoint
 * New accounts start as PENDING_APPROVAL until activated by Matthieu
 */
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const userEmail = email.toLowerCase().trim();

  // Check if account already exists
  const existingUser = usersDb.find((u) => u.email === userEmail);
  if (existingUser) {
    if (existingUser.status === 'PENDING_APPROVAL') {
      return res.status(403).json({
        error: 'Account already created and is currently awaiting activation by Super Admin Matthieu.',
      });
    }
    return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  // Hash password safely
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // New accounts default to PENDING_APPROVAL unless it is Matthieu's email
  const isSuperAdmin = userEmail === 'matthieu.jacquet@gmail.com';
  const newUser: UserRecord = {
    id: `usr-${Date.now()}`,
    email: userEmail,
    name: name.trim(),
    role: role || 'Partner',
    familyPackId: 'FAMILY-COCKER-2026',
    passwordHash,
    status: isSuperAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
    createdAt: new Date().toISOString(),
  };

  usersDb.push(newUser);

  if (!isSuperAdmin) {
    return res.status(201).json({
      status: 'PENDING_APPROVAL',
      message: 'Account created! Your account is currently pending activation by Super Admin Matthieu. You will be able to log in once activated.',
    });
  }

  // Auto-token for Super Admin
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, familyPackId: newUser.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    status: 'ACTIVE',
    token,
    user: { name: newUser.name, email: newUser.email, role: newUser.role, familyPackId: newUser.familyPackId },
  });
});

/**
 * Standard Email/Password Sign-In Endpoint
 * Enforces admin activation check
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  const userEmail = email.toLowerCase().trim();
  const user = usersDb.find((u) => u.email === userEmail);

  if (!user) {
    return res.status(401).json({ error: 'Account not found. Please create an account first.' });
  }

  if (user.status === 'PENDING_APPROVAL') {
    return res.status(403).json({
      error: 'Account Pending Activation: Matthieu (matthieu.jacquet@gmail.com) must activate your account before you can log in.',
    });
  }

  if (user.passwordHash) {
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, familyPackId: user.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    status: 'ACTIVE',
    token,
    user: { name: user.name, email: user.email, role: user.role, familyPackId: user.familyPackId },
  });
});

/**
 * Google OAuth SSO Callback Endpoint
 * Enforces admin activation check
 */
router.post('/google-sso', (req: Request, res: Response) => {
  const { email, name, googleToken } = req.body;

  if (!email || !googleToken) {
    return res.status(400).json({ error: 'Google SSO credentials incomplete.' });
  }

  const userEmail = email.toLowerCase().trim();
  let user = usersDb.find((u) => u.email === userEmail);

  if (!user) {
    const isSuperAdmin = userEmail === 'matthieu.jacquet@gmail.com';
    user = {
      id: `usr-${Date.now()}`,
      email: userEmail,
      name: name || email.split('@')[0],
      role: isSuperAdmin ? 'Husband' : 'Partner',
      familyPackId: 'FAMILY-COCKER-2026',
      status: isSuperAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
    };
    usersDb.push(user);
  }

  if (user.status === 'PENDING_APPROVAL') {
    return res.status(403).json({
      error: 'Account Pending Activation: Matthieu must activate your account before you can log in.',
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, familyPackId: user.familyPackId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    status: 'ACTIVE',
    token,
    user: { name: user.name, email: user.email, role: user.role, familyPackId: user.familyPackId },
  });
});

export default router;
