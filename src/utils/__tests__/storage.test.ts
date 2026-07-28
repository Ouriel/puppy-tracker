import { describe, it, expect, beforeEach } from 'vitest';
import { getAuthToken, setAuthToken, clearAuthToken } from '../auth';

// In-memory localStorage mock for node environment testing
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, val),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = localStorageMock as any;
}

describe('Auth Token Manager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    clearAuthToken();
  });

  it('should set, retrieve, and clear authentication token', () => {
    expect(getAuthToken()).toBeNull();

    setAuthToken('test-token-123');
    expect(getAuthToken()).toBe('test-token-123');

    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });
});
