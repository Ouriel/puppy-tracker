import type { Caretaker, PuppyProfile, UserAccount } from '../types';
import { SUPER_ADMIN_EMAIL } from '../constants/auth';

const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy';

export const DEFAULT_PUPPIES: PuppyProfile[] = [];

export const DEFAULT_USER: UserAccount = {
  id: 'usr-default',
  name: 'Matthieu',
  email: SUPER_ADMIN_EMAIL,
  role: 'Member',
  avatarColor: '#6366F1',
  familyPackId: 'FAMILY-COCKER-2026',
};

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
];

const STORAGE_KEY_CACHED_PUPPIES = 'puppace_cached_puppies';
const STORAGE_KEY_CACHED_CARETAKERS = 'puppace_cached_caretakers';

export function getStoredUser(): UserAccount {
  return DEFAULT_USER;
}

export function getStoredPuppies(): PuppyProfile[] {
  if (typeof localStorage === 'undefined') return DEFAULT_PUPPIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHED_PUPPIES);
    return raw ? JSON.parse(raw) : DEFAULT_PUPPIES;
  } catch {
    return DEFAULT_PUPPIES;
  }
}

export function setStoredPuppies(puppies: PuppyProfile[]): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CACHED_PUPPIES, JSON.stringify(puppies));
    } catch {}
  }
}

export function getStoredCaretakers(): Caretaker[] {
  if (typeof localStorage === 'undefined') return DEFAULT_CARETAKERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHED_CARETAKERS);
    return raw ? JSON.parse(raw) : DEFAULT_CARETAKERS;
  } catch {
    return DEFAULT_CARETAKERS;
  }
}

export function setStoredCaretakers(caretakers: Caretaker[]): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CACHED_CARETAKERS, JSON.stringify(caretakers));
    } catch {}
  }
}

export function getActivePuppyId(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_ACTIVE_PUPPY) || '';
}

export function setActivePuppyId(id: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PUPPY, id);
  }
}

export function clearAllData(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PUPPY);
    localStorage.removeItem(STORAGE_KEY_CACHED_PUPPIES);
    localStorage.removeItem(STORAGE_KEY_CACHED_CARETAKERS);
  }
}

