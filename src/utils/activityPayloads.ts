import type { Activity, ActivityType, PottyLocation, StoolConsistency } from '../types';
import { gramsToCups } from './predictions';

/** Activity built by the dashboard one-tap buttons (App handleQuickAction). */
export function buildQuickActionActivity(options: {
  puppyId: string;
  type: ActivityType;
  pottyLocation?: PottyLocation;
  loggedBy: string;
  actionTime: Date;
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
  }

  return activity;
}

/** The QuickLogModal form; the grams and weight boxes hold the raw text typed ('10,4'). */
export interface QuickLogForm {
  puppyId: string;
  type: ActivityType;
  localTimestamp: string;
  loggedBy: string;
  notes: string;
  pottyLocation: PottyLocation;
  stoolConsistency: StoolConsistency;
  quantityGrams: string;
  weightKg: string;
  medicationName: string;
}

export interface QuickLogFormError {
  field: 'quantityGrams' | 'weightKg' | 'medicationName' | 'timestamp';
  messageKey: 'gramsRequired' | 'weightInvalid' | 'medicationRequired' | 'dateTimeRequired' | 'dateTimeInFuture';
}

// A log may be dated up to 5 minutes after Save, by the phone's clock
const MAX_FUTURE_LOG_MS = 5 * 60 * 1000;

/** Reads a typed decimal, with a comma or a dot ('10,4' -> 10.4); NaN for anything else ('', 'abc', '1e3', '-5'). */
export function parseDecimalInput(text: string): number {
  const trimmed = text.trim();
  return /^(\d+([.,]\d*)?|[.,]\d+)$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : NaN;
}

/** The first field that blocks the save, or null when the form can be saved. `now`: when Save is pressed. */
export function validateQuickLogForm(form: QuickLogForm, now: Date = new Date()): QuickLogFormError | null {
  if (form.type === 'food') {
    const grams = parseDecimalInput(form.quantityGrams);
    if (!Number.isFinite(grams) || grams <= 0) return { field: 'quantityGrams', messageKey: 'gramsRequired' };
  }
  if (form.type === 'weight') {
    const kg = parseDecimalInput(form.weightKg);
    if (!(kg >= 0.3 && kg <= 100)) return { field: 'weightKg', messageKey: 'weightInvalid' };
  }
  if (form.type === 'medication' && !form.medicationName.trim()) {
    return { field: 'medicationName', messageKey: 'medicationRequired' };
  }
  const time = new Date(form.localTimestamp).getTime();
  if (!form.localTimestamp || Number.isNaN(time)) {
    return { field: 'timestamp', messageKey: 'dateTimeRequired' };
  }
  if (time > now.getTime() + MAX_FUTURE_LOG_MS) {
    return { field: 'timestamp', messageKey: 'dateTimeInFuture' };
  }
  return null;
}

/** Activity built by the QuickLogModal form, for a new log and for an edit. */
export function buildQuickLogActivity(form: QuickLogForm): Omit<Activity, 'id'> {
  const activity: Omit<Activity, 'id'> = {
    puppyId: form.puppyId,
    type: form.type,
    timestamp: new Date(form.localTimestamp).toISOString(),
    loggedBy: form.loggedBy,
    // null, not undefined: an edit that empties the note must send it, so the server deletes it
    notes: form.notes.trim() || null,
  };

  if (form.type === 'pee' || form.type === 'poop') {
    activity.pottyLocation = form.pottyLocation;
    if (form.type === 'poop') {
      activity.stoolConsistency = form.stoolConsistency;
    }
  } else if (form.type === 'food') {
    const grams = parseDecimalInput(form.quantityGrams);
    activity.quantityGrams = grams;
    activity.quantityCups = gramsToCups(grams);
  } else if (form.type === 'weight') {
    activity.weightKg = parseDecimalInput(form.weightKg);
  } else if (form.type === 'medication') {
    activity.medicationName = form.medicationName.trim();
  }

  return activity;
}
