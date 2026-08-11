import { describe, it, expect } from 'vitest';
import {
  calculatePredictions,
  calculateLearnedIntervalMinutes,
  detectSleepSchedule,
} from '../predictions';
import type { Activity, PuppyProfile } from '../../types';

describe('SOTA Prediction Engine & Age-Decay Test Suite', () => {
  const youngProfile: PuppyProfile = {
    id: 'pup-young',
    name: 'Milo',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-06-01', // ~2.5 months old
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 200,
  };

  const midProfile: PuppyProfile = {
    id: 'pup-mid',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27', // ~4.5 months old
    weightKg: 8.2,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  it('1. Age-Scaled Post-Meal Delays: Young puppy (<3m) vs Mid puppy (4.5m)', () => {
    const mealTime = new Date('2026-08-10T12:00:00Z');
    const pastPee = new Date('2026-08-10T11:00:00Z');
    const refTime = new Date('2026-08-10T12:05:00Z');

    const activities: Activity[] = [
      { id: '1', puppyId: 'pup-young', type: 'pee', timestamp: pastPee.toISOString(), loggedBy: 'Matthieu' },
      { id: '2', puppyId: 'pup-young', type: 'food', timestamp: mealTime.toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' },
    ];

    const youngPred = calculatePredictions(activities, youngProfile, refTime, 'UTC');
    const midPred = calculatePredictions(activities, midProfile, refTime, 'UTC');

    expect(youngPred.peeMode).toBe('post_meal_override');
    expect(midPred.peeMode).toBe('post_meal_override');

    // Young (<3m) expects post-meal pee at +15m; Mid (4.5m) expects at +20m
    const youngMins = (youngPred.nextPeeExpectedAt!.getTime() - mealTime.getTime()) / 60000;
    const midMins = (midPred.nextPeeExpectedAt!.getTime() - mealTime.getTime()) / 60000;

    expect(youngMins).toBe(15);
    expect(midMins).toBe(20);

    // Delta tolerances are age-scaled (young: ±8m, mid: ±10m)
    expect(youngPred.peeDeltaMins).toBe(8);
    expect(midPred.peeDeltaMins).toBe(10);
  });

  it('2. Exponential Time Decay: Recent days override older bladder intervals as puppy grows', () => {
    const now = new Date('2026-08-10T12:00:00Z');
    const activities: Activity[] = [];

    // Days 30 to 14 ago: Puppy was younger, pee interval = 120m (2 hours)
    for (let day = 30; day >= 14; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const d1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 8, 0);
      const d2 = new Date(d1.getTime() + 120 * 60000); // 10:00 AM
      const d3 = new Date(d2.getTime() + 120 * 60000); // 12:00 PM

      activities.push({ id: `p1-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `p2-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d2.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `p3-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d3.toISOString(), loggedBy: 'Matthieu' });
    }

    // Days 7 to 0 ago: Puppy grew older, pee interval = 210m (3.5 hours)
    for (let day = 7; day >= 0; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const d1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 8, 0);
      const d2 = new Date(d1.getTime() + 210 * 60000); // 11:30 AM
      const d3 = new Date(d2.getTime() + 210 * 60000); // 15:00 PM

      activities.push({ id: `r1-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `r2-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d2.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `r3-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d3.toISOString(), loggedBy: 'Matthieu' });
    }

    const result = calculateLearnedIntervalMinutes(activities, 'pee', 180, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // Because recent 7 days have exponential weight e^(-t/7), learned interval will be close to 210m (not the simple average of 165m)
    expect(result.intervalMins).toBeGreaterThanOrEqual(195);
    expect(result.intervalMins).toBeLessThanOrEqual(215);
    expect(result.isLearned).toBe(true);
  });

  it('3. Sparse Single-Event Days: Single log days do NOT corrupt learned bladder retention', () => {
    const now = new Date('2026-08-10T12:00:00Z');
    const activities: Activity[] = [];

    // 10 days of normal logging (every 180 mins)
    for (let day = 15; day >= 5; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const d1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 8, 0);
      const d2 = new Date(d1.getTime() + 180 * 60000);

      activities.push({ id: `n1-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `n2-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d2.toISOString(), loggedBy: 'Matthieu' });
    }

    // Days 4 to 0: Single event per day (logged at 09:00 AM)
    for (let day = 4; day >= 0; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const d1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 9, 0);
      activities.push({ id: `s-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Matthieu' });
    }

    const result = calculateLearnedIntervalMinutes(activities, 'pee', 180, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // The single event days don't produce valid daytime gaps, so the interval remains ~180m and is NOT distorted
    expect(result.intervalMins).toBe(180);
  });

  it('4. Sleep Schedule Bedtime Drift: Recent bedtime shifts are accurately detected via EMA', () => {
    const now = new Date('2026-08-10T12:00:00Z');
    const activities: Activity[] = [];

    // Days 30 to 10 ago: Early bedtime at 22:00 PM UTC
    for (let day = 30; day >= 10; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const y = baseDate.getUTCFullYear();
      const m = baseDate.getUTCMonth();
      const d = baseDate.getUTCDate();

      const wake = new Date(Date.UTC(y, m, d, 7, 0));
      const bed = new Date(Date.UTC(y, m, d, 22, 0));
      activities.push({ id: `w-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: wake.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `b-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: bed.toISOString(), loggedBy: 'Matthieu' });
    }

    // Days 7 to 0 ago: Later bedtime at 23:30 PM UTC (puppy staying up later)
    for (let day = 7; day >= 0; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const y = baseDate.getUTCFullYear();
      const m = baseDate.getUTCMonth();
      const d = baseDate.getUTCDate();

      const wake = new Date(Date.UTC(y, m, d, 7, 30));
      const bed = new Date(Date.UTC(y, m, d, 23, 30));
      activities.push({ id: `rw-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: wake.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `rb-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: bed.toISOString(), loggedBy: 'Matthieu' });
    }

    const schedule = detectSleepSchedule(activities, 'UTC');

    // Bedtime should be close to 23:30 (e.g., bedtimeHour ~ 23.5), NOT 22:00
    expect(schedule.bedtimeHour).toBeGreaterThanOrEqual(23.0);
    expect(schedule.bedtimeStr).toMatch(/^23:/);
  });

  it('5. Activity Feed Pagination: Merging older activity logs deduplicates and preserves order', () => {
    const initialBatch: Activity[] = [
      { id: 'act-10', puppyId: 'pup-mid', type: 'pee', timestamp: '2026-08-10T10:00:00Z', loggedBy: 'Matthieu' },
      { id: 'act-9', puppyId: 'pup-mid', type: 'poop', timestamp: '2026-08-09T10:00:00Z', loggedBy: 'Matthieu' },
    ];
    const olderBatch: Activity[] = [
      { id: 'act-9', puppyId: 'pup-mid', type: 'poop', timestamp: '2026-08-09T10:00:00Z', loggedBy: 'Matthieu' }, // duplicate
      { id: 'act-6', puppyId: 'pup-mid', type: 'food', timestamp: '2026-08-06T10:00:00Z', loggedBy: 'Matthieu' }, // older (Aug 6)
      { id: 'act-5', puppyId: 'pup-mid', type: 'pee', timestamp: '2026-08-05T10:00:00Z', loggedBy: 'Matthieu' }, // older (Aug 5)
    ];

    const existingIds = new Set(initialBatch.map((a) => a.id));
    const newUnique = olderBatch.filter((a) => !existingIds.has(a.id));
    const merged = [...initialBatch, ...newUnique];

    expect(merged.length).toBe(4);
    expect(merged.map((a) => a.id)).toEqual(['act-10', 'act-9', 'act-6', 'act-5']);
  });
});
