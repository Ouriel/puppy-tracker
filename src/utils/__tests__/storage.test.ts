import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredPuppies,
  savePuppies,
} from '../storage';
import type { PuppyProfile } from '../../types';

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

describe('Storage Persistence & Account Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should store and retrieve dog profiles cleanly', () => {
    const samplePuppy: PuppyProfile = {
      id: 'pup-999',
      name: 'Luna',
      breed: 'French Bulldog',
      birthDate: '2026-01-01',
      weightKg: 6.5,
      targetMealsPerDay: 3,
      dailyFoodGramGoal: 180,
    };

    savePuppies([samplePuppy]);
    const retrieved = getStoredPuppies();
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].name).toBe('Luna');
    expect(retrieved[0].breed).toBe('French Bulldog');
  });
});
