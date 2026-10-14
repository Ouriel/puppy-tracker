// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exchangeSessionToken } from '../../services/api';
import { getAuthToken, setAuthToken, setStoredAuthUser, getStoredAuthUser, clearAuthToken } from '../auth';

// S1 client + S4: a revoked session (401/403) ends the session and returns to the lock screen;
// a server error or a network failure never does.
describe('exchangeSessionToken session revocation', () => {
  const unauthorizedListener = vi.fn();

  beforeEach(() => {
    setAuthToken('stored-session-token');
    setStoredAuthUser({ id: 'u-1', email: 'user@example.com', name: 'Matthieu', role: 'Member' });
    window.addEventListener('puppace:unauthorized', unauthorizedListener);
  });

  afterEach(() => {
    window.removeEventListener('puppace:unauthorized', unauthorizedListener);
    unauthorizedListener.mockClear();
    vi.unstubAllGlobals();
    clearAuthToken();
  });

  it.each([401, 403])('clears the token and dispatches puppace:unauthorized on %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Session revoked' }), { status })));

    const result = await exchangeSessionToken();

    expect(result).toEqual({ ok: false, error: 'Session revoked', status });
    expect(getAuthToken()).toBeNull();
    expect(getStoredAuthUser()).toBeNull();
    expect(unauthorizedListener).toHaveBeenCalledTimes(1);
  });

  it('leaves a newer session alone when an older token is rejected (re-login during the deferred exchange)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Session revoked' }), { status: 401 })));

    await exchangeSessionToken('expired-token-captured-at-boot');

    expect(getAuthToken()).toBe('stored-session-token');
    expect(unauthorizedListener).not.toHaveBeenCalled();
  });

  it('keeps the session on a 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));

    const result = await exchangeSessionToken();

    expect(result.ok).toBe(false);
    expect(getAuthToken()).toBe('stored-session-token');
    expect(unauthorizedListener).not.toHaveBeenCalled();
  });

  it('keeps the session on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await exchangeSessionToken();

    expect(result).toEqual({ ok: false, error: 'Failed to fetch', status: 0 });
    expect(getAuthToken()).toBe('stored-session-token');
    expect(unauthorizedListener).not.toHaveBeenCalled();
  });
});
