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
}

export function getStoredRecentActivities(puppyId: string): import('../types').Activity[] | null {
  if (typeof localStorage === 'undefined' || !puppyId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHED_ACTIVITIES);
    if (!raw) return null;
    // No age limit: the cache only paints the first frame; /api/dashboard replaces it as soon as it answers.
    const { puppyId: id, activities }: StoredActivitiesPayload = JSON.parse(raw);
    return id === puppyId ? activities : null;
  } catch {
    return null;
  }
}

export function setStoredRecentActivities(puppyId: string, activities: import('../types').Activity[]): void {
  if (typeof localStorage === 'undefined' || !puppyId || !activities) return;
  try {
    localStorage.setItem(
      STORAGE_KEY_CACHED_ACTIVITIES,
      JSON.stringify({ puppyId, activities: activities.slice(0, 300) })
    );
  } catch {}
}

