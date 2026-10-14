import { describe, it, expect } from 'vitest';
import { calculatePredictions, detectSleepSchedule, detectMealSchedule } from '../predictions';
import type { Activity } from '../../types';
import { BALMA, act, newestFirst } from './fixtures';

const pad = (day: number) => String(day).padStart(2, '0');

describe('Dog Routine & Schedule Dataset Test Suite', () => {
  /**
   * Generates a 14-day realistic dataset (Aug 1 to Aug 14, UTC) with consistent bedtime (22:30),
   * morning wakeup (07:30), and 3 spaced meals (08:00, 13:00, 19:30).
   */
  function generateRoutineDataset(): Activity[] {
    const activities: Activity[] = [];

    for (let day = 1; day <= 14; day++) {
      const date = `2026-08-${pad(day)}`;
      activities.push(
        act('pee', `${date}T07:30:00.000Z`), // Morning Wakeup Pee (07:30)
        act('food', `${date}T08:00:00.000Z`, { quantityGrams: 80 }), // Breakfast (08:00, 80g)
        act('food', `${date}T13:00:00.000Z`, { quantityGrams: 80 }), // Lunch (13:00, 80g)
        act('food', `${date}T19:30:00.000Z`, { quantityGrams: 80 }), // Dinner (19:30, 80g)
        act('pee', `${date}T22:30:00.000Z`), // Pre-bedtime Outing (22:30)
      );
    }

    return newestFirst(activities);
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
    // Today's (Aug 14) breakfast was 100g instead of the usual 80g
    const todayBreakfastTimestamp = '2026-08-14T08:00:00.000Z';
    const datasetWithBigBreakfast = dataset.map((activity) =>
      activity.timestamp === todayBreakfastTimestamp ? { ...activity, quantityGrams: 100 } : activity
    );
    const refTime = new Date('2026-08-14T10:00:00Z');
    const predictions = calculatePredictions(datasetWithBigBreakfast, BALMA, refTime, 'UTC');

    expect(predictions.sleepSchedule).toBeDefined();
    expect(predictions.sleepSchedule?.bedtimeStr).toBe('22:30');
    expect(predictions.sleepSchedule?.wakeupStr).toBe('07:30');

    expect(predictions.mealSchedule).toBeDefined();
    expect(predictions.mealSchedule?.breakfastMins).toBe(480);
    expect(predictions.mealSchedule?.lunchMins).toBe(780);
    expect(predictions.mealSchedule?.dinnerMins).toBe(1170);

    // (240g goal - 100g eaten today) / 2 remaining meals = 70g
    expect(predictions.portionGrams).toBe(70);
  });

  it('handles post-midnight bedtime wraps cleanly (e.g. bedtime at 00:30 AM)', () => {
    const lateBedActivities: Activity[] = [];

    for (let day = 1; day <= 10; day++) {
      lateBedActivities.push(
        act('pee', `2026-08-${pad(day)}T08:30:00.000Z`), // Morning Wakeup (08:30)
        // Late night outing at 00:30 (next calendar day technically, but logically current night)
        act('pee', `2026-08-${pad(day + 1)}T00:30:00.000Z`),
      );
    }

    const sleep = detectSleepSchedule(newestFirst(lateBedActivities), 'UTC');
    expect(sleep.wakeupStr).toBe('08:30');
    expect(sleep.bedtimeStr).toBe('00:30');
  });

  it('falls back safely to default schedules when dataset has 0 activities', () => {
    const emptyActivities: Activity[] = [];
    const predictions = calculatePredictions(emptyActivities, BALMA, new Date('2026-08-14T10:00:00Z'), 'UTC');

    expect(predictions.sleepSchedule).toBeDefined();
    expect(predictions.sleepSchedule?.bedtimeStr).toBe('22:00');
    expect(predictions.sleepSchedule?.wakeupStr).toBe('07:00');
    expect(predictions.portionGrams).toBe(80);
  });
});
