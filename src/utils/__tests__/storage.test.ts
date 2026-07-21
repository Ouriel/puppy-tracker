import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredPuppies,
  savePuppies,
  getStoredRegisteredUsers,
  saveRegisteredUsers,
  type RegisteredUserItem,
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

  it('should store and retrieve registered users for Admin view', () => {
    const users: RegisteredUserItem[] = [
      { id: 'u1', email: 'matthieu.jacquet@gmail.com', name: 'Matthieu', role: 'Husband', status: 'ACTIVE' },
      { id: 'u2', email: 'sarah@family.com', name: 'Sarah', role: 'Wife', status: 'PENDING_APPROVAL' },
    ];

    saveRegisteredUsers(users);
    const retrieved = getStoredRegisteredUsers();
    expect(retrieved).toHaveLength(2);
    expect(retrieved[1].email).toBe('sarah@family.com');
  });

  it('should correctly delete a registered user account', () => {
    const users: RegisteredUserItem[] = [
      { id: 'u1', email: 'matthieu.jacquet@gmail.com', name: 'Matthieu', role: 'Husband', status: 'ACTIVE' },
      { id: 'u2', email: 'sarah@family.com', name: 'Sarah', role: 'Wife', status: 'PENDING_APPROVAL' },
    ];

    saveRegisteredUsers(users);
    const filtered = getStoredRegisteredUsers().filter((u) => u.id !== 'u2');
    saveRegisteredUsers(filtered);

    const updated = getStoredRegisteredUsers();
    expect(updated).toHaveLength(1);
    expect(updated[0].email).toBe('matthieu.jacquet@gmail.com');
  });
});
