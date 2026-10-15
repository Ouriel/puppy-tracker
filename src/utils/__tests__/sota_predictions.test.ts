import { describe, it, expect } from 'vitest';
import {
  calculatePredictions,
  calculateLearnedIntervalMinutes,
  detectSleepSchedule,
} from '../predictions';
import { mergeOlderActivities } from '../../hooks/useActivities';
import type { Activity, PuppyProfile } from '../../types';

describe('SOTA Prediction Engine & Age-Decay Test Suite', () => {
  const youngProfile: PuppyProfile = {
    id: 'pup-young',
    name: 'Milo',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-06-08', // ~2.5 months old
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 200,
  };

  const midProfile: PuppyProfile = {
    id: 'pup-mid',
    name: 'Pistache',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-04-03', // ~4.5 months old
    weightKg: 8.2,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  it('1. Age-Scaled Post-Meal Delays: Young puppy (<3m) vs Mid puppy (4.5m)', () => {
    const mealTime = new Date('2026-08-17T12:00:00Z');
    const pastPee = new Date('2026-08-17T11:00:00Z');
    const refTime = new Date('2026-08-17T12:05:00Z');

    const activities: Activity[] = [
      { id: '1', puppyId: 'pup-young', type: 'pee', timestamp: pastPee.toISOString(), loggedBy: 'Sam' },
      { id: '2', puppyId: 'pup-young', type: 'food', timestamp: mealTime.toISOString(), quantityGrams: 80, loggedBy: 'Sam' },
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

  it('2. Exponential Time Decay: A recent minority of longer bladder intervals outweighs older majority days as puppy grows', () => {
    const now = new Date('2026-08-17T12:00:00Z');
    const activities: Activity[] = [];

    // Days 30 to 14 ago: Puppy was younger, pee interval = 120m (2 hours): 08:00, 10:00, 12:00, 14:00, 16:00
    for (let day = 30; day >= 14; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const firstPee = Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 8, 0);
      for (let index = 0; index < 5; index++) {
        const timestamp = new Date(firstPee + index * 120 * 60000).toISOString();
        activities.push({ id: `p${index + 1}-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp, loggedBy: 'Sam' });
      }
    }

    // Days 3 to 0 ago: Puppy grew older, pee interval = 210m (3.5 hours)
    for (let day = 3; day >= 0; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const d1 = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 8, 0));
      const d2 = new Date(d1.getTime() + 210 * 60000); // 11:30 AM
      const d3 = new Date(d2.getTime() + 210 * 60000); // 15:00 PM

      activities.push({ id: `r1-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `r2-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d2.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `r3-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d3.toISOString(), loggedBy: 'Sam' });
    }

    const result = calculateLearnedIntervalMinutes(activities, 'pee', 180, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // Only 8 of the 72 in-window gaps are recent 210m gaps (64 older 120m gaps), so an unweighted 70th percentile
    // would be 120m. The 10-day half-life e^(-t/10) gives the recent days nearly half the weight, which lifts it to 210m;
    // a 20-day half-life would leave the older gaps above 70% of the weight and the result at 120m.
    expect(result).toMatchObject({ intervalMins: 210, sampleCount: 72, isLearned: true });
  });

  it('2b. Exponential Time Decay (poop): 4 recent 300m gaps outweigh 20 older 600m gaps in the median', () => {
    const lastPoop = Date.parse('2026-09-06T20:00:00Z');
    const poopAt = (time: number): Activity => ({ id: `po-${time}`, puppyId: 'pup-mid', type: 'poop', timestamp: new Date(time).toISOString(), loggedBy: 'Sam' });
    // Last day: a poop every 300m, ending 2026-09-06 20:00
    const recent = [0, 1, 2, 3, 4].map((index) => poopAt(lastPoop - index * 300 * 60000));
    // From 26 days earlier: a poop every 600m for ~8 days, ending 2026-08-20 04:00
    const olderStart = lastPoop - 26 * 86400000;
    const older = Array.from({ length: 21 }, (_unused, index) => poopAt(olderStart + index * 600 * 60000));

    const result = calculateLearnedIntervalMinutes([...recent, ...older], 'poop', 360, { bedtimeHour: 22, wakeupHour: 7 }, 'UTC');

    // With e^(-t/10) the 4 recent gaps carry more than half of the weight; with a 20-day half-life the median would be 600m.
    expect(result).toMatchObject({ intervalMins: 300, sampleCount: 24, isLearned: true });
  });

  it('3. Sparse Single-Event Days: Single log days do NOT corrupt learned bladder retention', () => {
    const now = new Date('2026-08-17T12:00:00Z');
    const activities: Activity[] = [];

    // 10 days of normal logging (every 180 mins)
    for (let day = 15; day >= 5; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const d1 = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 8, 0));
      const d2 = new Date(d1.getTime() + 180 * 60000);

      activities.push({ id: `n1-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `n2-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d2.toISOString(), loggedBy: 'Sam' });
    }

    // Days 4 to 0: Single event per day (logged at 09:00 AM)
    for (let day = 4; day >= 0; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const d1 = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 9, 0));
      activities.push({ id: `s-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Sam' });
    }

    const result = calculateLearnedIntervalMinutes(activities, 'pee', 240, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // The single event days don't produce valid daytime gaps: only the 11 normal days count, so the interval is the
    // learned 180m (not the 240m fallback) and is NOT distorted
    expect(result).toMatchObject({ intervalMins: 180, sampleCount: 11, isLearned: true });
  });

  it('4. Sleep Schedule Bedtime Drift: Time-decay weighted median picks the recent later bedtime even when it is the minority', () => {
    const now = new Date('2026-08-17T12:00:00Z');
    const activities: Activity[] = [];

    // Days 13 to 5 ago (9 days): Early bedtime at 22:00 PM UTC
    for (let day = 13; day >= 5; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const y = baseDate.getUTCFullYear();
      const m = baseDate.getUTCMonth();
      const d = baseDate.getUTCDate();

      const wake = new Date(Date.UTC(y, m, d, 7, 0));
      const bed = new Date(Date.UTC(y, m, d, 22, 0));
      activities.push({ id: `w-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: wake.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `b-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: bed.toISOString(), loggedBy: 'Sam' });
    }

    // Days 4 to 0 ago (5 days): Later bedtime at 23:30 PM UTC (puppy staying up later)
    for (let day = 4; day >= 0; day--) {
      const baseDate = new Date(now.getTime() - day * 86400000);
      const y = baseDate.getUTCFullYear();
      const m = baseDate.getUTCMonth();
      const d = baseDate.getUTCDate();

      const wake = new Date(Date.UTC(y, m, d, 7, 30));
      const bed = new Date(Date.UTC(y, m, d, 23, 30));
      activities.push({ id: `rw-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: wake.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `rb-${day}`, puppyId: 'pup-mid', type: 'pee', timestamp: bed.toISOString(), loggedBy: 'Sam' });
    }

    const schedule = detectSleepSchedule(activities, 'UTC');

    // 5 of 14 days: an unweighted median would be 22:00; the 7-day half-life weighting picks 23:30 (and 07:30 wakeup)
    expect(schedule).toEqual({ bedtimeHour: 23.5, wakeupHour: 7.5, bedtimeStr: '23:30', wakeupStr: '07:30' });
  });

  it('5. Activity Feed Pagination: Merging older activity logs deduplicates and preserves order', () => {
    const initialBatch: Activity[] = [
      { id: 'act-10', puppyId: 'pup-mid', type: 'pee', timestamp: '2026-08-17T10:00:00Z', loggedBy: 'Sam' },
      { id: 'act-9', puppyId: 'pup-mid', type: 'poop', timestamp: '2026-08-16T10:00:00Z', loggedBy: 'Sam' },
    ];
    const olderBatch: Activity[] = [
      { id: 'act-9', puppyId: 'pup-mid', type: 'poop', timestamp: '2026-08-16T10:00:00Z', loggedBy: 'Sam' }, // duplicate
      { id: 'act-6', puppyId: 'pup-mid', type: 'food', timestamp: '2026-08-13T10:00:00Z', loggedBy: 'Sam' }, // older (Aug 13)
      { id: 'act-5', puppyId: 'pup-mid', type: 'pee', timestamp: '2026-08-12T10:00:00Z', loggedBy: 'Sam' }, // older (Aug 12)
    ];

    const merged = mergeOlderActivities(initialBatch, olderBatch);

    expect(merged.length).toBe(4);
    expect(merged.map((a) => a.id)).toEqual(['act-10', 'act-9', 'act-6', 'act-5']);
  });
});
