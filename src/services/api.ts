import type { Activity, PuppyProfile, Caretaker, RegisteredUserItem, HealthRecord } from '../types';
import { getAuthToken, clearAuthToken } from '../utils/auth';
import { showToast } from '../utils/toast';
import { saveToOfflineQueue } from '../utils/storage';

export type { RegisteredUserItem };

const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds SWR cache

export function clearApiCache() {
  apiCache.clear();
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T | null> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...getHeaders(), ...(options.headers || {}) };

  // For GET requests, serve from in-memory cache instantly (0ms latency on tab switch)
  if (method === 'GET') {
    const cached = apiCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      // Revalidate in background asynchronously
      fetch(url, { ...options, headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((freshData) => {
          if (freshData) apiCache.set(url, { data: freshData, timestamp: Date.now() });
        })
        .catch(() => {});
      return cached.data as T;
    }
  } else {
    // Invalidate cache on mutations (POST, PUT, DELETE)
    apiCache.clear();
  }

  try {
    const res = await fetch(url, { ...options, headers });

    if (res.ok) {
      if (res.status === 204) return {} as T;
      const data = await res.json();
      if (method === 'GET') {
        apiCache.set(url, { data, timestamp: Date.now() });
      }
      return data as T;
    }

    if (res.status === 401) {
      clearAuthToken();
      apiCache.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('puppace:unauthorized'));
      }
      return null;
    }

    const body = await res.json().catch(() => ({}));
    showToast(body.error || `Server error (${res.status})`, 'error');
    return null;
  } catch (err: any) {
    console.error(`API request error on ${url}:`, err);
    showToast('Network error connecting to server.', 'error');
    return null;
  }
}

// ── Dogs API ──

export async function fetchDogs(): Promise<PuppyProfile[] | null> {
  return request<PuppyProfile[]>('/api/dogs');
}

export async function createDog(dog: PuppyProfile): Promise<PuppyProfile | null> {
  return request<PuppyProfile>('/api/dogs', {
    method: 'POST',
    body: JSON.stringify(dog),
  });
}

export async function updateDog(dog: Partial<PuppyProfile> & { id: string }): Promise<PuppyProfile | null> {
  return request<PuppyProfile>('/api/dogs', {
    method: 'PUT',
    body: JSON.stringify(dog),
  });
}

export async function deleteDog(id: string): Promise<boolean> {
  const res = await request<{ success: boolean }>(`/api/dogs?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return !!res?.success;
}

// ── Activities API ──

export async function fetchActivities(puppyId?: string): Promise<Activity[] | null> {
  const url = puppyId ? `/api/activities?puppyId=${encodeURIComponent(puppyId)}` : '/api/activities';
  return request<Activity[]>(url);
}

export async function createActivity(activity: Omit<Activity, 'id'> & { id?: string }): Promise<Activity | null> {
  const prepared: Activity = {
    ...activity,
    id: activity.id || `act-${Date.now()}`,
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    saveToOfflineQueue(prepared);
    showToast('Saved offline. Will sync when reconnected.', 'info');
    return prepared;
  }

  const created = await request<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(prepared),
  });

  if (!created) {
    saveToOfflineQueue(prepared);
    showToast('Saved offline. Will sync when reconnected.', 'info');
    return prepared;
  }

  return created;
}

export async function deleteActivity(id: string): Promise<boolean> {
  const res = await request<{ success: boolean }>(`/api/activities?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return !!res?.success;
}

// ── Health Records API ──

export async function fetchHealthRecords(puppyId: string, type?: string): Promise<HealthRecord[] | null> {
  const url = type
    ? `/api/health-records?puppyId=${encodeURIComponent(puppyId)}&type=${encodeURIComponent(type)}`
    : `/api/health-records?puppyId=${encodeURIComponent(puppyId)}`;
  return request<HealthRecord[]>(url);
}

export async function createHealthRecord(record: Omit<HealthRecord, 'id' | 'householdId'> & { id?: string }): Promise<HealthRecord | null> {
  return request<HealthRecord>('/api/health-records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export async function deleteHealthRecord(id: string): Promise<boolean> {
  const res = await request<{ success: boolean }>(`/api/health-records?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return !!res?.success;
}

// ── Household & Caretakers API ──

export async function fetchHousehold(): Promise<{ caretakers: Caretaker[] } | null> {
  return request<{ caretakers: Caretaker[] }>('/api/households');
}

export async function createCaretaker(caretaker: Partial<Caretaker>): Promise<Caretaker | null> {
  return request<Caretaker>('/api/households', {
    method: 'POST',
    body: JSON.stringify(caretaker),
  });
}

export async function deleteCaretaker(id: string): Promise<boolean> {
  const res = await request<{ success: boolean }>(`/api/households?caretakerId=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return !!res?.success;
}

// ── Users API ──

export async function fetchUsers(): Promise<RegisteredUserItem[] | null> {
  return request<RegisteredUserItem[]>('/api/users');
}

export async function createUser(user: Partial<RegisteredUserItem>): Promise<RegisteredUserItem | null> {
  return request<RegisteredUserItem>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export async function updateUser(user: Partial<RegisteredUserItem>): Promise<RegisteredUserItem | null> {
  return request<RegisteredUserItem>('/api/users', {
    method: 'PUT',
    body: JSON.stringify(user),
  });
}

export async function deleteUser(email: string): Promise<boolean> {
  const res = await request<{ success: boolean }>(`/api/users?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  return !!res?.success;
}

export async function exchangeSessionToken(rawToken?: string): Promise<{ sessionToken: string; user: RegisteredUserItem } | null> {
  const token = rawToken || getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.error('Failed to exchange session token', err);
  }
  return null;
}

