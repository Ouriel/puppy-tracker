import type { Activity, Caretaker, PuppyProfile, UserAccount } from '../types';
import { ActivitySchema, PuppyProfileSchema, CaretakerSchema, UserAccountSchema } from './schemas';
import { z } from 'zod';
import { showToast } from './toast';

const STORAGE_KEY_ACTIVITIES = 'puppace_activities_v4';
const STORAGE_KEY_PUPPIES = 'puppace_puppies_v4';
const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy_v4';
const STORAGE_KEY_USER_ACCOUNT = 'puppace_user_account_v4';
const STORAGE_KEY_CARETAKERS = 'puppace_caretakers_v4';

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

let _authToken: string | null = null;
export function setAuthToken(token: string | null) {
  _authToken = token;
}
export function getAuthToken(): string | null {
  return _authToken;
}

function householdHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  return headers;
}

function handle401(res: Response) {
  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('puppace:unauthorized'));
  }
}

// ── Authentication API ──

export async function apiAuthenticate(googleToken: string): Promise<{ success: boolean; token?: string; error?: string; isPending?: boolean }> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.token) {
      setAuthToken(body.token);
      localStorage.setItem('puppace_auth_token', body.token);
      return { success: true, token: body.token };
    }
    return { success: false, error: body.error || 'Authentication failed', isPending: body.isPending };
  } catch (err: any) {
    return { success: false, error: 'Network error authenticating with server' };
  }
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
    } else {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) fetching dogs`, 'error');
    }
  } catch {
    showToast('Failed to sync dogs with server. Changes saved locally.', 'error');
  }
  return null;
}

export async function apiPostDog(dog: PuppyProfile): Promise<boolean> {
  try {
    const res = await fetch('/api/dogs', {
      method: 'POST',
      headers: householdHeaders(),
      body: JSON.stringify(dog),
    });
    if (res.ok) {
      _knownDogIds.add(dog.id);
      return true;
    } else {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) saving dog`, 'error');
    }
  } catch {
    showToast('Failed to save dog profile to server. Changes saved locally.', 'error');
  }
  return false;
}

export async function apiDeleteDog(dogId: string) {
  try {
    const res = await fetch(`/api/dogs?id=${dogId}`, {
      method: 'DELETE',
      headers: householdHeaders(),
    });
    if (!res.ok) {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) deleting dog`, 'error');
    }
  } catch {
    showToast('Failed to delete dog on server.', 'error');
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
    } else {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) fetching activities`, 'error');
    }
  } catch {
    showToast('Failed to sync activities with server. Changes saved locally.', 'error');
  }
  return null;
}

export async function apiPostActivity(activity: Activity): Promise<boolean> {
  try {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: householdHeaders(),
      body: JSON.stringify(activity),
    });
    if (res.ok) {
      _knownActivityIds.add(activity.id);
      return true;
    } else {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) saving activity`, 'error');
    }
  } catch {
    showToast('Failed to save activity to server. Changes saved locally.', 'error');
  }
  return false;
}

export async function apiDeleteActivity(activityId: string) {
  try {
    const res = await fetch(`/api/activities?id=${activityId}`, {
      method: 'DELETE',
      headers: householdHeaders(),
    });
    if (!res.ok) {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) deleting activity`, 'error');
    }
  } catch {
    showToast('Failed to delete activity on server.', 'error');
  }
}

// ── Health Records API Helpers ──

export async function apiFetchHealthRecords(puppyId: string, type?: string): Promise<any[] | null> {
  try {
    const url = type
      ? `/api/health-records?puppyId=${puppyId}&type=${type}`
      : `/api/health-records?puppyId=${puppyId}`;
    const res = await fetch(url, { headers: householdHeaders() });
    if (res.ok) return await res.json();
    handle401(res);
    const body = await res.json().catch(() => ({}));
    showToast(body.error || `Server error (${res.status}) fetching health records`, 'error');
  } catch {
    showToast('Failed to fetch health records from server.', 'error');
  }
  return null;
}

export async function apiPostHealthRecord(record: any) {
  try {
    const res = await fetch('/api/health-records', {
      method: 'POST',
      headers: householdHeaders(),
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) saving health record`, 'error');
    }
  } catch {
    showToast('Failed to save health record to server.', 'error');
  }
}

export async function apiDeleteHealthRecord(id: string) {
  try {
    const res = await fetch(`/api/health-records?id=${id}`, {
      method: 'DELETE',
      headers: householdHeaders(),
    });
    if (!res.ok) {
      handle401(res);
      const body = await res.json().catch(() => ({}));
      showToast(body.error || `Server error (${res.status}) deleting health record`, 'error');
    }
  } catch {
    showToast('Failed to delete health record on server.', 'error');
  }
}

// ── Users API Helpers ──

export async function apiFetchUsers(): Promise<RegisteredUserItem[] | null> {
  try {
    const res = await fetch('/api/users', { headers: householdHeaders() });
    if (res.ok) return await res.json();
    handle401(res);
    const body = await res.json().catch(() => ({}));
    showToast(body.error || `Server error (${res.status}) fetching users`, 'error');
  } catch {
    showToast('Failed to fetch users from server.', 'error');
  }
  return null;
}

export async function apiPostUser(user: Partial<RegisteredUserItem>) {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: householdHeaders(),
      body: JSON.stringify(user),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      handle401(res);
      showToast(body.error || `Server error (${res.status}) saving user`, 'error');
      return null;
    }
    return body;
  } catch {
    showToast('Failed to save user to server.', 'error');
    return null;
  }
}

export async function apiPutUser(user: Partial<RegisteredUserItem>) {
  try {
    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: householdHeaders(),
      body: JSON.stringify(user),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      handle401(res);
      showToast(body.error || `Server error (${res.status}) updating user`, 'error');
      return null;
    }
    return body;
  } catch {
    showToast('Failed to update user on server.', 'error');
    return null;
  }
}

export async function apiDeleteUser(email: string) {
  try {
    const res = await fetch(`/api/users?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: householdHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      handle401(res);
      showToast(body.error || `Server error (${res.status}) deleting user`, 'error');
      return false;
    }
    return true;
  } catch {
    showToast('Failed to delete user on server.', 'error');
    return false;
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

// Track known IDs to only POST genuinely new items
let _knownActivityIds: Set<string> = new Set();
let _knownDogIds: Set<string> = new Set();

export function markDogsAsKnown(dogs: PuppyProfile[]) {
  dogs.forEach((d) => _knownDogIds.add(d.id));
}

export function savePuppies(puppies: PuppyProfile[]) {
  localStorage.setItem(STORAGE_KEY_PUPPIES, JSON.stringify(puppies));
  for (const p of puppies) {
    if (!_knownDogIds.has(p.id)) {
      apiPostDog(p);
    }
  }
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
