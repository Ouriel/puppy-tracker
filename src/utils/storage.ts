import type { Activity, Caretaker, PuppyProfile, UserAccount } from '../types';

const STORAGE_KEY_ACTIVITIES = 'puppace_activities_v4';
const STORAGE_KEY_PUPPIES = 'puppace_puppies_v4';
const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy_v4';
const STORAGE_KEY_USER_ACCOUNT = 'puppace_user_account_v4';
const STORAGE_KEY_CARETAKERS = 'puppace_caretakers_v4';
const STORAGE_KEY_REGISTERED_USERS = 'puppace_registered_users_v4';

export interface RegisteredUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL';
}

// Production defaults start empty
export const DEFAULT_PUPPIES: PuppyProfile[] = [];

export const DEFAULT_USER: UserAccount = {
  id: 'usr-default',
  name: 'Matthieu',
  email: 'matthieu.jacquet@gmail.com',
  role: 'Husband',
  avatarColor: '#6366F1',
  familyPackId: 'FAMILY-COCKER-2026',
};

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Matthieu', role: 'Husband', color: '#6366F1' },
];

export const DEFAULT_REGISTERED_USERS: RegisteredUserItem[] = [
  { id: 'usr-1', email: 'matthieu.jacquet@gmail.com', name: 'Matthieu', role: 'Husband', status: 'ACTIVE' },
  { id: 'usr-2', email: 'sarah@family.com', name: 'Sarah', role: 'Wife', status: 'PENDING_APPROVAL' },
];

export function getStoredPuppies(): PuppyProfile[] {
  const stored = localStorage.getItem(STORAGE_KEY_PUPPIES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  return DEFAULT_PUPPIES;
}

export function savePuppies(puppies: PuppyProfile[]) {
  localStorage.setItem(STORAGE_KEY_PUPPIES, JSON.stringify(puppies));
}

export function getActivePuppyId(): string {
  const puppies = getStoredPuppies();
  const storedId = localStorage.getItem(STORAGE_KEY_ACTIVE_PUPPY);
  if (storedId && puppies.some((p) => p.id === storedId)) return storedId;
  return puppies.length > 0 ? puppies[0].id : '';
}

export function setActivePuppyId(id: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE_PUPPY, id);
}

export function getInitialActivities(): Activity[] {
  const stored = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fallback
    }
  }
  return [];
}

export function saveActivities(activities: Activity[]) {
  localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY_ACTIVITIES);
}

export function getStoredUser(): UserAccount {
  const stored = localStorage.getItem(STORAGE_KEY_USER_ACCOUNT);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return DEFAULT_USER;
}

export function saveUser(user: UserAccount) {
  localStorage.setItem(STORAGE_KEY_USER_ACCOUNT, JSON.stringify(user));
}

export function getStoredCaretakers(): Caretaker[] {
  const stored = localStorage.getItem(STORAGE_KEY_CARETAKERS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return DEFAULT_CARETAKERS;
}

export function saveCaretakers(caretakers: Caretaker[]) {
  localStorage.setItem(STORAGE_KEY_CARETAKERS, JSON.stringify(caretakers));
}

export function getStoredRegisteredUsers(): RegisteredUserItem[] {
  const stored = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return DEFAULT_REGISTERED_USERS;
}

export function saveRegisteredUsers(users: RegisteredUserItem[]) {
  localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
}
