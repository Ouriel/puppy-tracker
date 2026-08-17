import { describe, it, expect } from 'vitest';
import { calculatePredictions, detectSleepSchedule, detectMealSchedule } from '../predictions';
import type { Activity, PuppyProfile } from '../../types';

describe('Dog Routine & Schedule Dataset Test Suite', () => {
  const balmaProfile: PuppyProfile = {
    id: 'pup-balma-001',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27',
    weightKg: 8.5,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  /**
   * Generates a 14-day realistic dataset with consistent bedtime (22:30),
   * morning wakeup (07:30), and 3 spaced meals (08:00, 13:00, 19:30).
   */
  function generateRoutineDataset(): Activity[] {
    const activities: Activity[] = [];
    const base = new Date('2026-08-01T00:00:00Z');

    for (let day = 0; day < 14; day++) {
      const dayDate = new Date(base.getTime() + day * 86400000);
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      // Morning Wakeup Pee (07:30)
      activities.push({
        id: `wake-${day}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: new Date(Date.UTC(y, m, d, 7, 30)).toISOString(),
        loggedBy: 'Matthieu',
      });

      // Breakfast (08:00, 80g)
      activities.push({
        id: `bfast-${day}`,
        puppyId: balmaProfile.id,
        type: 'food',
        timestamp: new Date(Date.UTC(y, m, d, 8, 0)).toISOString(),
        quantityGrams: 80,
        loggedBy: 'Matthieu',
      });

      // Lunch (13:00, 80g)
      activities.push({
        id: `lunch-${day}`,
        puppyId: balmaProfile.id,
        type: 'food',
        timestamp: new Date(Date.UTC(y, m, d, 13, 0)).toISOString(),
        quantityGrams: 80,
        loggedBy: 'Matthieu',
      });

      // Dinner (19:30, 80g)
      activities.push({
        id: `dinner-${day}`,
        puppyId: balmaProfile.id,
        type: 'food',
        timestamp: new Date(Date.UTC(y, m, d, 19, 30)).toISOString(),
        quantityGrams: 80,
        loggedBy: 'Matthieu',
      });

      // Pre-bedtime Outing (22:30)
      activities.push({
        id: `bed-${day}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: new Date(Date.UTC(y, m, d, 22, 30)).toISOString(),
        loggedBy: 'Matthieu',
      });
    }

    return activities;
  }

  const dataset = generateRoutineDataset();

  it('learns exact bedtime and wakeup times from the 14-day routine dataset', () => {
    const sleep = detectSleepSchedule(dataset, 'UTC');
    expect(sleep.wakeupStr).toBe('07:30');
    expect(sleep.bedtimeStr).toBe('22:30');
    expect(sleep.wakeupHour).toBeCloseTo(7.5, 1);
    expect(sleep.bedtimeHour).toBeCloseTo(22.5, 1);
  });

  it('learns breakfast, lunch, and dinner times accurately', () => {
    const meals = detectMealSchedule(dataset, 'UTC');
    expect(meals.breakfastMins).toBe(8 * 60);       // 08:00 UTC = 480 mins
    expect(meals.lunchMins).toBe(13 * 60);         // 13:00 UTC = 780 mins
    expect(meals.dinnerMins).toBe(19 * 60 + 30);    // 19:30 UTC = 1170 mins
  });

  it('passes single-source-of-truth metadata through calculatePredictions', () => {
    const refTime = new Date('2026-08-14T10:00:00Z');
    const predictions = calculatePredictions(dataset, balmaProfile, refTime, 'UTC');

    expect(predictions.sleepSchedule).toBeDefined();
    expect(predictions.sleepSchedule?.bedtimeStr).toBe('22:30');
    expect(predictions.sleepSchedule?.wakeupStr).toBe('07:30');

    expect(predictions.mealSchedule).toBeDefined();
    expect(predictions.mealSchedule?.breakfastMins).toBe(480);
    expect(predictions.mealSchedule?.lunchMins).toBe(780);
    expect(predictions.mealSchedule?.dinnerMins).toBe(1170);

    // 240g / 3 meals = 80g
    expect(predictions.portionGrams).toBe(80);
  });

  it('handles post-midnight bedtime wraps cleanly (e.g. bedtime at 00:30 AM)', () => {
    const lateBedActivities: Activity[] = [];
    const base = new Date('2026-08-01T00:00:00Z');

    for (let day = 0; day < 10; day++) {
      const dayDate = new Date(base.getTime() + day * 86400000);
      const y = dayDate.getUTCFullYear();
      const m = dayDate.getUTCMonth();
      const d = dayDate.getUTCDate();

      // Morning Wakeup (08:30)
      lateBedActivities.push({
        id: `late-w-${day}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: new Date(Date.UTC(y, m, d, 8, 30)).toISOString(),
        loggedBy: 'Matthieu',
      });

      // Late night outing at 00:30 (next calendar day technically, but logically current night)
      const nextDay = new Date(dayDate.getTime() + 86400000);
      lateBedActivities.push({
        id: `late-b-${day}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: new Date(Date.UTC(nextDay.getUTCFullYear(), nextDay.getUTCMonth(), nextDay.getUTCDate(), 0, 30)).toISOString(),
        loggedBy: 'Matthieu',
      });
    }

    const sleep = detectSleepSchedule(lateBedActivities, 'UTC');
    expect(sleep.wakeupHour).toBeGreaterThanOrEqual(8);
    expect(sleep.bedtimeStr).toBe('00:30');
  });

  it('falls back safely to default schedules when dataset has 0 activities', () => {
    const emptyActivities: Activity[] = [];
    const predictions = calculatePredictions(emptyActivities, balmaProfile, new Date(), 'UTC');

    expect(predictions.sleepSchedule).toBeDefined();
    expect(predictions.sleepSchedule?.bedtimeStr).toBe('22:00');
    expect(predictions.sleepSchedule?.wakeupStr).toBe('07:00');
    expect(predictions.portionGrams).toBe(80);
  });
});
