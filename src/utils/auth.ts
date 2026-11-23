import type { UserAccount } from '../types/index.js';

// The owner's email, from SUPER_ADMIN_EMAIL (Vercel production and preview): for the API only. The browser has no
// process.env, so there it is '' and no one matches: the app knows the owner by the session's role (SuperAdmin).
const getSuperAdminEmail = (): string =>
  ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SUPER_ADMIN_EMAIL ?? '').trim();

export const SUPER_ADMIN_EMAIL: string = getSuperAdminEmail();

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email || !SUPER_ADMIN_EMAIL) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

const TOKEN_KEY = 'puppace_auth_token';
const USER_KEY = 'puppace_auth_user';

// Read on first use: where storage is blocked (Safari "Block All Cookies"), any touch of it, `typeof` included, throws,
// so every access sits in a try and the session then lasts until the page closes
let _authToken: string | null = null;

export function getAuthToken(): string | null {
  if (!_authToken) {
    try {
      _authToken = localStorage.getItem(TOKEN_KEY);
    } catch {}
  }
  return _authToken;
}

export function setAuthToken(token: string | null): void {
  _authToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function getStoredAuthUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
}

export function clearAuthToken(): void {
  _authToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}
