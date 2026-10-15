import type { Activity, ActivityType, PottyLocation, StoolConsistency } from '../types';
import { gramsToCups } from './predictions';
import { formatLocalDate, getLocalHour } from './date';

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
  // The dog's: 0 (no gram goal) lets a meal be saved with the grams box empty
  dailyFoodGramGoal?: number;
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

/** A weight that can be saved: 0.3 to 100 kg (the server's rule). */
export function isValidWeightKg(kg: number): boolean {
  return kg >= 0.3 && kg <= 100;
}

/** The first field that blocks the save, or null when the form can be saved. `now`: when Save is pressed. */
export function validateQuickLogForm(form: QuickLogForm, now: Date = new Date()): QuickLogFormError | null {
  const isGramsBoxEmptyAllowed = form.dailyFoodGramGoal === 0 && !form.quantityGrams.trim();
  if (form.type === 'food' && !isGramsBoxEmptyAllowed) {
    const grams = parseDecimalInput(form.quantityGrams);
    if (!Number.isFinite(grams) || grams <= 0) return { field: 'quantityGrams', messageKey: 'gramsRequired' };
  }
  if (form.type === 'weight') {
    const kg = parseDecimalInput(form.weightKg);
    if (!isValidWeightKg(kg)) return { field: 'weightKg', messageKey: 'weightInvalid' };
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
    // An empty box (no gram goal) sends no grams: the server stores null
    const grams = parseDecimalInput(form.quantityGrams);
    if (Number.isFinite(grams)) {
      activity.quantityGrams = grams;
      activity.quantityCups = gramsToCups(grams);
    }
  } else if (form.type === 'weight') {
    activity.weightKg = parseDecimalInput(form.weightKg);
  } else if (form.type === 'medication') {
    activity.medicationName = form.medicationName.trim();
  }

  return activity;
}

/** 12:00 in Paris on a YYYY-MM-DD date, as an ISO string. */
export function parisNoonISO(date: string): string {
  const noonUtc = new Date(`${date}T12:00:00.000Z`);
  // 13 in winter, 14 in summer: the clock change happens at night, never near noon
  const parisHourAtNoonUtc = getLocalHour(noonUtc, 'Europe/Paris');
  return new Date(noonUtc.getTime() - (parisHourAtNoonUtc - 12) * 60 * 60 * 1000).toISOString();
}

/**
 * The optional weigh-in of a vaccine or deworming form: none when the box is empty, else a weight event at 12:00 Paris
 * on the record date (now, on that day before noon: a weigh-in is never in the future), its note the product name.
 * `error` blocks the save: the server refuses a weigh-in dated after today. `now`: when Save is pressed.
 */
export function buildVetWeighIn(options: {
  puppyId: string;
  date: string;
  weightText: string;
  productName: string;
  loggedBy: string;
}, now: Date = new Date()): { activity?: Omit<Activity, 'id'>; error?: 'weightInvalid' | 'dateTimeInFuture' } {
  if (!options.weightText.trim()) return {};
  const weightKg = parseDecimalInput(options.weightText);
  if (!isValidWeightKg(weightKg)) return { error: 'weightInvalid' };
  if (options.date > formatLocalDate(now)) return { error: 'dateTimeInFuture' };
  const noon = parisNoonISO(options.date);
  return {
    activity: {
      puppyId: options.puppyId,
      type: 'weight',
      timestamp: Date.parse(noon) > now.getTime() ? now.toISOString() : noon,
      weightKg,
      notes: options.productName,
      loggedBy: options.loggedBy,
    },
  };
}
