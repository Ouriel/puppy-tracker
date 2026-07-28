import type { Activity, PuppyProfile } from '../types';
import { getAuthToken, clearAuthToken } from '../utils/auth';
import { showToast } from '../utils/toast';

export interface RegisteredUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL';
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
  const headers = { ...getHeaders(), ...(options.headers || {}) };
  try {
    const res = await fetch(url, { ...options, headers });

    if (res.ok) {
      // 204 No Content
      if (res.status === 204) return {} as T;
      return await res.json();
    }

    if (res.status === 401) {
      clearAuthToken();
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
  return request<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(activity),
  });
}

export async function deleteActivity(id: string): Promise<boolean> {
  const res = await request<{ success: boolean }>(`/api/activities?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return !!res?.success;
}

// ── Health Records API ──

export async function fetchHealthRecords(puppyId: string, type?: string): Promise<any[] | null> {
  const url = type
    ? `/api/health-records?puppyId=${encodeURIComponent(puppyId)}&type=${encodeURIComponent(type)}`
    : `/api/health-records?puppyId=${encodeURIComponent(puppyId)}`;
  return request<any[]>(url);
}

export async function createHealthRecord(record: any): Promise<any | null> {
  return request<any>('/api/health-records', {
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
