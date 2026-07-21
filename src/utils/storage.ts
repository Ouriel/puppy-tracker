import type { Activity, Caretaker, PuppyProfile, UserAccount } from '../types';

const STORAGE_KEY_ACTIVITIES = 'puppace_activities_v2';
const STORAGE_KEY_PUPPIES = 'puppace_puppies_v2';
const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy_v2';
const STORAGE_KEY_USER_ACCOUNT = 'puppace_user_account_v2';
const STORAGE_KEY_CARETAKERS = 'puppace_caretakers_v2';

export const DEFAULT_PUPPIES: PuppyProfile[] = [
  {
    id: 'pup-cocker-1',
    name: 'Charlie',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-04-15', // ~14 weeks
    weightKg: 6.8,
    avatarUrl: '/cocker_spaniel_mascot.jpg',
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 210,
    notes: 'Fluffy golden Cocker Spaniel! Loves outdoor potty praise & kibble toppers.',
  },
  {
    id: 'pup-cocker-2',
    name: 'Bella',
    breed: 'American Cocker Spaniel',
    birthDate: '2026-05-01', // ~12 weeks
    weightKg: 5.4,
    avatarUrl: '/cocker_spaniel_mascot.jpg',
    targetMealsPerDay: 4,
    dailyFoodGramGoal: 180,
    notes: 'Black & tan Cocker Spaniel puppy. Needs potty break ~20 min post meal.',
  },
];

export const DEFAULT_USER: UserAccount = {
  id: 'usr-1',
  name: 'Matthieu',
  email: 'matthieu@family.com',
  role: 'Husband',
  avatarColor: '#6366F1',
  familyPackId: 'FAMILY-COCKER-2026',
};

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Matthieu', role: 'Husband', color: '#6366F1', email: 'matthieu@family.com' },
  { id: '2', name: 'Sarah', role: 'Wife', color: '#EC4899', email: 'sarah@family.com' },
  { id: '3', name: 'Alex', role: 'Dog Walker', color: '#10B981', email: 'alex@dogwalkers.com' },
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

  const now = new Date();
  const hoursAgo = (h: number, m: number = 0) =>
    new Date(now.getTime() - (h * 60 + m) * 60 * 1000).toISOString();

  const samples: Activity[] = [
    {
      id: 'sample-1',
      puppyId: 'pup-cocker-1',
      type: 'pee',
      timestamp: hoursAgo(1, 15),
      loggedBy: 'Matthieu (Husband)',
      pottyLocation: 'outside',
      notes: 'Peed in grass right after waking up!',
    },
    {
      id: 'sample-2',
      puppyId: 'pup-cocker-1',
      type: 'poop',
      timestamp: hoursAgo(1, 12),
      loggedBy: 'Matthieu (Husband)',
      pottyLocation: 'outside',
      stoolConsistency: 'normal',
      notes: 'Good firm stool.',
    },
    {
      id: 'sample-3',
      puppyId: 'pup-cocker-1',
      type: 'food',
      timestamp: hoursAgo(3, 45),
      loggedBy: 'Sarah (Wife)',
      foodType: 'kibble',
      quantityGrams: 70,
      quantityCups: 0.65,
      notes: 'Breakfast meal - ate enthusiastically!',
    },
    {
      id: 'sample-4',
      puppyId: 'pup-cocker-2',
      type: 'pee',
      timestamp: hoursAgo(2, 10),
      loggedBy: 'Sarah (Wife)',
      pottyLocation: 'outside',
      notes: 'Bella peed outside after morning play',
    },
    {
      id: 'sample-5',
      puppyId: 'pup-cocker-2',
      type: 'food',
      timestamp: hoursAgo(2, 30),
      loggedBy: 'Sarah (Wife)',
      foodType: 'kibble',
      quantityGrams: 50,
      quantityCups: 0.5,
      notes: 'Morning bowl fed',
    },
  ];

  localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(samples));
  return samples;
}

export function saveActivities(activities: Activity[]) {
  localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
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
