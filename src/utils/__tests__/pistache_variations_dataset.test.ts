import { describe, it, expect } from 'vitest';
import {
  calculatePredictions,
  calculateLearnedIntervalMinutes,
  detectSleepSchedule,
  detectMealSchedule,
} from '../predictions';
import type { Activity, PuppyProfile } from '../../types';
import { at, newestFirst } from './fixtures';

describe('Pistache Derived Variations Test Suite (5 Multi-Scenario Datasets)', () => {
  const pistacheBaseProfile: PuppyProfile = {
    id: 'pup-pistache-001',
    name: 'Pistache',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-04-03',
    weightKg: 8.4,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  /**
   * Helper: Generate base timestamps for N days ending at reference date
   */
  function createDayTimestamps(daysCount: number, refDate: Date): Date[] {
    const dates: Date[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(refDate.getTime() - i * 86400000);
      dates.push(d);
    }
    return dates;
  }

  it('Scenario 2: Pistache Shifted Night Schedule Dataset (Late Night Routine 00:30 -> 08:30)', () => {
    const refDate = new Date('2026-08-17T12:00:00Z');
    const days = createDayTimestamps(20, refDate);
    const activities: Activity[] = [];

    days.forEach((dayDate, dayIdx) => {
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      // Morning wakeup potty: 08:30 AM UTC
      const wake = new Date(Date.UTC(y, m, d, 8, 30));
      // Daytime potty: 14:00 PM UTC
      const dayPotty = new Date(Date.UTC(y, m, d, 14, 0));
      // Late night bedtime potty after midnight: 00:30 AM UTC the next calendar day (same logical day)
      const bed = new Date(Date.UTC(y, m, d + 1, 0, 30));

      activities.push({ id: `sw-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'pee', timestamp: wake.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `sd-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'pee', timestamp: dayPotty.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `sb-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'pee', timestamp: bed.toISOString(), loggedBy: 'Sam' });
    });

    const schedule = detectSleepSchedule(activities, 'UTC');

    expect(schedule).toEqual({ wakeupHour: 8.5, bedtimeHour: 0.5, wakeupStr: '08:30', bedtimeStr: '00:30' });
  });

  it('Scenario 3: Pistache Rainy Day Dataset (Wider Variability & Expanded Semi-IQR Delta)', () => {
    const refDate = new Date('2026-08-17T12:00:00Z');
    const days = createDayTimestamps(15, refDate);
    const activities: Activity[] = [];

    // Rainy days have variable gaps (ranging between 150m and 210m depending on indoor naps)
    days.forEach((dayDate, dayIdx) => {
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      const gap1 = 150 + (dayIdx % 3) * 30; // 150m, 180m, 210m
      const t1 = new Date(Date.UTC(y, m, d, 8, 0));
      const t2 = new Date(t1.getTime() + gap1 * 60000);

      activities.push({ id: `r1-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'pee', timestamp: t1.toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `r2-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'pee', timestamp: t2.toISOString(), loggedBy: 'Sam' });
    });

    const learned = calculateLearnedIntervalMinutes(activities, 'pee', 180, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // Semi-IQR delta (p75 210 - p25 150) / 2 = ±30m expands past the ±15m pee minimum without hitting the ±45m cap
    expect(learned.deltaMins).toBe(30);
    // 70th percentile of the 150/180/210 gaps
    expect(learned.intervalMins).toBe(210);
  });

  it('Scenario 5: Pistache Meal Frequency Transition Dataset (4 Meals/day -> 3 Meals/day)', () => {
    const refDate = new Date('2026-08-17T12:00:00Z');
    const days = createDayTimestamps(20, refDate);
    const activities: Activity[] = [];

    // Older days (0-10): 4 meals (08:00, 12:00, 16:00, 20:00)
    // Recent days (11-19): 3 meals (08:30, 13:30, 19:30)
    days.forEach((dayDate, dayIdx) => {
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      if (dayIdx < 10) {
        [8, 12, 16, 20].forEach((h, mIdx) => {
          activities.push({
            id: `m4-${dayIdx}-${mIdx}`,
            puppyId: pistacheBaseProfile.id,
            type: 'food',
            timestamp: new Date(Date.UTC(y, m, d, h, 0)).toISOString(),
            quantityGrams: 60,
            loggedBy: 'Sam',
          });
        });
      } else {
        [8.5, 13.5, 19.5].forEach((h, mIdx) => {
          const hours = Math.floor(h);
          const mins = (h - hours) * 60;
          activities.push({
            id: `m3-${dayIdx}-${mIdx}`,
            puppyId: pistacheBaseProfile.id,
            type: 'food',
            timestamp: new Date(Date.UTC(y, m, d, hours, mins)).toISOString(),
            quantityGrams: 80,
            loggedBy: 'Sam',
          });
        });
      }
    });

    const mealSchedule = detectMealSchedule(activities, 'UTC');

    // Weighted median across transition: recent 3-meal days (08:30 AM = 510m) dominate over older 4-meal days (08:00 AM = 480m)
    expect(mealSchedule).toEqual({ breakfastMins: 510, lunchMins: 810, dinnerMins: 1170 });
  });

  it('Scenario 6: Pistache Morning Awakening After Overnight Sleep Dataset (Screenshot 07:34 AM Reproduction)', () => {
    const refDate = new Date('2026-08-28T07:34:00Z');
    const yesterdayDate = new Date('2026-08-27T12:00:00Z');
    const days = createDayTimestamps(14, yesterdayDate);
    const activities: Activity[] = [];

    days.forEach((dayDate, dayIdx) => {
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      // Morning wake pee 07:15, poop 07:30, breakfast 08:15
      activities.push({ id: `p-wake-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'pee', timestamp: new Date(Date.UTC(y, m, d, 7, 15)).toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `po-wake-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'poop', timestamp: new Date(Date.UTC(y, m, d, 7, 30)).toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `f-bfast-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'food', timestamp: new Date(Date.UTC(y, m, d, 8, 15)).toISOString(), quantityGrams: 80, loggedBy: 'Sam' });

      // Evening poop 17:38, dinner 19:30, bedtime pee 22:30
      activities.push({ id: `po-eve-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'poop', timestamp: new Date(Date.UTC(y, m, d, 17, 38)).toISOString(), loggedBy: 'Sam' });
      activities.push({ id: `f-din-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'food', timestamp: new Date(Date.UTC(y, m, d, 19, 30)).toISOString(), quantityGrams: 80, loggedBy: 'Sam' });
      activities.push({ id: `p-bed-${dayIdx}`, puppyId: pistacheBaseProfile.id, type: 'pee', timestamp: new Date(Date.UTC(y, m, d, 22, 30)).toISOString(), loggedBy: 'Sam' });
    });

    // On test morning Aug 28, pee logged at 07:34 AM
    activities.push({
      id: 'p-today-0734',
      puppyId: pistacheBaseProfile.id,
      type: 'pee',
      timestamp: '2026-08-28T07:34:00Z',
      loggedBy: 'Sam',
    });

    const pred = calculatePredictions(newestFirst(activities), pistacheBaseProfile, refDate, 'UTC');

    // Next pee 4h later at 11:34 (no learned daytime interval, so the 4h age fallback applies; Safe Zone)
    expect(at(pred.nextPeeExpectedAt!, 'UTC')).toBe('2026-08-28 11:34');
    expect(pred.peeUrgency).toBe('safe');
    expect(pred.peeMode).toBe('daytime_baseline');

    // Next poop expected for morning outing (~07:49 AM), NOT middle of the night (standard transit lands at 03:46 AM)
    expect(at(pred.nextPoopExpectedAt!, 'UTC')).toBe('2026-08-28 07:49');
    expect(pred.poopUrgency).toBe('soon');
    expect(pred.poopReason).toBe('Morning outing (~07:49)');
  });
});
