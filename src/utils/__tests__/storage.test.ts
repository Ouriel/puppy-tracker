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

import {
  getStoredPuppies,
  setStoredPuppies,
  getStoredCaretakers,
  setStoredCaretakers,
  getStoredRecentActivities,
  setStoredRecentActivities,
  DEFAULT_PUPPIES,
  DEFAULT_CARETAKERS,
} from '../storage';
import { act } from './fixtures';

describe('Storage Helpers Cache Suite', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return defaults when cache is empty', () => {
    expect(getStoredPuppies()).toEqual(DEFAULT_PUPPIES);
    expect(getStoredCaretakers()).toEqual(DEFAULT_CARETAKERS);
  });

  it('should persist and retrieve puppies and caretakers from localStorage', () => {
    const mockPuppy = [
      {
        id: 'pup-balma',
        name: 'Balma',
        breed: 'English Cocker Spaniel',
        birthDate: '2026-03-27',
        weightKg: 7.8,
        dailyFoodGramGoal: 240,
        targetMealsPerDay: 3,
      },
    ];
    setStoredPuppies(mockPuppy);
    expect(getStoredPuppies()).toEqual(mockPuppy);

    const mockCaretakers = [
      { id: 'ct-1', name: 'Matthieu', role: 'Husband' as const, color: '#6366F1' },
      { id: 'ct-2', name: 'Daria', role: 'Wife' as const, color: '#EC4899' },
    ];
    setStoredCaretakers(mockCaretakers);
    expect(getStoredCaretakers()).toEqual(mockCaretakers);

    setStoredPuppies([]);
    expect(getStoredPuppies()).toEqual(DEFAULT_PUPPIES);
  });

  it('should persist and retrieve up to 300 recent activities within TTL window', () => {
    expect(getStoredRecentActivities('pup-1')).toBeNull();

    // Newest first, as the API returns them: the cache must keep the 300 most recent.
    const newestLog = Date.parse('2026-08-08T12:00:00.000Z');
    const mockActivities = Array.from({ length: 350 }, (_, index) =>
      act('pee', new Date(newestLog - index * 60_000).toISOString(), { id: `act-${index}`, puppyId: 'pup-1' })
    );

    setStoredRecentActivities('pup-1', mockActivities);
    const cached = getStoredRecentActivities('pup-1');
    expect(cached).not.toBeNull();
    expect(cached?.length).toBe(300);
    expect(cached?.[0].id).toBe('act-0');

    // Query for different puppy should return null
    expect(getStoredRecentActivities('pup-2')).toBeNull();
  });
});

