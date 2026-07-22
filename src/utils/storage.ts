import type { Activity, Caretaker, PuppyProfile, UserAccount } from '../types';
import { ActivitySchema, PuppyProfileSchema, CaretakerSchema, UserAccountSchema } from './schemas';
import { z } from 'zod';

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

export const DEFAULT_REGISTERED_USERS: RegisteredUserItem[] = [
  { id: 'usr-1', email: 'matthieu.jacquet@gmail.com', name: 'Matthieu', role: 'Member', status: 'ACTIVE' },
  { id: 'usr-2', email: 'sarah@family.com', name: 'Sarah', role: 'Member', status: 'PENDING_APPROVAL' },
];

// ─── REST API Client Helpers ──────────────────────────────────────────────────
// All CRUD operations go through /api/dogs, /api/activities, /api/households, /api/users
// which are backed by Neon PostgreSQL via Drizzle ORM.

function householdHeaders(): Record<string, string> {
  const user = getStoredUser();
  return {
    'Content-Type': 'application/json',
    'X-Household-ID': user.familyPackId || 'FAMILY-COCKER-2026',
  };
}

// ── Dogs ──

export async function apiFetchDogs(): Promise<PuppyProfile[] | null> {
  try {
    const res = await fetch('/api/dogs', { headers: householdHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem(STORAGE_KEY_PUPPIES, JSON.stringify(data));
        return data;
      }
    }
  } catch {
    // Offline resilient
  }
  return null;
}

export async function apiPostDog(dog: PuppyProfile) {
  try {
    await fetch('/api/dogs', {
      method: 'POST',
      headers: householdHeaders(),
      body: JSON.stringify(dog),
    });
  } catch {
    // Offline fallback
  }
}

export async function apiDeleteDog(dogId: string) {
  try {
    await fetch(`/api/dogs?id=${dogId}`, {
      method: 'DELETE',
      headers: householdHeaders(),
    });
  } catch {
    // Offline fallback
  }
}

// ── Activities ──

export async function apiFetchActivities(puppyId?: string): Promise<Activity[] | null> {
  try {
    const url = puppyId ? `/api/activities?puppyId=${puppyId}` : '/api/activities';
    const res = await fetch(url, { headers: householdHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(data));
        return data;
      }
    }
  } catch {
    // Offline resilient
  }
  return null;
}

export async function apiPostActivity(activity: Activity) {
  try {
    await fetch('/api/activities', {
      method: 'POST',
      headers: householdHeaders(),
      body: JSON.stringify(activity),
    });
  } catch {
    // Offline fallback
  }
}

export async function apiDeleteActivity(activityId: string) {
  try {
    await fetch(`/api/activities?id=${activityId}`, {
      method: 'DELETE',
      headers: householdHeaders(),
    });
  } catch {
    // Offline fallback
  }
}

export function getStoredPuppies(): PuppyProfile[] {
  const stored = localStorage.getItem(STORAGE_KEY_PUPPIES);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const result = z.array(PuppyProfileSchema).safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // fallback
    }
  }
  return DEFAULT_PUPPIES;
}

// Track known activity IDs to only POST genuinely new ones
let _knownActivityIds: Set<string> = new Set();

export function savePuppies(puppies: PuppyProfile[]) {
  localStorage.setItem(STORAGE_KEY_PUPPIES, JSON.stringify(puppies));
  // Upsert each dog to the database (the API handles dedup via id)
  puppies.forEach((p) => apiPostDog(p));
}

export function getActivePuppyId(): string {
  const puppies = getStoredPuppies();
  const storedId = localStorage.getItem(STORAGE_KEY_ACTIVE_PUPPY);
  if (storedId && puppies.some((puppy) => puppy.id === storedId)) return storedId;
  return puppies.length > 0 ? puppies[0].id : '';
}

export function setActivePuppyId(id: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE_PUPPY, id);
}

export function getInitialActivities(): Activity[] {
  const stored = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const result = z.array(ActivitySchema).safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // Fallback
    }
  }
  return [];
}

export function saveActivities(activities: Activity[]) {
  localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
  // Post only activities that are new (not yet known to the backend)
  for (const a of activities) {
    if (!_knownActivityIds.has(a.id)) {
      _knownActivityIds.add(a.id);
      apiPostActivity(a);
    }
  }
}

// Call after fetching remote activities to populate the known set
export function markActivitiesAsKnown(activities: Activity[]) {
  for (const a of activities) {
    _knownActivityIds.add(a.id);
  }
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY_ACTIVITIES);
}

export function getStoredUser(): UserAccount {
  const stored = localStorage.getItem(STORAGE_KEY_USER_ACCOUNT);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const result = UserAccountSchema.safeParse(parsed);
      if (result.success) return result.data;
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
      const parsed = JSON.parse(stored);
      const result = z.array(CaretakerSchema).safeParse(parsed);
      if (result.success) return result.data;
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
