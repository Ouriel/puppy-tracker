import type { Activity, ActivityType, PottyLocation, StoolConsistency } from '../types';
import { gramsToCups } from './predictions';

/** Activity built by the dashboard one-tap buttons (App handleQuickAction). */
export function buildQuickActionActivity(options: {
  puppyId: string;
  type: ActivityType;
  pottyLocation?: PottyLocation;
  loggedBy: string;
  actionTime: Date;
  mealPortionGrams: number;
}): Omit<Activity, 'id'> {
  const activity: Omit<Activity, 'id'> = {
    puppyId: options.puppyId,
    type: options.type,
    timestamp: options.actionTime.toISOString(),
    loggedBy: options.loggedBy,
  };

  if (options.pottyLocation) {
    activity.pottyLocation = options.pottyLocation;
  }

  if (options.type === 'poop') {
    activity.stoolConsistency = 'normal';
  } else if (options.type === 'food') {
    activity.foodType = 'kibble';
    // 0 g once today's goal is met: log the meal without grams (the server stores null).
    if (options.mealPortionGrams > 0) {
      activity.quantityGrams = options.mealPortionGrams;
      activity.quantityCups = gramsToCups(options.mealPortionGrams);
    }
  }

  return activity;
}

/** Activity built by the QuickLogModal form, for a new log and for an edit. */
export function buildQuickLogActivity(form: {
  puppyId: string;
  type: ActivityType;
  localTimestamp: string;
  loggedBy: string;
  notes: string;
  pottyLocation: PottyLocation;
  stoolConsistency: StoolConsistency;
  quantityGrams: number;
  quantityCups: number;
  weightKg: number;
  medicationName: string;
}): Omit<Activity, 'id'> {
  const activity: Omit<Activity, 'id'> = {
    puppyId: form.puppyId,
    type: form.type,
    timestamp: new Date(form.localTimestamp).toISOString(),
    loggedBy: form.loggedBy,
    notes: form.notes.trim() || undefined,
  };

  if (form.type === 'pee' || form.type === 'poop') {
    activity.pottyLocation = form.pottyLocation;
    if (form.type === 'poop') {
      activity.stoolConsistency = form.stoolConsistency;
    }
  } else if (form.type === 'food' && form.quantityGrams > 0) {
    // 0 g (cleared field, or pre-filled once today's goal is met): log the meal without grams.
    activity.quantityGrams = form.quantityGrams;
    activity.quantityCups = form.quantityCups;
  } else if (form.type === 'weight') {
    activity.weightKg = form.weightKg;
  } else if (form.type === 'medication') {
    activity.medicationName = form.medicationName;
  }

  return activity;
}
