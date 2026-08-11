import { describe, it, expect } from 'vitest';
import {
  calculatePredictions,
  calculateLearnedIntervalMinutes,
  detectSleepSchedule,
  detectMealSchedule,
} from '../predictions';
import type { Activity, PuppyProfile } from '../../types';

describe('Balma Derived Variations Test Suite (5 Multi-Scenario Datasets)', () => {
  const balmaBaseProfile: PuppyProfile = {
    id: 'pup-balma-001',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27',
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

  it('Scenario 1: Balma Growth Surge Dataset (10w -> 18w Bladder Capacity Expansion)', () => {
    const refDate = new Date('2026-08-10T12:00:00Z');
    const days = createDayTimestamps(30, refDate);
    const activities: Activity[] = [];

    days.forEach((dayDate, dayIdx) => {
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      // Older days (0-15): 2-hour interval (young puppy)
      // Recent days (16-29): 3.5-hour interval (growing puppy)
      const gapMins = dayIdx < 15 ? 120 : 210;

      const t1 = new Date(Date.UTC(y, m, d, 8, 0));
      const t2 = new Date(t1.getTime() + gapMins * 60000);
      const t3 = new Date(t2.getTime() + gapMins * 60000);

      activities.push({ id: `g1-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: t1.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `g2-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: t2.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `g3-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: t3.toISOString(), loggedBy: 'Matthieu' });
    });

    const learned = calculateLearnedIntervalMinutes(activities, 'pee', 180, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // Exponential decay prioritizes the recent 14 days (210m gap) over older 120m gaps
    expect(learned.intervalMins).toBeGreaterThanOrEqual(195);
    expect(learned.intervalMins).toBeLessThanOrEqual(215);
    expect(learned.isLearned).toBe(true);
  });

  it('Scenario 2: Balma Shifted Night Schedule Dataset (Late Night Routine 00:30 -> 08:30)', () => {
    const refDate = new Date('2026-08-10T12:00:00Z');
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
      // Late night bedtime potty: 23:45 PM UTC
      const bed = new Date(Date.UTC(y, m, d, 23, 45));

      activities.push({ id: `sw-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: wake.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `sd-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: dayPotty.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `sb-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: bed.toISOString(), loggedBy: 'Matthieu' });
    });

    const schedule = detectSleepSchedule(activities, 'UTC');

    expect(schedule.wakeupStr).toBe('08:30');
    expect(schedule.bedtimeStr).toBe('23:45');
  });

  it('Scenario 3: Balma Rainy Day Dataset (Wider Variability & Expanded Semi-IQR Delta)', () => {
    const refDate = new Date('2026-08-10T12:00:00Z');
    const days = createDayTimestamps(15, refDate);
    const activities: Activity[] = [];

    // Rainy days have variable gaps (ranging between 150m and 270m depending on indoor naps)
    days.forEach((dayDate, dayIdx) => {
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      const gap1 = 150 + (dayIdx % 3) * 60; // 150m, 210m, 270m
      const t1 = new Date(Date.UTC(y, m, d, 8, 0));
      const t2 = new Date(t1.getTime() + gap1 * 60000);

      activities.push({ id: `r1-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: t1.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `r2-${dayIdx}`, puppyId: balmaBaseProfile.id, type: 'pee', timestamp: t2.toISOString(), loggedBy: 'Matthieu' });
    });

    const learned = calculateLearnedIntervalMinutes(activities, 'pee', 180, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // Semi-IQR delta should expand to capture the wider rainy day variability (e.g. ±30m to ±45m)
    expect(learned.deltaMins).toBeGreaterThanOrEqual(25);
    expect(learned.deltaMins).toBeLessThanOrEqual(45);
  });

  it('Scenario 4: Balma Gastrointestinal Upset Recovery Dataset (Hard Stool Refractory Window)', () => {
    const refDate = new Date('2026-08-10T14:00:00Z');
    const lastPoopTime = new Date('2026-08-10T10:00:00Z');

    const activities: Activity[] = [
      {
        id: 'poop-constipated',
        puppyId: balmaBaseProfile.id,
        type: 'poop',
        timestamp: lastPoopTime.toISOString(),
        stoolConsistency: 'hard',
        notes: 'hard stool constipated episode',
        loggedBy: 'Matthieu',
      },
    ];

    const pred = calculatePredictions(activities, balmaBaseProfile, refDate, 'UTC');

    // Stool recovery refractory window ensures urgency stays 'safe' while colon refilling
    expect(pred.poopUrgency).toBe('safe');
    expect(pred.poopReason).toContain('hard stool');
  });

  it('Scenario 5: Balma Meal Frequency Transition Dataset (4 Meals/day -> 3 Meals/day)', () => {
    const refDate = new Date('2026-08-10T12:00:00Z');
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
            puppyId: balmaBaseProfile.id,
            type: 'food',
            timestamp: new Date(Date.UTC(y, m, d, h, 0)).toISOString(),
            quantityGrams: 60,
            loggedBy: 'Matthieu',
          });
        });
      } else {
        [8.5, 13.5, 19.5].forEach((h, mIdx) => {
          const hours = Math.floor(h);
          const mins = (h - hours) * 60;
          activities.push({
            id: `m3-${dayIdx}-${mIdx}`,
            puppyId: balmaBaseProfile.id,
            type: 'food',
            timestamp: new Date(Date.UTC(y, m, d, hours, mins)).toISOString(),
            quantityGrams: 80,
            loggedBy: 'Matthieu',
          });
        });
      }
    });

    const mealSchedule = detectMealSchedule(activities, 'UTC');

    // Breakfast time across transition calculates 495 mins (08:15 AM)
    expect(mealSchedule.breakfastMins).toBe(495);
  });
});
