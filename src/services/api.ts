import type { Activity, PuppyProfile, Caretaker, RegisteredUserItem, HealthRecord } from '../types';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/auth';

export type { RegisteredUserItem };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

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

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
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
      return { ok: true, data: cached.data as T };
    }
  } else {
    // Invalidate cache on mutations (POST, PUT, DELETE)
    apiCache.clear();
  }

  try {
    const res = await fetch(url, { ...options, headers });

    if (res.ok) {
      const data = res.status === 204 ? ({} as T) : await res.json();
      if (method === 'GET') {
        apiCache.set(url, { data, timestamp: Date.now() });
      }
      return { ok: true, data: data as T };
    }

    if (res.status === 401) {
      clearAuthToken();
      apiCache.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('puppace:unauthorized'));
      }
      return { ok: false, error: 'Unauthorized', status: 401 };
    }

    const body = await res.json().catch(() => ({}));
    const errorMsg = body.error || `Server error (${res.status})`;
    return { ok: false, error: errorMsg, status: res.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error connecting to server.';
    console.error(`API request error on ${url}:`, message);
    return { ok: false, error: message, status: 0 };
  }
}

// ── Dogs API ──

export async function fetchDogs(): Promise<ApiResult<PuppyProfile[]>> {
  return request<PuppyProfile[]>('/api/dogs');
}

export async function createDog(dog: PuppyProfile): Promise<ApiResult<PuppyProfile>> {
  return request<PuppyProfile>('/api/dogs', {
    method: 'POST',
    body: JSON.stringify(dog),
  });
}

export async function updateDog(dog: Partial<PuppyProfile> & { id: string }): Promise<ApiResult<PuppyProfile>> {
  return request<PuppyProfile>('/api/dogs', {
    method: 'PUT',
    body: JSON.stringify(dog),
  });
}

export async function deleteDog(id: string): Promise<ApiResult<{ success: boolean; deletedId: string }>> {
  return request<{ success: boolean; deletedId: string }>(`/api/dogs?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── Activities API ──

export async function fetchActivities(
  puppyId?: string,
  options?: { days?: number; limit?: number; offset?: number }
): Promise<ApiResult<Activity[]>> {
  const params = new URLSearchParams();
  if (puppyId) params.append('puppyId', puppyId);
  if (options?.days) params.append('days', String(options.days));
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));

  const queryString = params.toString();
  const url = queryString ? `/api/activities?${queryString}` : '/api/activities';
  return request<Activity[]>(url);
}

export async function createActivity(activity: Omit<Activity, 'id'> & { id?: string }): Promise<ApiResult<Activity>> {
  const prepared: Activity = {
    ...activity,
    id: activity.id || `act-${Date.now()}`,
  };

  return request<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(prepared),
  });
}

export async function updateActivity(activity: Partial<Activity> & { id: string }): Promise<ApiResult<Activity>> {
  return request<Activity>('/api/activities', {
    method: 'PUT',
    body: JSON.stringify(activity),
  });
}

export async function deleteActivity(id: string): Promise<ApiResult<{ success: boolean; deletedId: string }>> {
  return request<{ success: boolean; deletedId: string }>(`/api/activities?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── Health Records API ──

export async function fetchHealthRecords(puppyId: string, type?: string): Promise<ApiResult<HealthRecord[]>> {
  const url = type
    ? `/api/health-records?puppyId=${encodeURIComponent(puppyId)}&type=${encodeURIComponent(type)}`
    : `/api/health-records?puppyId=${encodeURIComponent(puppyId)}`;
  return request<HealthRecord[]>(url);
}

export async function createHealthRecord(record: Omit<HealthRecord, 'id' | 'householdId'> & { id?: string }): Promise<ApiResult<HealthRecord>> {
  return request<HealthRecord>('/api/health-records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export async function updateHealthRecord(record: Partial<HealthRecord> & { id: string }): Promise<ApiResult<HealthRecord>> {
  return request<HealthRecord>('/api/health-records', {
    method: 'PUT',
    body: JSON.stringify(record),
  });
}

export async function deleteHealthRecord(id: string): Promise<ApiResult<{ success: boolean; deletedId: string }>> {
  return request<{ success: boolean; deletedId: string }>(`/api/health-records?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── Household & Caretakers API ──

export async function fetchHousehold(): Promise<ApiResult<{ caretakers: Caretaker[] }>> {
  return request<{ caretakers: Caretaker[] }>('/api/households');
}

export async function fetchAllHouseholds(): Promise<ApiResult<Array<{ id: string; name: string; familyPackId?: string }>>> {
  const res = await request<{ households: Array<{ id: string; name: string; familyPackId?: string }> }>('/api/households?all=true');
  if (res.ok) {
    return { ok: true, data: res.data.households };
  }
  return res;
}

export async function createCaretaker(caretaker: Partial<Caretaker>): Promise<ApiResult<Caretaker>> {
  return request<Caretaker>('/api/households', {
    method: 'POST',
    body: JSON.stringify(caretaker),
  });
}

export async function updateCaretaker(caretaker: Partial<Caretaker> & { id: string }): Promise<ApiResult<Caretaker>> {
  return request<Caretaker>('/api/households', {
    method: 'PUT',
    body: JSON.stringify(caretaker),
  });
}

export async function deleteCaretaker(id: string): Promise<ApiResult<{ success: boolean }>> {
  return request<{ success: boolean }>(`/api/households?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── Users API ──

export async function fetchUsers(): Promise<ApiResult<RegisteredUserItem[]>> {
  return request<RegisteredUserItem[]>('/api/users');
}

export async function createUser(user: Partial<RegisteredUserItem>): Promise<ApiResult<RegisteredUserItem>> {
  return request<RegisteredUserItem>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export async function updateUser(user: Partial<RegisteredUserItem>): Promise<ApiResult<RegisteredUserItem>> {
  return request<RegisteredUserItem>('/api/users', {
    method: 'PUT',
    body: JSON.stringify(user),
  });
}

export async function deleteUser(email: string): Promise<ApiResult<{ success: boolean; email: string }>> {
  return request<{ success: boolean; email: string }>(`/api/users?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
}

export async function exchangeSessionToken(rawToken?: string): Promise<ApiResult<{ sessionToken: string; user: RegisteredUserItem }>> {
  const token = rawToken || getAuthToken();
  if (!token) return { ok: false, error: 'No auth token available', status: 401 };

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
      if (data?.sessionToken) {
        setAuthToken(data.sessionToken);
      }
      return { ok: true, data };
    }
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error || 'Failed to exchange session token', status: res.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.error('Failed to exchange session token', message);
    return { ok: false, error: message, status: 0 };
  }
}

