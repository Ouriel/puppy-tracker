/**
 * Seeded invariant check of `calculatePredictions` (fuzz review, 2026-10-16): 200 random but plausible histories,
 * fixed seeds, so a failure always reproduces. Each case checks what must hold whatever the history:
 * no exception, valid dates, never calm or amber with a past time, never red with a future time,
 * night mode only in the learned night hours, never due before the last log of its type, same output on every run.
 */
import { describe, it, expect } from 'vitest';
import { calculatePredictions } from '../predictions';
import { getLocalDecimalHour } from '../date';
import type { Activity, ActivityType, PredictionResult, PuppyProfile, StoolConsistency } from '../../types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Small seeded PRNG (mulberry32): no dependency, same sequence on every run. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const TIME_ZONES = ['Europe/Paris', 'Europe/Paris', 'Europe/Paris', 'America/New_York', 'Australia/Sydney', 'Asia/Tokyo', 'UTC'];
const STOOLS: (StoolConsistency | undefined)[] = [undefined, undefined, 'normal', 'normal', 'hard', 'diarrhea', 'runny', 'soft'];
const POOP_NOTES = [undefined, undefined, undefined, 'liquide', 'pas de diarrhée'];

/** UTC offset of `timeZone` at `instant`, in minutes. */
function offsetMinutes(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return Math.round((asUtc - Math.floor(instant / MINUTE) * MINUTE) / MINUTE);
}

/** Wall-clock `hour` (may exceed 24) of the local calendar day starting at `dayStart` (UTC midnight of that date). */
function localInstant(dayStart: number, hour: number, timeZone: string): number {
  const naive = dayStart + hour * HOUR;
  const firstGuess = naive - offsetMinutes(naive, timeZone) * MINUTE;
  return naive - offsetMinutes(firstGuess, timeZone) * MINUTE;
}

interface Case { timeZone: string; now: Date; profile: PuppyProfile; activities: Activity[] }

function generateCase(seed: number): Case {
  const random = seededRandom(seed);
  const between = (low: number, high: number) => low + random() * (high - low);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const timeZone = pick(TIME_ZONES);
  const nowDay = Date.UTC(2026, 0, 1) + Math.floor(between(0, 700)) * DAY;
  const nowHour = random() < 0.5 ? between(0, 24) : pick([between(21, 24), between(0, 4.5), between(4, 9)]);
  const now = Math.floor(localInstant(nowDay, nowHour, timeZone) / 1000) * 1000;
  const ageMonths = between(1.5, 24);
  const targetMeals = pick([1, 2, 3, 3, 4, 5]);
  const goal = random() < 0.2 ? 0 : Math.round(between(10, 600));
  const profile: PuppyProfile = {
    id: 'pup-1', name: 'Fake', breed: 'Mixed', targetMealsPerDay: targetMeals, dailyFoodGramGoal: goal,
    birthDate: new Date(now - ageMonths * 30.4375 * DAY).toISOString().slice(0, 10),
  };

  const activities: Activity[] = [];
  const add = (type: ActivityType, instant: number, extra: Partial<Activity> = {}) => {
    activities.push({ id: `a${activities.length}`, puppyId: 'pup-1', type, timestamp: new Date(instant).toISOString(), loggedBy: 'Fake', ...extra });
  };
  const poopExtra = (): Partial<Activity> => ({ stoolConsistency: pick(STOOLS), notes: pick(POOP_NOTES) });
  const foodExtra = (): Partial<Activity> => (random() < 0.1 ? {} : { quantityGrams: Math.round((goal || 180) / targetMeals * between(0.5, 1.2) * 10) / 10 });
  const dayCount = Math.floor(between(0, 25));

  if (random() < 0.12) {
    // Chaos: logs at random times
    for (let index = Math.floor(between(0, 150)); index > 0; index--) {
      const type = pick(['pee', 'pee', 'poop', 'food', 'weight'] as ActivityType[]);
      add(type, between(now - dayCount * DAY, now), type === 'poop' ? poopExtra() : type === 'food' ? foodExtra() : {});
    }
  } else {
    // Routine: pees, poops and meals between a jittered wake-up and bedtime, some logs skipped
    const wake = between(5.5, 10);
    const bed = between(20.5, 25.5);
    const peeEvery = Math.min(Math.max(1, ageMonths), 7) * between(0.6, 1.3);
    const poopsPerDay = Math.max(1, Math.round(between(1, ageMonths < 4 ? 5 : 3)));
    const dropChance = between(0, 0.4);
    const today = nowDay;
    for (let daysAgo = dayCount + 1; daysAgo >= 0; daysAgo--) {
      const day = today - daysAgo * DAY;
      const dayWake = wake + between(-0.6, 0.6);
      const dayBed = bed + between(-0.7, 0.7);
      const log = (type: ActivityType, hour: number, extra: Partial<Activity> = {}) => {
        if (random() >= dropChance) add(type, localInstant(day, hour, timeZone), extra);
      };
      for (let hour = dayWake; hour < dayBed; hour += peeEvery * between(0.5, 1.2)) log('pee', hour);
      log('pee', dayBed - between(0, 0.3));
      if (ageMonths < 4 && random() < 0.6) log('pee', 24 + between(1, 4.8)); // night potty
      for (let index = 0; index < poopsPerDay; index++) log('poop', dayWake + (dayBed - dayWake) * (index + between(0, 0.9)) / poopsPerDay, poopExtra());
      for (let index = 0; index < targetMeals; index++) log('food', dayWake + 0.3 + (dayBed - dayWake - 2) * index / targetMeals, foodExtra());
    }
  }
  if (random() < 0.08) add(pick(['pee', 'poop', 'food'] as ActivityType[]), now + between(2, 600) * MINUTE); // typo in the future
  const visible = activities.filter((activity) => Date.parse(activity.timestamp) <= now + 600 * MINUTE);
  visible.sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
  return { timeZone, now: new Date(now), profile, activities: visible };
}

function isNightHour(hour: number, wakeupHour: number, bedtimeHour: number): boolean {
  const isDay = bedtimeHour > wakeupHour ? hour >= wakeupHour && hour < bedtimeHour : hour >= wakeupHour || hour < bedtimeHour;
  return !isDay;
}

function serialize(result: PredictionResult): string {
  return JSON.stringify(result, (_key, value) => (value instanceof Date ? value.toISOString() : value));
}

/** Broken invariants of one case, as 'card: invariant' strings. */
function brokenInvariants({ timeZone, now, profile, activities }: Case): string[] {
  let result: PredictionResult;
  try {
    result = calculatePredictions(activities, profile, now, timeZone);
  } catch (error) {
    return [`exception: ${String(error)}`];
  }
  const broken: string[] = [];
  if (serialize(calculatePredictions(activities, profile, now, timeZone)) !== serialize(result)) broken.push('not deterministic');
  const schedule = result.sleepSchedule!;
  const isNightNow = isNightHour(getLocalDecimalHour(now, timeZone), schedule.wakeupHour, schedule.bedtimeHour);
  const lastLogOf = (type: ActivityType) => Math.max(
    -Infinity,
    ...activities.filter((activity) => activity.type === type && Date.parse(activity.timestamp) <= now.getTime() + MINUTE).map((activity) => Date.parse(activity.timestamp))
  );
  const cards = [
    { card: 'pee' as const, next: result.nextPeeExpectedAt, urgency: result.peeUrgency, mode: result.peeMode as string },
    { card: 'poop' as const, next: result.nextPoopExpectedAt, urgency: result.poopUrgency, mode: result.poopMode as string },
    { card: 'food' as const, next: result.nextFoodExpectedAt, urgency: result.foodUrgency, mode: result.foodMode as string },
  ];
  for (const { card, next, urgency, mode } of cards) {
    if (next === null) {
      if (card === 'food' || lastLogOf(card) > -Infinity) broken.push(`${card}: no time despite logs`);
      continue;
    }
    if (!(next instanceof Date) || Number.isNaN(next.getTime())) {
      broken.push(`${card}: invalid date`);
      continue;
    }
    const minutesAhead = (next.getTime() - now.getTime()) / MINUTE;
    if (urgency !== 'overdue' && minutesAhead < -1) broken.push(`${card}: ${urgency} with a past time`);
    if (urgency === 'overdue' && minutesAhead > 1) broken.push(`${card}: overdue with a future time`);
    if (mode === 'night_sleep' && !isNightNow) broken.push(`${card}: night mode outside the night hours`);
    if (card !== 'food' && next.getTime() < lastLogOf(card) - MINUTE) broken.push(`${card}: due before its last log`);
  }
  return broken;
}

describe('calculatePredictions invariants on 200 seeded random histories', () => {
  it('hold for every case', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const testCase = generateCase(seed);
      for (const invariant of brokenInvariants(testCase)) failures.push(`seed ${seed} (${testCase.timeZone} ${testCase.now.toISOString()}): ${invariant}`);
    }
    expect(failures).toEqual([]);
  }, 30_000); // about 2 s alone, slower when the whole suite runs in parallel
});
