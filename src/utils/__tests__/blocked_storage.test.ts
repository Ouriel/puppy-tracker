// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UserAccount } from '../../types';

// Safari with "Block All Cookies": any touch of localStorage, `typeof` included, throws
beforeEach(() => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  });
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('with storage blocked, the app still loads without its cache', () => {
  it('auth.ts imports, and its helpers keep the session in memory only', async () => {
    const auth = await import('../auth');

    expect(auth.getAuthToken()).toBeNull();
    auth.setAuthToken('token-1');
    expect(auth.getAuthToken()).toBe('token-1');
    auth.setStoredAuthUser({ email: 'owner@example.com' } as UserAccount);
    expect(auth.getStoredAuthUser()).toBeNull();
    auth.clearAuthToken();
    expect(auth.getAuthToken()).toBeNull();
  });

  it('storage.ts reads give their empty value and writes are skipped', async () => {
    const storage = await import('../storage');

    expect(storage.getActivePuppyId()).toBe('');
    storage.setActivePuppyId('pup-1');
    expect(storage.getStoredPuppies()).toEqual([]);
    storage.setStoredPuppies([]);
    expect(storage.getStoredCaretakers()).toEqual([]);
    storage.setStoredCaretakers([]);
    expect(storage.getStoredRecentActivities('pup-1')).toBeNull();
    storage.setStoredRecentActivities('pup-1', []);
    expect(storage.getStoredHealthRecords()).toBeNull();
    storage.setStoredHealthRecords([]);
  });
});
