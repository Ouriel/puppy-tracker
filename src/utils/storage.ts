import type { Activity, Caretaker, PuppyProfile, UserAccount } from '../types';

const STORAGE_KEY_ACTIVITIES = 'puppace_activities_v3';
const STORAGE_KEY_PUPPIES = 'puppace_puppies_v3';
const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy_v3';
const STORAGE_KEY_USER_ACCOUNT = 'puppace_user_account_v3';
const STORAGE_KEY_CARETAKERS = 'puppace_caretakers_v3';

// Empty defaults for standard production install
export const DEFAULT_PUPPIES: PuppyProfile[] = [
  {
    id: 'pup-1',
    name: 'Milo',
    breed: 'Cocker Spaniel',
    birthDate: '2026-05-01',
    weightKg: 5.8,
    avatarUrl: '/cocker_spaniel_mascot.jpg',
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 200,
    notes: 'Enter puppy notes here...',
  },
];

export const DEFAULT_USER: UserAccount = {
  id: 'usr-default',
  name: 'Owner',
  email: '',
  role: 'Partner',
  avatarColor: '#6366F1',
  familyPackId: 'FAMILY-SYNC-PACK',
};

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Owner', role: 'Partner', color: '#6366F1' },
];

export function getStoredPuppies(): PuppyProfile[] {
  const stored = localStorage.getItem(STORAGE_KEY_PUPPIES);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fallback
    }
  }
  localStorage.setItem(STORAGE_KEY_PUPPIES, JSON.stringify(DEFAULT_PUPPIES));
  return DEFAULT_PUPPIES;
}

export function savePuppies(puppies: PuppyProfile[]) {
  localStorage.setItem(STORAGE_KEY_PUPPIES, JSON.stringify(puppies));
}

export function getActivePuppyId(): string {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_PUPPY) || DEFAULT_PUPPIES[0].id;
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
  // Standard empty logs on clean launch
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
