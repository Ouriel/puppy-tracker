import type { Caretaker, PuppyProfile, UserAccount } from '../types';

const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy';

export const DEFAULT_PUPPIES: PuppyProfile[] = [];

export const DEFAULT_USER: UserAccount = {
  id: 'usr-default',
  name: 'Matthieu',
  email: 'matthieu.jacquet@gmail.com',
  role: 'Member',
  avatarColor: '#6366F1',
  familyPackId: 'FAMILY-COCKER-2026',
};

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
];

export function getStoredUser(): UserAccount {
  return DEFAULT_USER;
}

export function getStoredCaretakers(): Caretaker[] {
  return DEFAULT_CARETAKERS;
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
  }
}
