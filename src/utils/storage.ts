import type { Caretaker, PuppyProfile } from '../types';

const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy';

export const DEFAULT_PUPPIES: PuppyProfile[] = [];

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
];

const STORAGE_KEY_CACHED_PUPPIES = 'puppace_cached_puppies';
const STORAGE_KEY_CACHED_CARETAKERS = 'puppace_cached_caretakers';

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

const STORAGE_KEY_CACHED_ACTIVITIES = 'puppace_cached_activities_recent';
const ACTIVITIES_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes safety TTL for multi-user households

interface StoredActivitiesPayload {
  puppyId: string;
  activities: import('../types').Activity[];
  savedAt: number;
}

export function getStoredRecentActivities(puppyId: string): import('../types').Activity[] | null {
  if (typeof localStorage === 'undefined' || !puppyId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHED_ACTIVITIES);
    if (!raw) return null;
    const { puppyId: id, activities, savedAt }: StoredActivitiesPayload = JSON.parse(raw);
    return id === puppyId && Date.now() - savedAt < ACTIVITIES_CACHE_TTL_MS ? activities : null;
  } catch {
    return null;
  }
}

export function setStoredRecentActivities(puppyId: string, activities: import('../types').Activity[]): void {
  if (typeof localStorage === 'undefined' || !puppyId || !activities) return;
  try {
    localStorage.setItem(
      STORAGE_KEY_CACHED_ACTIVITIES,
      JSON.stringify({ puppyId, activities: activities.slice(0, 300), savedAt: Date.now() })
    );
  } catch {}
}

export function clearAllData(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PUPPY);
    localStorage.removeItem(STORAGE_KEY_CACHED_PUPPIES);
    localStorage.removeItem(STORAGE_KEY_CACHED_CARETAKERS);
    localStorage.removeItem(STORAGE_KEY_CACHED_ACTIVITIES);
  }
}

