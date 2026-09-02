import type { UserAccount } from '../types/index.js';

const getSuperAdminEmail = (): string => {
  const globalEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (globalEnv?.SUPER_ADMIN_EMAIL) {
    return globalEnv.SUPER_ADMIN_EMAIL;
  }
  return 'matthieu.jacquet@gmail.com';
};

export const SUPER_ADMIN_EMAIL: string = getSuperAdminEmail();

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

const TOKEN_KEY = 'puppace_auth_token';
const USER_KEY = 'puppace_auth_user';

let _authToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export function getAuthToken(): string | null {
  if (!_authToken && typeof localStorage !== 'undefined') {
    _authToken = localStorage.getItem(TOKEN_KEY);
  }
  return _authToken;
}

export function setAuthToken(token: string | null): void {
  _authToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export function getStoredAuthUser(): UserAccount | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: UserAccount | null): void {
  if (typeof localStorage === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function clearAuthToken(): void {
  _authToken = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
