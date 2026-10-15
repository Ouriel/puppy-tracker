import type { Activity, ActivityType, PuppyProfile } from '../../types';

/** Pistache as the API returns her (`birth_date` is a Postgres `date`, so a plain 'YYYY-MM-DD'). */
export const PISTACHE: PuppyProfile = {
  id: 'pup-pistache',
  householdId: 'hh-1',
  name: 'Pistache',
  breed: 'English Cocker Spaniel',
  birthDate: '2026-04-03',
  weightKg: 7.8,
  gender: 'female',
  targetMealsPerDay: 3,
  dailyFoodGramGoal: 240,
};

/** One activity log for Pistache; `extra` overrides any field (id, puppyId, quantityGrams, ...). */
export function act(type: ActivityType, iso: string, extra: Partial<Activity> = {}): Activity {
  return {
    id: `${type}-${iso}`,
    householdId: PISTACHE.householdId,
    puppyId: PISTACHE.id,
    type,
    timestamp: iso,
    loggedBy: 'Sam',
    ...extra,
  };
}

/** Production order: the API sorts by timestamp desc and new logs are prepended. */
export function newestFirst<T extends { timestamp: string }>(list: T[]): T[] {
  return [...list].sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
}

/** 'YYYY-MM-DD HH:mm' wall-clock time in `tz`, independent of the host timezone. */
export function at(date: Date, tz = 'Europe/Paris'): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
