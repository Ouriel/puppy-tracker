import type { Activity, Caretaker, PuppyProfile } from '../types';

const STORAGE_KEY_ACTIVITIES = 'puppace_activities_v1';
const STORAGE_KEY_PROFILE = 'puppace_profile_v1';
const STORAGE_KEY_CARETAKERS = 'puppace_caretakers_v1';
const STORAGE_KEY_CURRENT_USER = 'puppace_current_user_v1';

export const DEFAULT_PROFILE: PuppyProfile = {
  id: 'pup-1',
  name: 'Luna',
  breed: 'Golden Retriever',
  birthDate: '2026-04-10',
  weightKg: 8.5,
  avatarUrl: '/puppy_mascot.jpg',
  targetMealsPerDay: 3,
  dailyFoodGramGoal: 240,
  notes: 'Enthusiastic eater! Responds well to positive treat praise during potty time.',
};

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Matthieu', role: 'Owner', color: '#6366F1' },
  { id: '2', name: 'Partner', role: 'Owner', color: '#EC4899' },
  { id: '3', name: 'Dog Walker', role: 'Walker', color: '#10B981' },
];

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
      type: 'pee',
      timestamp: hoursAgo(1, 15),
      loggedBy: 'Matthieu',
      pottyLocation: 'outside',
      notes: 'Peed right after waking up! Given treat.',
    },
    {
      id: 'sample-2',
      type: 'poop',
      timestamp: hoursAgo(1, 12),
      loggedBy: 'Matthieu',
      pottyLocation: 'outside',
      stoolConsistency: 'normal',
      notes: 'Good firm stool.',
    },
    {
      id: 'sample-3',
      type: 'food',
      timestamp: hoursAgo(3, 45),
      loggedBy: 'Partner',
      foodType: 'kibble',
      quantityGrams: 80,
      quantityCups: 0.75,
      notes: 'Breakfast meal - ate with appetite!',
    },
    {
      id: 'sample-4',
      type: 'water',
      timestamp: hoursAgo(3, 30),
      loggedBy: 'Partner',
      waterAmountMl: 150,
    },
    {
      id: 'sample-5',
      type: 'pee',
      timestamp: hoursAgo(4, 10),
      loggedBy: 'Partner',
      pottyLocation: 'outside',
    },
    {
      id: 'sample-6',
      type: 'nap',
      timestamp: hoursAgo(5, 0),
      durationMinutes: 90,
      loggedBy: 'Matthieu',
      notes: 'Morning crate nap',
    },
    {
      id: 'sample-7',
      type: 'pee',
      timestamp: hoursAgo(7, 30),
      loggedBy: 'Matthieu',
      pottyLocation: 'indoor_accident',
      notes: 'Small accident near balcony door.',
    },
    {
      id: 'sample-8',
      type: 'walk',
      timestamp: hoursAgo(8, 0),
      durationMinutes: 15,
      loggedBy: 'Matthieu',
      notes: 'Gentle neighborhood socialization walk',
    },
    {
      id: 'sample-9',
      type: 'weight',
      timestamp: hoursAgo(24, 0),
      weightKg: 8.5,
      loggedBy: 'Matthieu',
      notes: 'Weekly weigh-in',
    },
  ];

  localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(samples));
  return samples;
}

export function saveActivities(activities: Activity[]) {
  localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
}

export function getStoredProfile(): PuppyProfile {
  const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return DEFAULT_PROFILE;
}

export function saveProfile(profile: PuppyProfile) {
  localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
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

export function getCurrentUser(): string {
  return localStorage.getItem(STORAGE_KEY_CURRENT_USER) || 'Matthieu';
}

export function setCurrentUser(name: string) {
  localStorage.setItem(STORAGE_KEY_CURRENT_USER, name);
}
