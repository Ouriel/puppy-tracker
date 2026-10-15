import type { Caretaker, PuppyProfile } from '../types';

const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy';

export const DEFAULT_PUPPIES: PuppyProfile[] = [];

export const DEFAULT_CARETAKERS: Caretaker[] = [];

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

interface StoredActivitiesPayload {
  puppyId: string;
  activities: import('../types').Activity[];
  // When the server sent them; missing in a cache written before it was recorded
  savedAt?: number;
}

function getStoredActivitiesPayload(puppyId: string): StoredActivitiesPayload | null {
  if (typeof localStorage === 'undefined' || !puppyId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHED_ACTIVITIES);
    if (!raw) return null;
    const payload: StoredActivitiesPayload = JSON.parse(raw);
    return payload.puppyId === puppyId ? payload : null;
  } catch {
    return null;
  }
}

// No age limit: the cache only paints the first frame; /api/dashboard replaces it as soon as it answers.
export function getStoredRecentActivities(puppyId: string): import('../types').Activity[] | null {
  return getStoredActivitiesPayload(puppyId)?.activities ?? null;
}

/** When the server sent the stored logs (ms), or null. */
export function getStoredRecentActivitiesTime(puppyId: string): number | null {
  return getStoredActivitiesPayload(puppyId)?.savedAt ?? null;
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

