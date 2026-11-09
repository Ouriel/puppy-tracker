import { describe, it, expect } from 'vitest';
import { calculatePredictions, detectMealSchedule } from '../predictions';
import type { Activity, SleepSchedule } from '../../types';
import { PISTACHE, act, at, newestFirst } from './fixtures';

const TIME_ZONE = 'Europe/Paris';
const NIGHT_22_TO_07: SleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };

const clocks = (schedule: number[]) =>
  schedule.map((mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);

/** One meal at each Paris clock time, on each day from 1 Sept 2026 for `days` days. */
function mealDays(clockTimes: string[], days: number): Activity[] {
  return Array.from({ length: days }, (_unused, dayIndex) => `2026-09-${String(dayIndex + 1).padStart(2, '0')}`).flatMap(
    (date) => clockTimes.map((clockTime) => act('food', `${date}T${clockTime}:00+02:00`, { quantityGrams: 50 }))
  );
}

describe('meal times learned by rank, for any number of meals a day', () => {
  it('2 meals a day (real logs, 4 to 9 Nov 2026): meal 2 at the usual dinner, not halfway to bedtime (15:49)', () => {
    const logs = newestFirst([
      act('food', '2026-11-04T08:18:00Z'), act('food', '2026-11-04T20:23:00Z'),
      act('food', '2026-11-05T15:00:00Z'),
      act('food', '2026-11-06T08:20:00Z'), act('food', '2026-11-06T18:45:00Z'),
      act('food', '2026-11-07T08:47:00Z'), act('food', '2026-11-07T19:16:00Z'),
      act('food', '2026-11-08T09:38:00Z'), act('food', '2026-11-08T17:01:00Z'),
      act('food', '2026-11-09T08:45:00Z', { quantityGrams: 110 }),
    ]);
    const balma = { ...PISTACHE, birthDate: '2026-03-27', targetMealsPerDay: 2, dailyFoodGramGoal: 200 };
    const sleep: SleepSchedule = { bedtimeHour: 21.9, wakeupHour: 9, bedtimeStr: '21:54', wakeupStr: '09:00' };

    const predictions = calculatePredictions(logs, balma, new Date('2026-11-09T12:00:00+01:00'), TIME_ZONE, sleep);

    expect(clocks(predictions.mealSchedule!)).toEqual(['09:47', '19:45']); // finished days only
    expect(predictions.foodReason).toBe('Meal 2 of 2 (~19:45)');
    expect(at(predictions.nextFoodExpectedAt!)).toBe('2026-11-09 19:45');
    expect(predictions.foodUrgency).toBe('safe');
  });

  it('4 meals a day: each meal by its rank in the day, wherever it falls on the clock', () => {
    const history = mealDays(['06:30', '10:30', '14:30', '18:30'], 7);

    expect(clocks(detectMealSchedule(history, 4, NIGHT_22_TO_07, TIME_ZONE, new Date('2026-09-08T05:00:00+02:00'))))
      .toEqual(['06:30', '10:30', '14:30', '18:30']);

    const afterBreakfast = calculatePredictions(
      newestFirst([...history, act('food', '2026-09-08T06:30:00+02:00', { quantityGrams: 50 })]),
      { ...PISTACHE, targetMealsPerDay: 4, dailyFoodGramGoal: 200 },
      new Date('2026-09-08T07:00:00+02:00'),
      TIME_ZONE,
      NIGHT_22_TO_07
    );
    expect(afterBreakfast.foodReason).toBe('Meal 2 of 4 (~10:30)');
  });

  it('a late breakfast shortens the usual gaps as much as the time left until bedtime', () => {
    const history = mealDays(['06:30', '10:30', '14:30', '18:30'], 7);
    const profile = { ...PISTACHE, targetMealsPerDay: 4, dailyFoodGramGoal: 200 };
    const lateBreakfast = act('food', '2026-09-08T09:30:00+02:00', { quantityGrams: 50 });

    // 09:30 + 4 h x (22:00 - 09:30) / (22:00 - 06:30) = 12:43, not 10:30 an hour after breakfast
    const meal2 = calculatePredictions(newestFirst([...history, lateBreakfast]), profile, new Date('2026-09-08T10:00:00+02:00'), TIME_ZONE, NIGHT_22_TO_07);
    expect(meal2.foodReason).toBe('Meal 2 of 4 (~12:43)');

    // 15:30 + 4 h x (22:00 - 15:30) / (22:00 - 14:30) = 18:58, still 3 h before bedtime
    const meal4 = calculatePredictions(
      newestFirst([...history, lateBreakfast, act('food', '2026-09-08T12:30:00+02:00'), act('food', '2026-09-08T15:30:00+02:00')]),
      profile,
      new Date('2026-09-08T16:00:00+02:00'),
      TIME_ZONE,
      NIGHT_22_TO_07
    );
    expect(meal4.foodReason).toBe('Meal 4 of 4 (~18:58)');
  });

  it('a very late meal keeps the next one before bedtime, never right after it or the next morning', () => {
    const history = mealDays(['08:00', '18:00'], 7);
    const profile = { ...PISTACHE, targetMealsPerDay: 2, dailyFoodGramGoal: 200 };
    const predictAfter = (clockTime: string) => calculatePredictions(
      newestFirst([...history, act('food', `2026-09-08T${clockTime}:00+02:00`, { quantityGrams: 100 })]),
      profile,
      new Date(`2026-09-08T${clockTime}:00+02:00`),
      TIME_ZONE,
      NIGHT_22_TO_07
    );

    // Breakfast at 17:50: 10 h x (22:00 - 17:50) / (22:00 - 08:00), not 18:00 ten minutes later
    expect(predictAfter('17:50').foodReason).toBe('Meal 2 of 2 (~20:48)');
    // Breakfast at 19:00, after the usual dinner: 21:08, not 05:00 the next morning
    expect(predictAfter('19:00').foodReason).toBe('Meal 2 of 2 (~21:08)');
  });

  it('days with a meal not logged give each meal to the nearest usual time: dinner never moves to lunch', () => {
    const complete = mealDays(['07:30', '12:30', '18:30'], 3);
    const dinnerNotLogged = ['04', '05', '06', '07'].flatMap((day) =>
      ['07:30', '12:00'].map((clockTime) => act('food', `2026-09-${day}T${clockTime}:00+02:00`))
    );

    expect(clocks(detectMealSchedule([...complete, ...dinnerNotLogged], 3, NIGHT_22_TO_07, TIME_ZONE, new Date('2026-09-08T05:00:00+02:00'))))
      .toEqual(['07:30', '12:00', '18:30']);
  });

  it('one meal a day: an evening chew logged as food does not move the meal to the evening', () => {
    const mealAndChew = mealDays(['08:00', '20:00'], 7);

    expect(clocks(detectMealSchedule(mealAndChew, 1, NIGHT_22_TO_07, TIME_ZONE, new Date('2026-09-08T05:00:00+02:00')))).toEqual(['08:00']);
  });

  it("today's meals are learned only once the day is complete: a late breakfast is not learned as dinner", () => {
    const yesterday = mealDays(['08:00', '18:00'], 1);
    const lateBreakfast = act('food', '2026-09-02T15:00:00+02:00');

    expect(clocks(detectMealSchedule([...yesterday, lateBreakfast], 2, NIGHT_22_TO_07, TIME_ZONE, new Date('2026-09-02T15:30:00+02:00'))))
      .toEqual(['08:00', '18:00']);
  });

  it('going from 3 meals to 2 keeps the usual breakfast and dinner', () => {
    const threeMealDays = mealDays(['08:00', '13:00', '19:00'], 7);

    expect(clocks(detectMealSchedule(threeMealDays, 2, NIGHT_22_TO_07, TIME_ZONE, new Date('2026-09-08T05:00:00+02:00'))))
      .toEqual(['08:00', '19:00']);
  });

  it('a day with one meal logged gives it to the nearest usual time', () => {
    const now = new Date('2026-09-08T05:00:00+02:00');

    // Usual times without complete days: 07:00 (wake-up) and 19:30 (bedtime - 2.5 h)
    expect(clocks(detectMealSchedule(mealDays(['18:30'], 5), 2, NIGHT_22_TO_07, TIME_ZONE, now))).toEqual(['07:00', '18:30']);
    expect(clocks(detectMealSchedule(mealDays(['08:15'], 5), 2, NIGHT_22_TO_07, TIME_ZONE, now))).toEqual(['08:15', '19:30']);
  });

  it('without meal logs: from wake-up to 2.5 h before bedtime, evenly', () => {
    expect(clocks(detectMealSchedule([], 4, NIGHT_22_TO_07, TIME_ZONE))).toEqual(['07:00', '11:10', '15:20', '19:30']);
    expect(clocks(detectMealSchedule([], 2, NIGHT_22_TO_07, TIME_ZONE))).toEqual(['07:00', '19:30']);
  });
});
