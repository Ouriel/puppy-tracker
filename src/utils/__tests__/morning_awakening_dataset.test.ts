import { describe, it, expect } from 'vitest';
import { calculatePredictions, detectSleepSchedule, calculateLearnedIntervalMinutes } from '../predictions';
import { translatePredictionReason } from '../predictionsTranslation';
import { formatLocalTime, getLocalHour, getLocalDecimalHour } from '../date';
import type { Activity, PuppyProfile } from '../../types';

describe('Balma Morning Awakening & Overnight Transition Dataset Test Suite', () => {
  const balmaProfile: PuppyProfile = {
    id: 'pup-balma-001',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27', // ~4.8 months old on Aug 21, 2026
    weightKg: 8.5,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  /**
   * Helper: Generate a realistic 14-day history for Balma leading up to August 20, 2026
   */
  function generateBalma14DayHistory(): Activity[] {
    const activities: Activity[] = [];

    for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
      const dayNum = 21 - dayOffset;
      const dStr = String(dayNum).padStart(2, '0');

      // Morning wakeup pee 07:15 AM
      activities.push({
        id: `pee-wake-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: `2026-08-${dStr}T07:15:00+02:00`,
        loggedBy: 'Matthieu',
      });

      // Morning post-wakeup poop 07:30 AM
      activities.push({
        id: `poop-morning-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'poop',
        timestamp: `2026-08-${dStr}T07:30:00+02:00`,
        loggedBy: 'Matthieu',
      });

      // Breakfast 08:15 AM
      activities.push({
        id: `food-bfast-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'food',
        timestamp: `2026-08-${dStr}T08:15:00+02:00`,
        quantityGrams: 80,
        loggedBy: 'Matthieu',
      });

      // Midday pee 12:30 PM
      activities.push({
        id: `pee-noon-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: `2026-08-${dStr}T12:30:00+02:00`,
        loggedBy: 'Matthieu',
      });

      // Lunch 13:00 PM
      activities.push({
        id: `food-lunch-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'food',
        timestamp: `2026-08-${dStr}T13:00:00+02:00`,
        quantityGrams: 80,
        loggedBy: 'Matthieu',
      });

      // Afternoon pee 17:30 PM
      activities.push({
        id: `pee-eve-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: `2026-08-${dStr}T17:30:00+02:00`,
        loggedBy: 'Matthieu',
      });

      // Evening poop 17:38 PM (~10h gap after morning poop)
      activities.push({
        id: `poop-eve-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'poop',
        timestamp: `2026-08-${dStr}T17:38:00+02:00`,
        loggedBy: 'Matthieu',
      });

      // Dinner 19:30 PM
      activities.push({
        id: `food-din-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'food',
        timestamp: `2026-08-${dStr}T19:30:00+02:00`,
        quantityGrams: 80,
        loggedBy: 'Matthieu',
      });

      // Bedtime pee 22:30 PM
      activities.push({
        id: `pee-bed-${dayOffset}`,
        puppyId: balmaProfile.id,
        type: 'pee',
        timestamp: `2026-08-${dStr}T22:30:00+02:00`,
        loggedBy: 'Matthieu',
      });
    }

    return activities;
  }

  it('learns Balma sleep schedule (~22:30 bedtime to ~07:15 wakeup) and intervals (~5h pee, ~10h15 poop)', () => {
    const dataset = generateBalma14DayHistory();
    const sleepSchedule = detectSleepSchedule(dataset, 'Europe/Paris');

    expect(sleepSchedule.wakeupHour).toBeCloseTo(7.25, 0.5);
    expect(sleepSchedule.bedtimeHour).toBeCloseTo(22.5, 0.5);

    const learnedPee = calculateLearnedIntervalMinutes(dataset, 'pee', 240, sleepSchedule, 'Europe/Paris');
    const learnedPoop = calculateLearnedIntervalMinutes(dataset, 'poop', 360, sleepSchedule, 'Europe/Paris');

    expect(learnedPee.intervalMins).toBeGreaterThanOrEqual(270); // ~4.5h - 5.5h
    expect(learnedPoop.intervalMins).toBeGreaterThanOrEqual(550); // ~9.5h - 10.5h
  });

  it('reproduces Screenshot_20260821-073412 state: after morning pee click, next pee is ~12:34 PM and poop is morning outing (~07:xx AM)', () => {
    const dataset = generateBalma14DayHistory();

    // On August 21 morning at 07:34 AM, user clicks "Peed Outside"
    dataset.push({
      id: 'pee-aug21-morning',
      puppyId: balmaProfile.id,
      type: 'pee',
      timestamp: '2026-08-21T07:34:00+02:00',
      loggedBy: 'Matthieu',
    });

    const now = new Date('2026-08-21T07:34:00+02:00');
    const predictions = calculatePredictions(dataset, balmaProfile, now, 'Europe/Paris');

    // 1. Pee Prediction (just logged at 07:34 AM):
    // Next pee should be in ~5 hours around 12:34 PM (Safe Zone)
    expect(predictions.nextPeeExpectedAt).toBeDefined();
    const peeHour = getLocalDecimalHour(predictions.nextPeeExpectedAt!, 'Europe/Paris');
    expect(peeHour).toBeGreaterThanOrEqual(12.0);
    expect(peeHour).toBeLessThanOrEqual(13.5);
    expect(predictions.peeUrgency).toBe('safe');
    expect(predictions.peeMode).toBe('daytime_baseline');

    // 2. Poop Prediction (no poop yet today, last poop yesterday at 17:38 PM):
    // Next poop must be for morning outing today (~07:xx AM), NOT 03:52 AM in the middle of the night!
    expect(predictions.nextPoopExpectedAt).toBeDefined();
    const poopExpectedDate = predictions.nextPoopExpectedAt!;
    const poopHour = getLocalHour(poopExpectedDate, 'Europe/Paris');
    const poopTimeStr = formatLocalTime(poopExpectedDate, 'Europe/Paris');

    expect(poopHour).toBe(7); // Morning wake-up window (07:xx AM)
    expect(predictions.poopReason).toContain('Morning outing');
    expect(poopTimeStr).toMatch(/^07:\d{2}$/);

    // Ensure urgency is reasonable (due ~20-30 mins ago upon waking, NOT 3h42m overdue from 03:52 AM)
    const overdueMins = (now.getTime() - poopExpectedDate.getTime()) / 60000;
    expect(overdueMins).toBeLessThan(45); // Due around ~07:15-07:30 AM, ~4 to 24 mins overdue

    // 3. Next Meal Prediction (breakfast upcoming at ~08:15-08:45 AM):
    expect(predictions.nextFoodExpectedAt).toBeDefined();
    const foodHour = getLocalDecimalHour(predictions.nextFoodExpectedAt!, 'Europe/Paris');
    expect(foodHour).toBeGreaterThanOrEqual(8.0);
    expect(foodHour).toBeLessThanOrEqual(9.0);
    expect(predictions.foodUrgency).toBe('safe');

    // 4. French Translations match UI display
    const frPoopReason = translatePredictionReason(predictions.poopReason, 'fr');
    expect(frPoopReason).toContain('Sortie du matin');
  });

  it('handles early morning check at 06:45 AM (during sleep before wakeup): predicts upcoming 07:xx AM morning potty', () => {
    const dataset = generateBalma14DayHistory();
    const now = new Date('2026-08-21T06:45:00+02:00'); // 06:45 AM Paris (before ~07:15 wakeup)

    const predictions = calculatePredictions(dataset, balmaProfile, now, 'Europe/Paris');

    // Should predict upcoming morning wake-up in ~30 mins
    expect(predictions.nextPeeExpectedAt).toBeDefined();
    expect(predictions.nextPoopExpectedAt).toBeDefined();

    const peeHour = getLocalHour(predictions.nextPeeExpectedAt!, 'Europe/Paris');
    const poopHour = getLocalHour(predictions.nextPoopExpectedAt!, 'Europe/Paris');

    expect(peeHour).toBe(7);
    expect(poopHour).toBe(7);
    expect(predictions.peeUrgency).toBe('safe');
    expect(predictions.poopUrgency).toBe('safe');
  });

  it('handles wake-up at 07:15 AM before any potty logs: marks first morning pee as due now', () => {
    const dataset = generateBalma14DayHistory();
    const now = new Date('2026-08-21T07:15:00+02:00'); // 07:15 AM Paris (wake-up time)

    const predictions = calculatePredictions(dataset, balmaProfile, now, 'Europe/Paris');

    expect(predictions.nextPeeExpectedAt).toBeDefined();
    const peeHour = getLocalHour(predictions.nextPeeExpectedAt!, 'Europe/Paris');
    expect(peeHour).toBe(7);
    expect(predictions.peeReason).toContain('Morning outing');
  });
});
