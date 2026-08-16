import type { Activity, Caretaker, PuppyProfile, UserAccount } from '../types';
import { SUPER_ADMIN_EMAIL } from '../constants/auth';

const STORAGE_KEY_ACTIVE_PUPPY = 'puppace_active_puppy';
const STORAGE_KEY_OFFLINE_QUEUE = 'puppace_offline_queue';

export const DEFAULT_PUPPIES: PuppyProfile[] = [];

export const DEFAULT_USER: UserAccount = {
  id: 'usr-default',
  name: 'Matthieu',
  email: SUPER_ADMIN_EMAIL,
  role: 'Member',
  avatarColor: '#6366F1',
  familyPackId: 'FAMILY-COCKER-2026',
};

export const DEFAULT_CARETAKERS: Caretaker[] = [
  { id: '1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
];

export function getStoredUser(): UserAccount {
  return DEFAULT_USER;
}

export function getStoredCaretakers(): Caretaker[] {
  return DEFAULT_CARETAKERS;
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

export function getOfflineQueue(): Activity[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToOfflineQueue(activity: Activity): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = getOfflineQueue();
    const exists = current.some((item) => item.id === activity.id);
    if (!exists) {
      localStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify([...current, activity]));
    }
  } catch (err) {
    console.error('Failed to save activity to offline queue', err);
  }
}

export function removeFromOfflineQueue(id: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = getOfflineQueue();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to remove activity from offline queue', err);
  }
}

export function clearOfflineQueue(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_OFFLINE_QUEUE);
  }
}

export function clearAllData(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PUPPY);
    localStorage.removeItem(STORAGE_KEY_OFFLINE_QUEUE);
  }
}
