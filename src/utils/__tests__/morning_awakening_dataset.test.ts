import { describe, it, expect } from 'vitest';
import { calculatePredictions, detectSleepSchedule, calculateLearnedIntervalMinutes } from '../predictions';
import { translatePredictionReason } from '../predictionsTranslation';
import { formatLocalDate } from '../date';
import type { Activity } from '../../types';
import { PISTACHE, act, at, newestFirst } from './fixtures';

describe('Pistache Morning Awakening & Overnight Transition Dataset Test Suite', () => {
  // PISTACHE is ~4.8 months old on Aug 28, 2026

  /**
   * Helper: Generate a realistic 14-day history for Pistache (Aug 14 to Aug 27, 2026)
   */
  function generatePistache14DayHistory(): Activity[] {
    const activities: Activity[] = [];

    for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
      const day = `2026-08-${String(28 - dayOffset).padStart(2, '0')}`;

      activities.push(
        act('pee', `${day}T07:15:00+02:00`), // Morning wakeup pee 07:15 AM
        act('poop', `${day}T07:30:00+02:00`), // Morning post-wakeup poop 07:30 AM
        act('food', `${day}T08:15:00+02:00`, { quantityGrams: 80 }), // Breakfast 08:15 AM
        act('pee', `${day}T12:30:00+02:00`), // Midday pee 12:30 PM
        act('food', `${day}T13:00:00+02:00`, { quantityGrams: 80 }), // Lunch 13:00 PM
        act('pee', `${day}T17:30:00+02:00`), // Afternoon pee 17:30 PM
        act('poop', `${day}T17:38:00+02:00`), // Evening poop 17:38 PM (~10h gap after morning poop)
        act('food', `${day}T19:30:00+02:00`, { quantityGrams: 80 }), // Dinner 19:30 PM
        act('pee', `${day}T22:30:00+02:00`), // Bedtime pee 22:30 PM
      );
    }

    return activities;
  }

  it('learns Pistache sleep schedule (22:30 bedtime to 07:15 wakeup) and intervals (5h15 pee, 10h08 poop)', () => {
    const dataset = newestFirst(generatePistache14DayHistory());
    const sleepSchedule = detectSleepSchedule(dataset, 'Europe/Paris');

    expect(sleepSchedule).toEqual({ bedtimeHour: 22.5, wakeupHour: 7.25, bedtimeStr: '22:30', wakeupStr: '07:15' });

    const learnedPee = calculateLearnedIntervalMinutes(dataset, 'pee', 240, sleepSchedule, 'Europe/Paris');
    const learnedPoop = calculateLearnedIntervalMinutes(dataset, 'poop', 360, sleepSchedule, 'Europe/Paris');

    expect(learnedPee.intervalMins).toBe(315); // 70th percentile of daytime gaps (07:15 -> 12:30)
    expect(learnedPoop.intervalMins).toBe(608); // Median 24/7 transit (07:30 -> 17:38)
  });

  it('reproduces the 07:34 screenshot: after morning pee click, next pee is 12:49 and poop is morning outing at 07:49', () => {
    // On August 28 morning at 07:34 AM, user clicks "Peed Outside"
    const dataset = newestFirst([...generatePistache14DayHistory(), act('pee', '2026-08-28T07:34:00+02:00')]);

    const now = new Date('2026-08-28T07:34:00+02:00');
    const predictions = calculatePredictions(dataset, PISTACHE, now, 'Europe/Paris');

    // 1. Pee Prediction (just logged at 07:34 AM): 07:34 + learned 5h15 (Safe Zone)
    expect(predictions.nextPeeExpectedAt).not.toBeNull();
    expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-28 12:49');
    expect(predictions.peeUrgency).toBe('safe');
    expect(predictions.peeMode).toBe('daytime_baseline');

    // 2. Poop Prediction (no poop yet today, last poop yesterday at 17:38 PM):
    // Next poop is this morning's outing (07:34 pee + 15m learned offset), NOT the 03:46 AM standard expectation
    expect(predictions.nextPoopExpectedAt).not.toBeNull();
    expect(at(predictions.nextPoopExpectedAt!)).toBe('2026-08-28 07:49');
    expect(predictions.poopReason).toContain('First poop of the day');
    expect(predictions.poopUrgency).toBe('soon');

    // 3. Next Meal Prediction: learned 08:15 breakfast
    expect(predictions.nextFoodExpectedAt).not.toBeNull();
    expect(at(predictions.nextFoodExpectedAt!)).toBe('2026-08-28 08:15');
    expect(predictions.foodUrgency).toBe('safe');

    // 4. French Translations match UI display
    const frPoopReason = translatePredictionReason(predictions.poopReason, 'fr');
    expect(frPoopReason).toContain('Premier caca du jour');
  });

  it('handles early morning check at 06:45 AM (during sleep before wakeup): predicts upcoming 07:xx AM morning potty', () => {
    const dataset = newestFirst(generatePistache14DayHistory());
    const now = new Date('2026-08-28T06:45:00+02:00'); // 06:45 AM Paris (before 07:15 wakeup)

    const predictions = calculatePredictions(dataset, PISTACHE, now, 'Europe/Paris');

    // Should predict upcoming morning wake-up in ~30 mins
    expect(predictions.nextPeeExpectedAt).not.toBeNull();
    expect(predictions.nextPoopExpectedAt).not.toBeNull();

    expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-28 07:15'); // Learned wakeup
    expect(at(predictions.nextPoopExpectedAt!)).toBe('2026-08-28 07:30'); // Wakeup + 15m learned offset
    expect(predictions.peeMode).toBe('night_sleep');
    expect(predictions.poopMode).toBe('night_sleep');
    expect(predictions.peeUrgency).toBe('safe');
    expect(predictions.poopUrgency).toBe('safe');
  });

  it('handles midnight pre-bed poop followed by waking up without morning poop: does not push prediction to next day (+21h)', () => {
    const dataset = [
      ...generatePistache14DayHistory(),
      // Late night poop at 00:12 AM on Aug 28 (calendar Aug 28, but logically Aug 27 bedtime)
      act('poop', '2026-08-28T00:12:00+02:00'),
      // Morning pee on Aug 28 at 07:52 AM (puppy woke up, peed, but did NOT poop)
      act('pee', '2026-08-28T07:52:00+02:00'),
    ];

    // 1. Check at 08:30 AM (after morning walk, before breakfast)
    const morningCheck = new Date('2026-08-28T08:30:00+02:00');
    const morningPred = calculatePredictions(newestFirst(dataset), PISTACHE, morningCheck, 'Europe/Paris');

    // Must target TODAY's morning outing (07:52 pee + 15m learned offset), NOT tomorrow Aug 29!
    expect(morningPred.nextPoopExpectedAt).not.toBeNull();
    expect(at(morningPred.nextPoopExpectedAt!)).toBe('2026-08-28 08:07');
    expect(morningPred.poopMode).toBe('daytime_baseline');
    expect(morningPred.poopUrgency).toBe('overdue');

    // 2. Add breakfast at 09:30 AM
    dataset.push(act('food', '2026-08-28T09:30:00+02:00', { quantityGrams: 80 }));

    // 3. Check at 10:15 AM (after breakfast): when post-meal override does not apply,
    // morning poop remains overdue based on morning wakeup — never pushes +9h into evening!
    // R4 (post-meal override) was dropped in Phase 3a, so both modes stay accepted here.
    const postBfastCheck = new Date('2026-08-28T10:15:00+02:00');
    const postBfastPred = calculatePredictions(newestFirst(dataset), PISTACHE, postBfastCheck, 'Europe/Paris');

    expect(postBfastPred.nextPoopExpectedAt).toBeDefined();
    expect(formatLocalDate(postBfastPred.nextPoopExpectedAt!, 'Europe/Paris')).toBe('2026-08-28');
    // If post-meal override is inactive or elapsed, the unpooped morning stool is overdue, not pushed ~9h into evening
    if (postBfastPred.poopMode === 'daytime_baseline') {
      expect(postBfastPred.poopUrgency).toBe('overdue');
      const diffHours = (postBfastPred.nextPoopExpectedAt!.getTime() - postBfastCheck.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeLessThanOrEqual(0); // Overdue in the morning, not +7-9h in the future!
    } else {
      expect(postBfastPred.poopMode).toBe('post_meal_override');
    }
  });

  it('verifies pee engine alignment: midnight pre-bed pee followed by waking up without morning pee also targets today, not next day', () => {
    // Late night pee on Aug 28 at 00:10 AM
    const dataset = newestFirst([...generatePistache14DayHistory(), act('pee', '2026-08-28T00:10:00+02:00')]);

    // At 08:30 AM, puppy woke up but owner has not logged morning pee yet
    const morningCheck = new Date('2026-08-28T08:30:00+02:00');
    const morningPred = calculatePredictions(dataset, PISTACHE, morningCheck, 'Europe/Paris');

    expect(morningPred.nextPeeExpectedAt).not.toBeNull();
    // Must target TODAY's 07:15 learned wakeup, NOT tomorrow Aug 29!
    expect(at(morningPred.nextPeeExpectedAt!)).toBe('2026-08-28 07:15');
    expect(morningPred.peeMode).toBe('daytime_baseline');
    expect(morningPred.peeUrgency).toBe('overdue');
  });
});
