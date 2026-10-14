import { describe, it, expect } from 'vitest';
import {
  getPuppyAge,
  calculateVetFoodGramGoal,
  detectSleepSchedule,
  calculateLearnedIntervalMinutes,
  calculateLearnedPostMealDelayMinutes,
  calculateMorningSequenceOffsets,
  shouldApplyPostMealOverride,
  predictNextPee,
  predictNextPoop,
  predictNextFood,
  calculatePredictions,
} from '../predictions';
import { getLocalHour } from '../date';
import type { Activity, PuppyProfile } from '../../types';
import { act, at, BALMA, newestFirst } from './fixtures';

describe('predictions utility — comprehensive test suite', () => {
  const mockProfile: PuppyProfile = {
    id: 'pup-1',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27',
    weightKg: 7.8,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  /**
   * Helper to format deterministic ISO strings for Europe/Paris (UTC+2 in August), or for another `utcOffset`
   */
  function makeParisIso(day: number, hour: number, minute: number = 0, utcOffset: string = '+02:00'): string {
    const dStr = String(day).padStart(2, '0');
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(minute).padStart(2, '0');
    return `2026-08-${dStr}T${hStr}:${mStr}:00${utcOffset}`;
  }

  /**
   * Helper to generate a realistic 7-day multi-day activity dataset (modeled after real puppy logs),
   * on the local wall clock of `utcOffset`
   */
  function generateRealisticMultiDayDataset(utcOffset: string = '+02:00'): Activity[] {
    const activities: Activity[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayNum = 1 + dayOffset;

      // Breakfast 07:00 AM
      activities.push({ id: `f1-${dayOffset}`, puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(dayNum, 7, 0, utcOffset), quantityGrams: 80, loggedBy: 'Matthieu' });

      // First-morning pee 07:15 AM
      activities.push({ id: `p1-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(dayNum, 7, 15, utcOffset), loggedBy: 'Matthieu' });

      // Morning post-breakfast poop 07:45 AM
      activities.push({ id: `po1-${dayOffset}`, puppyId: 'pup-1', type: 'poop', timestamp: makeParisIso(dayNum, 7, 45, utcOffset), loggedBy: 'Matthieu' });

      // Mid-morning pee 10:00 AM
      activities.push({ id: `p2-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(dayNum, 10, 0, utcOffset), loggedBy: 'Matthieu' });

      // Lunch 12:00 PM
      activities.push({ id: `f2-${dayOffset}`, puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(dayNum, 12, 0, utcOffset), quantityGrams: 80, loggedBy: 'Matthieu' });

      // Post-lunch pee 12:20 PM
      activities.push({ id: `p3-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(dayNum, 12, 20, utcOffset), loggedBy: 'Matthieu' });

      // Afternoon pee 15:30 PM
      activities.push({ id: `p4-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(dayNum, 15, 30, utcOffset), loggedBy: 'Matthieu' });

      // Dinner 19:00 PM
      activities.push({ id: `f3-${dayOffset}`, puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(dayNum, 19, 0, utcOffset), quantityGrams: 80, loggedBy: 'Matthieu' });

      // Post-dinner poop 19:35 PM
      activities.push({ id: `po2-${dayOffset}`, puppyId: 'pup-1', type: 'poop', timestamp: makeParisIso(dayNum, 19, 35, utcOffset), loggedBy: 'Matthieu' });

      // Bedtime pee 22:30 PM
      activities.push({ id: `p5-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(dayNum, 22, 30, utcOffset), loggedBy: 'Matthieu' });
    }

    // Newest first, like the API (orderBy timestamp desc)
    return activities.reverse();
  }

  // 1. getPuppyAge
  describe('getPuppyAge', () => {
    it('calculates puppy age in weeks for puppies under 16 weeks', () => {
      expect(getPuppyAge('2026-06-01', '2026-08-01')).toEqual({ weeks: 8, months: 2, text: '8 weeks old' });
    });

    it('calculates puppy age in months and weeks for puppies over 16 weeks', () => {
      expect(getPuppyAge('2026-01-01', '2026-08-01')).toEqual({ weeks: 30, months: 7, text: '6 mo 4 wk old' });
    });

    it('handles future birth dates safely by returning 0 weeks', () => {
      expect(getPuppyAge('2099-01-01', '2026-08-01')).toEqual({ weeks: 0, months: 0, text: '0 weeks old' });
    });
  });

  // 2. calculateVetFoodGramGoal
  describe('calculateVetFoodGramGoal', () => {
    it('calculates RER and MER correctly for young growth stage (< 4 months)', () => {
      expect(calculateVetFoodGramGoal(5.0, 3)).toBe(185);
    });

    it('calculates MER correctly for medium growth stage (4-12 months)', () => {
      expect(calculateVetFoodGramGoal(8.0, 5)).toBe(175);
    });

    it('calculates MER correctly for adult stage (> 12 months)', () => {
      expect(calculateVetFoodGramGoal(13.0, 14)).toBe(202);
    });

    it('guards against zero, negative, or NaN weight/age inputs', () => {
      expect(calculateVetFoodGramGoal(0, 4)).toBe(240);
      expect(calculateVetFoodGramGoal(-5, 4)).toBe(240);
      expect(calculateVetFoodGramGoal(NaN, 4)).toBe(240);
      // A NaN age falls back to the 6-month multiplier
      expect(calculateVetFoodGramGoal(8, NaN)).toBe(calculateVetFoodGramGoal(8, 6));
    });
  });

  // 3. detectSleepSchedule
  describe('detectSleepSchedule', () => {
    it('detects typical night sleep schedule from realistic activity logs', () => {
      const dataset = generateRealisticMultiDayDataset();
      const schedule = detectSleepSchedule(dataset, 'Europe/Paris');
      // Bedtime = the daily 22:30 pee; wakeup = the first log of the day (07:00 breakfast)
      expect(schedule).toEqual({ bedtimeHour: 22.5, wakeupHour: 7, bedtimeStr: '22:30', wakeupStr: '07:00' });
    });

    it('falls back to default schedule (22:00 - 07:00) when activity count is less than 5', () => {
      const dataset: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-09T10:00:00.000Z', loggedBy: 'Matthieu' },
      ];
      const schedule = detectSleepSchedule(dataset, 'Europe/Paris');
      expect(schedule.bedtimeHour).toBe(22);
      expect(schedule.wakeupHour).toBe(7);
    });
  });

  // 4. calculateLearnedIntervalMinutes
  describe('calculateLearnedIntervalMinutes', () => {
    it('learns the 70th-percentile daytime pee interval, excluding the overnight gap and the interval ending at bedtime', () => {
      const dataset = generateRealisticMultiDayDataset();
      const schedule = detectSleepSchedule(dataset, 'Europe/Paris');
      const result = calculateLearnedIntervalMinutes(dataset, 'pee', 180, schedule, 'Europe/Paris');

      // 3 samples a day x 7 days (07:15→10:00, 10:00→12:20, 12:20→15:30); 70th percentile = 190 min
      expect(result).toMatchObject({ intervalMins: 190, sampleCount: 21, isLearned: true });
    });

    it('falls back to default interval when insufficient daytime samples exist', () => {
      const result = calculateLearnedIntervalMinutes([], 'pee', 120);
      expect(result.isLearned).toBe(false);
      expect(result.intervalMins).toBe(120);
      expect(result.sampleCount).toBe(0);
    });

    const utcSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };
    const logsAt = (type: 'pee' | 'poop', isoTimes: string[]) => newestFirst(isoTimes.map((iso) => act(type, iso)));

    it('caps a learned daytime pee interval at 360 min', () => {
      // 07:30 → 14:30 → 21:30 for 3 days: six 420-min daytime gaps (the 600-min overnight gaps are dropped)
      const pees = logsAt('pee', ['08', '09', '10'].flatMap((day) => ['07:30', '14:30', '21:30'].map((time) => `2026-08-${day}T${time}:00Z`)));

      expect(calculateLearnedIntervalMinutes(pees, 'pee', 240, utcSchedule, 'UTC')).toMatchObject({ intervalMins: 360, sampleCount: 6, isLearned: true });
    });

    it('raises a learned poop interval below 180 min to 180 min', () => {
      const poops = logsAt('poop', ['08:00', '10:00', '12:00', '14:00'].map((time) => `2026-08-10T${time}:00Z`));

      expect(calculateLearnedIntervalMinutes(poops, 'poop', 360, utcSchedule, 'UTC')).toMatchObject({ intervalMins: 180, sampleCount: 3, isLearned: true });
    });

    it('drops pee gaps under 45 min and poop gaps under 90 min (second void on the same walk)', () => {
      // 35-min pee gaps and 75-min poop gaps are dropped; only the gaps between walks are learned
      const pees = logsAt('pee', ['08:00', '08:35', '12:00', '12:35', '16:00', '16:35'].map((time) => `2026-08-10T${time}:00Z`));
      const poops = logsAt('poop', ['06:00', '07:15', '12:00', '13:15', '18:00', '19:15'].map((time) => `2026-08-10T${time}:00Z`));

      expect(calculateLearnedIntervalMinutes(pees, 'pee', 240, utcSchedule, 'UTC')).toMatchObject({ intervalMins: 205, sampleCount: 2, isLearned: true });
      expect(calculateLearnedIntervalMinutes(poops, 'poop', 360, utcSchedule, 'UTC')).toMatchObject({ intervalMins: 285, sampleCount: 2, isLearned: true });
    });
  });

  // 5. calculatePredictions — Detailed Case Testing
  describe('calculatePredictions', () => {
    const dataset = generateRealisticMultiDayDataset();

    // 5.1 Pee Predictions
    describe('Pee Predictions', () => {
      it('predicts daytime baseline pee interval when no recent food trigger is active', () => {
        const referenceTime = new Date('2026-08-07T14:00:00+02:00'); // Aug 7, 14:00 PM Paris
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.peeMode).toBe('daytime_baseline');
        // 12:20 pee + learned 2h45
        expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-07 15:05');
        expect(predictions.peeReason).toContain('Learned average');
      });

      it('triggers immediate post-meal pee override when food is logged after last pee (within 60 minutes)', () => {
        const referenceTime = new Date('2026-08-07T12:10:00+02:00'); // 10 min after lunch at 12:00 Paris
        // The 12:20 pee is still in the future, so the 12:00 lunch comes after the last pee (10:00)
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.peeMode).toBe('post_meal_override');
        expect(predictions.peeReason).toContain('Post-meal potty break');
        // Lunch + learned 15 min post-meal delay
        expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-07 12:15');
      });

      describe('post-meal pee window (learned 15 min delay + 40 min) after the 12:00 lunch, with no pee since 10:00', () => {
        // Without the 12:20 pee, the 12:00 lunch is after the last pee (10:00)
        const noPeeAfterLunch = dataset.filter((activity) => activity.id !== 'p3-6');

        it('keeps the post-meal pee override inside the window (12:30, and 12:55 at its edge)', () => {
          for (const clockTime of ['12:30', '12:55']) {
            const predictions = calculatePredictions(noPeeAfterLunch, mockProfile, new Date(`2026-08-07T${clockTime}:00+02:00`), 'Europe/Paris');

            expect(predictions.peeMode).toBe('post_meal_override');
            expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-07 12:15');
          }
        });

        it('expires the post-meal pee override one minute past the window (12:56)', () => {
          const predictions = calculatePredictions(noPeeAfterLunch, mockProfile, new Date('2026-08-07T12:56:00+02:00'), 'Europe/Paris');

          expect(predictions.peeMode).toBe('daytime_baseline');
          expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-07 13:10');
        });

        it('expires the post-meal pee override after the window (13:15) and reverts to the daytime baseline', () => {
          const predictions = calculatePredictions(noPeeAfterLunch, mockProfile, new Date('2026-08-07T13:15:00+02:00'), 'Europe/Paris');

          expect(predictions.peeMode).toBe('daytime_baseline');
          expect(predictions.peeReason).not.toMatch(/post-meal/i);
          // 10:00 pee + learned 3h10
          expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-07 13:10');
        });
      });

      it('enters night mode and predicts morning wakeup during sleep hours (e.g. 02:00 AM)', () => {
        const referenceTime = new Date('2026-08-08T02:00:00+02:00'); // 02:00 AM night Paris
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.peeMode).toBe('night_sleep');
        expect(predictions.peeReason).toContain('Morning outing');
        expect(predictions.peeUrgency).toBe('safe');
      });

      it('includes mid-night break for young puppies under 2.5 months during night mode', () => {
        const youngProfile: PuppyProfile = { ...mockProfile, birthDate: '2026-07-01' }; // ~5 weeks old
        const nightTime = new Date('2026-08-08T00:30:00+02:00'); // 00:30 AM night Paris

        const youngDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-07T23:00:00+02:00', loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(youngDataset, youngProfile, nightTime, 'Europe/Paris');
        expect(predictions.peeMode).toBe('night_sleep');
        expect(predictions.peeReason).toContain('Young puppy mid-night potty break');
      });

      it('still schedules the mid-night break just under the 2.5-month cutoff (2.2 months old)', () => {
        const predictions = calculatePredictions(
          [act('pee', '2026-08-10T22:00:00Z')],
          { ...BALMA, birthDate: '2026-06-04' },
          new Date('2026-08-10T23:00:00Z'),
          'UTC'
        );

        expect(predictions.peeMode).toBe('night_sleep');
        expect(predictions.peeReason).toBe('Night mode: Young puppy mid-night potty break');
        // 22:00 pee + 4 h
        expect(predictions.nextPeeExpectedAt!.toISOString()).toBe('2026-08-11T02:00:00.000Z');
      });

      it('keeps a pee from the same day (08:00, less than 18 h before the 22:00 bedtime) due past bedtime instead of rolling to the morning', () => {
        const predictions = calculatePredictions([act('pee', '2026-08-10T08:00:00Z')], BALMA, new Date('2026-08-10T22:30:00Z'), 'UTC');

        // 08:00 + 4 h standard interval, still owed tonight
        expect(predictions.peeMode).toBe('daytime_baseline');
        expect(predictions.nextPeeExpectedAt!.toISOString()).toBe('2026-08-10T12:00:00.000Z');
        expect(predictions.peeUrgency).toBe('overdue');
      });

      it('keeps daytime mode past bedtime until the pre-bed pee is logged, then switches to night mode', () => {
        const referenceTime = new Date('2026-08-07T22:45:00+02:00'); // 22:45 PM Paris (bedtime is 22:30)

        const withoutPreBedPee = calculatePredictions(
          dataset.filter((activity) => activity.id !== 'p5-6'),
          mockProfile,
          referenceTime,
          'Europe/Paris'
        );
        expect(withoutPreBedPee.peeMode).toBe('daytime_baseline');
        expect(withoutPreBedPee.peeUrgency).toBe('overdue');
        // 15:30 pee + learned 3h10
        expect(at(withoutPreBedPee.nextPeeExpectedAt!)).toBe('2026-08-07 18:40');

        const withPreBedPee = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(withPreBedPee.peeMode).toBe('night_sleep');
        expect(at(withPreBedPee.nextPeeExpectedAt!)).toBe('2026-08-08 07:00');
      });

      it('applies the post-meal pee trigger only below 5 months when no post-meal history is learned', () => {
        const referenceTime = new Date('2026-08-07T12:10:00+02:00');
        const activities = [act('pee', '2026-08-07T10:00:00+02:00'), act('food', '2026-08-07T12:00:00+02:00')];

        // 4.9 months old: 12:00 lunch + 20 min age fallback
        const underFiveMonths = calculatePredictions(activities, { ...BALMA, birthDate: '2026-03-10' }, referenceTime, 'Europe/Paris');
        expect(underFiveMonths.peeMode).toBe('post_meal_override');
        expect(at(underFiveMonths.nextPeeExpectedAt!)).toBe('2026-08-07 12:20');

        // 5.2 months old: 10:00 pee + 4h standard interval
        const overFiveMonths = calculatePredictions(activities, { ...BALMA, birthDate: '2026-03-01' }, referenceTime, 'Europe/Paris');
        expect(overFiveMonths.peeMode).toBe('daytime_baseline');
        expect(at(overFiveMonths.nextPeeExpectedAt!)).toBe('2026-08-07 14:00');
      });
    });

    // 5.2 Poop Predictions
    describe('Poop Predictions', () => {
      it('predicts gastrocolic post-meal poop break when food is logged after last poop (within 90 minutes)', () => {
        const referenceTime = new Date('2026-08-07T12:20:00+02:00'); // 12:20 PM Paris
        const simplePostMealDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: '2026-08-07T08:00:00+02:00', loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-07T12:00:00+02:00', loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(simplePostMealDataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.poopMode).toBe('post_meal_override');
        expect(predictions.poopReason).toContain('Post-meal poop break');
      });

      it('handles recent constipation and bowel clearance gracefully with extended recovery phase and safe status', () => {
        const referenceTime = new Date('2026-08-08T10:00:00+02:00'); // Aug 8, 10:00 AM Paris

        const constipationDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: '2026-08-07T21:11:00+02:00', stoolConsistency: 'hard', loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-08T08:00:00+02:00', loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(constipationDataset, mockProfile, referenceTime, 'Europe/Paris');
        // KNOWN BUG R3: pinned in Phase 3a (urgency stays 'safe' although the predicted 05:35 is past at 10:00)
        expect(predictions.poopUrgency).toBe('safe');
        expect(predictions.poopReason).toContain('Digestive recovery');
      });

      // Urgency is left out of the two hard-stool tests below: KNOWN BUG R3 keeps it 'safe', pinned in Phase 3a.
      it('pauses at least 8 h after a hard stool when 1.4 x the learned interval is shorter', () => {
        const poops = newestFirst([
          act('poop', '2026-08-10T06:00:00Z'),
          act('poop', '2026-08-10T10:00:00Z'),
          act('poop', '2026-08-10T14:00:00Z'),
          act('poop', '2026-08-10T18:00:00Z', { stoolConsistency: 'hard' }),
        ]);

        const predictions = calculatePredictions(poops, BALMA, new Date('2026-08-10T19:00:00Z'), 'UTC');

        // Learned 240 min x 1.4 = 336 min is below the 480-min floor: 18:00 + 8 h
        expect(predictions.poopReason).toBe('Digestive recovery: pause after hard stool');
        expect(predictions.nextPoopExpectedAt!.toISOString()).toBe('2026-08-11T02:00:00.000Z');
      });

      it('ignores a hard stool logged more than 16 h ago and goes back to the standard interval', () => {
        const lateBedtime = { bedtimeHour: 23.5, wakeupHour: 6, bedtimeStr: '23:30', wakeupStr: '06:00' };

        // 05:00 hard stool, 17 h before 22:00
        const predictions = calculatePredictions(
          [act('poop', '2026-08-10T05:00:00Z', { stoolConsistency: 'hard' })],
          BALMA,
          new Date('2026-08-10T22:00:00Z'),
          'UTC',
          lateBedtime
        );

        expect(predictions.poopReason).toBe('Standard digestive interval (~6h)');
        expect(predictions.nextPoopExpectedAt!.toISOString()).toBe('2026-08-10T11:00:00.000Z');
      });

      it('enters night sleep mode for poop during overnight hours', () => {
        const referenceTime = new Date('2026-08-08T01:30:00+02:00'); // 01:30 AM night Paris
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.poopMode).toBe('night_sleep');
        expect(predictions.poopReason).toMatch(/morning outing/i);
      });

      it('applies the post-meal poop trigger only below 5 months when no post-meal history is learned', () => {
        const referenceTime = new Date('2026-08-07T12:20:00+02:00');
        const activities = [act('poop', '2026-08-07T08:00:00+02:00'), act('food', '2026-08-07T12:00:00+02:00')];

        // 4.9 months old: 12:00 lunch + 35 min age fallback
        const underFiveMonths = calculatePredictions(activities, { ...BALMA, birthDate: '2026-03-10' }, referenceTime, 'Europe/Paris');
        expect(underFiveMonths.poopMode).toBe('post_meal_override');
        expect(at(underFiveMonths.nextPoopExpectedAt!)).toBe('2026-08-07 12:35');

        // 5.2 months old: 08:00 poop + 6h standard interval
        const overFiveMonths = calculatePredictions(activities, { ...BALMA, birthDate: '2026-03-01' }, referenceTime, 'Europe/Paris');
        expect(overFiveMonths.poopMode).toBe('daytime_baseline');
        expect(at(overFiveMonths.nextPoopExpectedAt!)).toBe('2026-08-07 14:00');
      });

      it('treats unpooped morning stool as overdue when post-meal override window has elapsed, symmetric with pee', () => {
        const youngProfile: PuppyProfile = { ...mockProfile, birthDate: '2026-06-01' };
        const olderProfile: PuppyProfile = { ...mockProfile, birthDate: '2026-01-01' };

        const referenceTime = new Date('2026-08-07T14:00:00+02:00');

        const activities: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: '2026-08-06T19:00:00+02:00', loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-07T12:00:00+02:00', loggedBy: 'Matthieu' },
        ];

        const predYoung = calculatePredictions(activities, youngProfile, referenceTime, 'Europe/Paris');
        const predOlder = calculatePredictions(activities, olderProfile, referenceTime, 'Europe/Paris');

        // At 14:00 (2h post meal), post-meal window elapsed and puppy has not pooped since yesterday 19:00:
        // Morning poop is overdue (anchored to morning wakeup ~07:00), not pushed into future
        expect(predYoung.poopMode).toBe('daytime_baseline');
        expect(getLocalHour(predYoung.nextPoopExpectedAt!, 'Europe/Paris')).toBe(7);
        expect(predYoung.poopUrgency).toBe('overdue');
        expect(predOlder.poopMode).toBe('daytime_baseline');
        expect(getLocalHour(predOlder.nextPoopExpectedAt!, 'Europe/Paris')).toBe(7);
        expect(predOlder.poopUrgency).toBe('overdue');
      });
    });

    // 5.3 Food Predictions
    describe('Food Predictions', () => {
      it('calculates vet recommended target meals per day based on age (4 for <3mo, 3 for 3-6mo, 2 for >6mo)', () => {
        const pup2mo: PuppyProfile = { ...mockProfile, birthDate: '2026-06-01', targetMealsPerDay: 0 };
        const pup4mo: PuppyProfile = { ...mockProfile, birthDate: '2026-04-01', targetMealsPerDay: 0 };
        const pup8mo: PuppyProfile = { ...mockProfile, birthDate: '2025-12-01', targetMealsPerDay: 0 };

        const refTime = new Date('2026-08-07T10:00:00+02:00');

        const p2 = calculatePredictions([], pup2mo, refTime, 'Europe/Paris');
        const p4 = calculatePredictions([], pup4mo, refTime, 'Europe/Paris');
        const p8 = calculatePredictions([], pup8mo, refTime, 'Europe/Paris');

        expect(p2.foodReason).toContain('Meal 1 of 4');
        expect(p4.foodReason).toContain('Meal 1 of 3');
        expect(p8.foodReason).toContain('Meal 1 of 2');
      });

      it('schedules breakfast 15 min after the wake-up pee when no meal is logged today, overdue at 08:15', () => {
        const referenceTime = new Date('2026-08-07T08:15:00+02:00'); // 08:15 AM Paris
        const noMealsToday = dataset.filter((activity) => !activity.id.startsWith('f') || !activity.id.endsWith('-6'));

        const predictions = calculatePredictions(noMealsToday, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.foodMode).toBe('daytime_schedule');
        // Learned breakfast is 07:00, but the 07:15 wake-up pee pushes it to 07:30
        expect(predictions.foodReason).toBe('Breakfast (~07:30, Meal 1 of 3)');
        expect(predictions.foodUrgency).toBe('overdue');
      });

      it('spaces remaining daytime meals evenly when partial meals have been logged today', () => {
        const referenceTime = new Date('2026-08-07T10:00:00+02:00'); // 10:00 AM Paris, only the 07:00 breakfast is logged today

        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.foodMode).toBe('daytime_schedule');
        // (22:30 bedtime - 07:00) / 3 = 5.2h after the 07:00 breakfast
        expect(predictions.foodReason).toBe('Meal 2 of 3 (spaced ~5.2h)');
        expect(at(predictions.nextFoodExpectedAt!)).toBe('2026-08-07 12:10');
      });

      it('flags breakfast as soon within 15 min of it (07:18 for the 07:30 breakfast)', () => {
        const predictions = calculatePredictions([act('pee', '2026-08-10T07:00:00Z')], BALMA, new Date('2026-08-10T07:18:00Z'), 'UTC');

        expect(predictions.nextFoodExpectedAt!.toISOString()).toBe('2026-08-10T07:30:00.000Z');
        expect(predictions.foodUrgency).toBe('soon');
      });

      it('caps meal spacing at 5.5 h (2 meals a day, 08:00 breakfast, 14 waking hours left)', () => {
        const predictions = calculatePredictions(
          [act('food', '2026-08-10T08:00:00Z')],
          { ...BALMA, targetMealsPerDay: 2 },
          new Date('2026-08-10T09:00:00Z'),
          'UTC'
        );

        // (22:00 - 08:00) / 2 = 7 h, capped at 5.5 h
        expect(predictions.foodReason).toBe('Meal 2 of 2 (spaced ~5.5h)');
        expect(predictions.nextFoodExpectedAt!.toISOString()).toBe('2026-08-10T13:30:00.000Z');

        // Same cap at 23:00, when the missing meal is kept past bedtime instead of switching to night mode
        const pastBedtime = calculatePredictions(
          [act('food', '2026-08-10T08:00:00Z')],
          { ...BALMA, targetMealsPerDay: 2 },
          new Date('2026-08-10T23:00:00Z'),
          'UTC'
        );
        expect(pastBedtime.foodMode).toBe('daytime_schedule');
        expect(pastBedtime.foodReason).toBe('Meal 2 of 2 (spaced ~5.5h)');
        expect(pastBedtime.nextFoodExpectedAt!.toISOString()).toBe('2026-08-10T13:30:00.000Z');
        expect(pastBedtime.foodUrgency).toBe('overdue');
      });

      it('flags goal reached once 90% of the daily gram goal is logged', () => {
        const referenceTime = new Date('2026-08-07T19:30:00+02:00'); // 19:30 PM Paris after dinner
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.foodMode).toBe('goal_reached');
        expect(predictions.foodUrgency).toBe('safe');
        expect(predictions.foodReason).toContain('Daily goal reached');
      });

      it('with no daily gram goal, flags goal reached once the target meal count is logged', () => {
        const noGramGoal: PuppyProfile = { ...mockProfile, dailyFoodGramGoal: 0 };

        // 2 of 3 meals logged at 13:00
        const twoMeals = calculatePredictions(dataset, noGramGoal, new Date('2026-08-07T13:00:00+02:00'), 'Europe/Paris');
        expect(twoMeals.foodMode).toBe('daytime_schedule');

        // 3 of 3 meals logged at 19:30
        const threeMeals = calculatePredictions(dataset, noGramGoal, new Date('2026-08-07T19:30:00+02:00'), 'Europe/Paris');
        expect(threeMeals.foodMode).toBe('goal_reached');
      });

      it('enters night sleep mode for food during overnight hours', () => {
        const referenceTime = new Date('2026-08-08T02:00:00+02:00'); // 02:00 AM Paris
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.foodMode).toBe('night_sleep');
        expect(predictions.foodUrgency).toBe('safe');
      });
    });

    // 5.4 Cross-Timezone Robustness
    describe('Cross-Timezone Robustness', () => {
      it('evaluates identical local predictions for the same local routine in any IANA timezone', () => {
        const zones: Array<[string, string]> = [
          ['Europe/Paris', '+02:00'],
          ['America/New_York', '-04:00'],
          ['Pacific/Honolulu', '-10:00'],
        ];

        for (const [timeZone, utcOffset] of zones) {
          const localRoutine = generateRealisticMultiDayDataset(utcOffset);
          const afternoon = calculatePredictions(localRoutine, mockProfile, new Date(makeParisIso(7, 14, 0, utcOffset)), timeZone);
          const night = calculatePredictions(localRoutine, mockProfile, new Date(makeParisIso(8, 2, 0, utcOffset)), timeZone);

          expect(afternoon.peeMode).toBe('daytime_baseline');
          expect(at(afternoon.nextPeeExpectedAt!, timeZone)).toBe('2026-08-07 15:05');
          expect(night.peeMode).toBe('night_sleep');
          expect(at(night.nextPeeExpectedAt!, timeZone)).toBe('2026-08-08 07:00');
        }
      });

      it('keeps the 07:00 morning outing on the wall clock across the DST fall-back night', () => {
        // 2026-10-25: Paris goes from UTC+2 to UTC+1 at 03:00; 02:30+01:00 is after the change
        const predictions = calculatePredictions(
          [act('pee', '2026-10-24T22:00:00+02:00')],
          BALMA,
          new Date('2026-10-25T02:30:00+01:00'),
          'Europe/Paris'
        );

        expect(predictions.peeMode).toBe('night_sleep');
        expect(predictions.nextPeeExpectedAt!.toISOString()).toBe('2026-10-25T06:00:00.000Z'); // 07:00 UTC+1
      });
    });
  });

  // 6. Regression Bug Fixes (Bugs 1 - 5)
  describe('Regression Bug Fixes', () => {
    it('Bug 1: early morning potty before estimated wakeup overrides Night Mode', () => {
      // Reference time: 07:15 AM today Paris. Wakeup schedule is 07:37 AM.
      // A pee log occurred at 07:05 AM today.
      const refTime = new Date('2026-08-13T07:15:00+02:00');
      const activities: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(13, 7, 5), loggedBy: 'Matthieu' },
      ];

      const predictions = calculatePredictions(
        activities,
        mockProfile,
        refTime,
        'Europe/Paris',
        { bedtimeHour: 22, wakeupHour: 7.61, bedtimeStr: '22:00', wakeupStr: '07:37' }
      );

      expect(predictions.peeMode).toBe('daytime_baseline');
      expect(predictions.peeReason).toBe('Standard bladder interval (~4h)');
      expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-13 11:05');
    });

    it('Bug 2: late evening potty (e.g. 21:22 PM) predicts wakeup TOMORROW morning (+10h) and urgency is safe', () => {
      // Reference time: 21:22 PM today Paris. Bedtime is 21:30 PM. Wakeup is 07:37 AM.
      const refTime = new Date('2026-08-13T21:22:00+02:00');
      const activities: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(13, 21, 18), loggedBy: 'Matthieu' },
      ];

      const predictions = calculatePredictions(
        activities,
        mockProfile,
        refTime,
        'Europe/Paris',
        { bedtimeHour: 21.5, wakeupHour: 7.61, bedtimeStr: '21:30', wakeupStr: '07:37' }
      );

      expect(predictions.peeUrgency).toBe('safe');
      expect(predictions.peeMode).toBe('daytime_baseline'); // still before the 21:30 bedtime
      // Target wakeup must be tomorrow at 07:37 AM
      expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-14 07:37');
    });

    it('Bug 4: feeding 3 small 40g meals (totaling 120g / 240g goal) does NOT trigger goal_reached', () => {
      const refTime = new Date('2026-08-13T15:00:00+02:00'); // 15:00 PM afternoon Paris
      const smallMeals: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(13, 7, 0), quantityGrams: 40, loggedBy: 'Matthieu' },
        { id: '2', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(13, 11, 0), quantityGrams: 40, loggedBy: 'Matthieu' },
        { id: '3', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(13, 14, 0), quantityGrams: 40, loggedBy: 'Matthieu' },
      ];

      const predictions = calculatePredictions(
        smallMeals,
        mockProfile,
        refTime,
        'Europe/Paris',
        { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' }
      );

      // Should still be in daytime schedule because 120g is only 50% of the 240g goal
      expect(predictions.foodMode).toBe('daytime_schedule');
      expect(predictions.foodReason).toContain('Remaining portion');
    });

    it('Bug 5: detectSleepSchedule moves bedtime to 23:00 after 5 recent late nights that follow 9 nights at 21:00', () => {
      const earlyNights: Activity[] = [];
      for (let dayIndex = 0; dayIndex < 9; dayIndex++) {
        earlyNights.push(act('pee', makeParisIso(1 + dayIndex, 7, 0)), act('pee', makeParisIso(1 + dayIndex, 21, 0)));
      }
      const lateNights: Activity[] = [];
      for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
        lateNights.push(act('pee', makeParisIso(10 + dayIndex, 7, 0)), act('pee', makeParisIso(10 + dayIndex, 23, 0)));
      }

      expect(detectSleepSchedule(newestFirst(earlyNights), 'Europe/Paris').bedtimeStr).toBe('21:00');
      expect(detectSleepSchedule(newestFirst([...earlyNights, ...lateNights]), 'Europe/Paris').bedtimeStr).toBe('23:00');
    });
  });

  // 7. Decoupled Predictors & Empirical Morning Sequence Tests
  describe('Decoupled Predictors & Empirical Morning Sequence', () => {
    it('predictNextPee executes independently and matches the calculatePredictions pee fields', () => {
      const dataset = generateRealisticMultiDayDataset();
      const refTime = new Date('2026-08-07T14:00:00+02:00');
      const peeResult = predictNextPee(dataset, mockProfile, refTime, { timeZone: 'Europe/Paris' });
      const facade = calculatePredictions(dataset, mockProfile, refTime, 'Europe/Paris');

      expect(peeResult).toEqual({
        nextExpectedAt: facade.nextPeeExpectedAt,
        standardExpectedAt: facade.standardPeeExpectedAt,
        deltaMins: facade.peeDeltaMins,
        mode: facade.peeMode,
        urgency: facade.peeUrgency,
        reason: facade.peeReason,
      });
      expect(peeResult.mode).toBe('daytime_baseline');
      expect(at(peeResult.nextExpectedAt!)).toBe('2026-08-07 15:05');
      expect(peeResult.deltaMins).toBe(25);
      expect(peeResult.urgency).toBe('safe');
    });

    it('predictNextPoop executes independently: 07:45 poop + learned 12h10 digestive interval', () => {
      const dataset = generateRealisticMultiDayDataset();
      const refTime = new Date('2026-08-07T14:00:00+02:00');
      const poopResult = predictNextPoop(dataset, mockProfile, refTime, { timeZone: 'Europe/Paris' });

      expect(poopResult.mode).toBe('daytime_baseline');
      expect(poopResult.reason).toBe('Learned average: ~12h10 digestive interval');
      expect(at(poopResult.nextExpectedAt!)).toBe('2026-08-07 19:55');
      expect(poopResult.deltaMins).toBe(30);
    });

    it('predictNextFood executes independently: third meal of 80 g, spaced from the 12:00 lunch', () => {
      const dataset = generateRealisticMultiDayDataset();
      const refTime = new Date('2026-08-07T14:00:00+02:00');
      const foodResult = predictNextFood(dataset, mockProfile, refTime, { timeZone: 'Europe/Paris' });

      expect(foodResult.mode).toBe('daytime_schedule');
      expect(foodResult.reason).toBe('Meal 3 of 3 (spaced ~5.3h)');
      expect(at(foodResult.nextExpectedAt!)).toBe('2026-08-07 17:15');
      expect(foodResult.portionGrams).toBe(80);
    });

    it('calculateMorningSequenceOffsets calculates empirical offsets from historical morning logs', () => {
      const activities: Activity[] = [];
      // 5 days of data: Pee at 07:00, Poop at 07:07 (+7m), Breakfast at 07:18 (+18m)
      for (let d = 0; d < 5; d++) {
        activities.push({ id: `p-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 7, 0), loggedBy: 'Matthieu' });
        activities.push({ id: `po-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: makeParisIso(10 + d, 7, 7), loggedBy: 'Matthieu' });
        activities.push({ id: `f-${d}`, puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(10 + d, 7, 18), quantityGrams: 80, loggedBy: 'Matthieu' });
      }

      const offsets = calculateMorningSequenceOffsets(activities, 'Europe/Paris');
      expect(offsets.morningPoopOffsetMins).toBe(7);
      expect(offsets.morningFoodOffsetMins).toBe(18);
    });

    it('calculateMorningSequenceOffsets falls back to 10 min (poop) and 20 min (breakfast) without a morning poop or meal', () => {
      expect(calculateMorningSequenceOffsets([], 'Europe/Paris')).toEqual({ morningPoopOffsetMins: 10, morningFoodOffsetMins: 20 });
      expect(calculateMorningSequenceOffsets([act('pee', makeParisIso(10, 7, 0))], 'Europe/Paris')).toEqual({ morningPoopOffsetMins: 10, morningFoodOffsetMins: 20 });
    });

    it('at 02:00 in night mode, predicts the morning sequence pee <= poop <= food from the wake-up time and learned offsets', () => {
      const activities: Activity[] = [];
      for (let d = 0; d < 5; d++) {
        activities.push({ id: `p-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 7, 20), loggedBy: 'Matthieu' });
        activities.push({ id: `po-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: makeParisIso(10 + d, 7, 28), loggedBy: 'Matthieu' });
        activities.push({ id: `f-${d}`, puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(10 + d, 7, 42), quantityGrams: 80, loggedBy: 'Matthieu' });
        // Evening poop and bedtime pee, so the poop interval is learned under 24 h and bedtime is 22:00
        activities.push(act('poop', makeParisIso(10 + d, 18, 30)), act('pee', makeParisIso(10 + d, 22, 0)));
      }

      const nightRefTime = new Date('2026-08-15T02:00:00+02:00'); // 02:00 AM Paris
      const predictions = calculatePredictions(newestFirst(activities), mockProfile, nightRefTime, 'Europe/Paris');

      expect([predictions.peeMode, predictions.poopMode, predictions.foodMode]).toEqual(['night_sleep', 'night_sleep', 'night_sleep']);
      // The 18:30 poop + learned interval lands at 05:32, in the night...
      expect(at(predictions.standardPoopExpectedAt!)).toBe('2026-08-15 05:32');
      // ...so pee, poop and breakfast follow the 07:20 wake-up on the upcoming morning (Aug 15), NOT the next day (+29 hours):
      // wake-up, + learned 8-min pee → poop offset, learned 07:42 breakfast
      expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-15 07:20');
      expect(at(predictions.nextPoopExpectedAt!)).toBe('2026-08-15 07:28');
      expect(predictions.poopReason).toBe('Morning outing (~07:28)');
      expect(at(predictions.nextFoodExpectedAt!)).toBe('2026-08-15 07:42');
    });

    it('predicts next upcoming breakfast accurately at 00:20 AM without adding an extra 24 hours', () => {
      const activities: Activity[] = [
        { id: 'f-1', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(18, 8, 0), quantityGrams: 80, loggedBy: 'Matthieu' },
        { id: 'f-2', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(18, 13, 0), quantityGrams: 80, loggedBy: 'Matthieu' },
        { id: 'f-3', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(18, 19, 0), quantityGrams: 80, loggedBy: 'Matthieu' },
      ];

      // Current time is 00:20 AM on Aug 19, 2026 Paris
      const refTime = new Date('2026-08-19T00:20:00+02:00');
      const sleepSchedule = { bedtimeHour: 22.5, wakeupHour: 7.5, bedtimeStr: '22:30', wakeupStr: '07:30' };
      const foodPrediction = predictNextFood(activities, mockProfile, refTime, { sleepSchedule, timeZone: 'Europe/Paris' });

      expect(foodPrediction.mode).toBe('night_sleep');
      // The learned 08:00 breakfast on Aug 19 (same day morning, ~7.7h away), NOT Aug 20 (+31h)
      expect(at(foodPrediction.nextExpectedAt!)).toBe('2026-08-19 08:00');
    });

    it('factors in pre-bedtime waking retention intervals spanning across midnight (e.g. 21:30 to 00:30)', () => {
      const activities: Activity[] = [];
      // 5 days of data where puppy pees at 21:30 and has a final pre-bedtime outing at 00:30 (3h gap across midnight)
      for (let d = 0; d < 5; d++) {
        activities.push({ id: `p-eve-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 21, 30), loggedBy: 'Matthieu' });
        activities.push({ id: `p-mid-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(11 + d, 0, 30), loggedBy: 'Matthieu' });
      }

      const sleepSchedule = { bedtimeHour: 1, wakeupHour: 7, bedtimeStr: '01:00', wakeupStr: '07:00' };
      const learned = calculateLearnedIntervalMinutes(activities, 'pee', 120, sleepSchedule, 'Europe/Paris');

      expect(learned.isLearned).toBe(true);
      expect(learned.sampleCount).toBe(5); // one 21:30 → 00:30 interval per night
      expect(learned.intervalMins).toBe(180); // 3 hours (180 mins) exactly
    });

    it('accurately learns ~4h30m waking pee intervals for 5x/day routine with post-midnight bedtime (00:48 AM)', () => {
      const activities: Activity[] = [];
      // 5 days of realistic 5x/day routine: 07:50, 12:15, 17:15, 22:15, 00:40
      for (let d = 0; d < 5; d++) {
        activities.push({ id: `p-1-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 7, 50), loggedBy: 'Matthieu' });
        activities.push({ id: `p-2-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 12, 15), loggedBy: 'Matthieu' });
        activities.push({ id: `p-3-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 17, 15), loggedBy: 'Matthieu' });
        activities.push({ id: `p-4-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 22, 15), loggedBy: 'Matthieu' });
        activities.push({ id: `p-5-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(11 + d, 0, 40), loggedBy: 'Matthieu' });
      }

      const sleepSchedule = { bedtimeHour: 0.8, wakeupHour: 7.6, bedtimeStr: '00:48', wakeupStr: '07:37' };
      const learned = calculateLearnedIntervalMinutes(activities, 'pee', 120, sleepSchedule, 'Europe/Paris');

      expect(learned.isLearned).toBe(true);
      // KNOWN BUG NEW-1: pinned in Phase 3a (today sampleCount is 24: the four 00:40 → 07:50 overnight gaps count as daytime samples)
      expect(learned.sampleCount).toBeGreaterThanOrEqual(15);
      // Average should be ~265 - 300m (~4h25m - 5h), NOT compressed to 3h28m
      expect(learned.intervalMins).toBeGreaterThanOrEqual(260);
      expect(learned.intervalMins).toBeLessThanOrEqual(305);
    });

    it('calculates proper meal intervals when bedtime wraps past midnight', () => {
      const activities: Activity[] = [
        { id: 'f-1', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(10, 12, 0), quantityGrams: 80, loggedBy: 'Matthieu' },
        { id: 'f-2', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(10, 18, 0), quantityGrams: 80, loggedBy: 'Matthieu' },
      ];

      const refTime = new Date('2026-08-10T18:15:00+02:00');
      const sleepSchedule = { bedtimeHour: 1, wakeupHour: 7, bedtimeStr: '01:00', wakeupStr: '07:00' };
      const foodPrediction = predictNextFood(activities, mockProfile, refTime, { sleepSchedule, timeZone: 'Europe/Paris' });

      expect(foodPrediction.mode).toBe('daytime_schedule');
      // From 18:00 to 01:00 (7 waking hours left) for 1 remaining meal -> 7 / 2 = 3.5h interval
      expect(foodPrediction.reason).toContain('spaced ~3.5h');
    });

    it('accurately learns ~9h45m digestive intervals for 2x/day pooping patterns without 8h cutoff suppression', () => {
      const activities: Activity[] = [];
      // 5 days of data: morning poop at 07:30, evening poop at 17:15 (585 min / 9h45m gap)
      for (let d = 0; d < 5; d++) {
        activities.push({ id: `po-m-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: makeParisIso(10 + d, 7, 30), loggedBy: 'Matthieu' });
        activities.push({ id: `po-e-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: makeParisIso(10 + d, 17, 15), loggedBy: 'Matthieu' });
      }

      const sleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };
      const learned = calculateLearnedIntervalMinutes(activities, 'poop', 300, sleepSchedule, 'Europe/Paris');

      expect(learned.isLearned).toBe(true);
      // 5 daytime gaps (585 min) + 4 overnight gaps (855 min), 24/7 for poop; the median is 585
      expect(learned.sampleCount).toBe(9);
      // Learned interval is 585 mins (9h45m), NOT compressed to <5h
      expect(learned.intervalMins).toBe(585);
    });

    it('correctly marks breakfast as overdue during morning hours (e.g. 09:30 AM) when no breakfast is logged', () => {
      const activities: Activity[] = [
        // Yesterday's activities
        { id: 'f-prev', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(9, 19, 0), quantityGrams: 100, loggedBy: 'Matthieu' },
        // Wakeup activity recorded this morning at 07:15 AM
        { id: 'p-today', puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10, 7, 15), loggedBy: 'Matthieu' },
      ];

      // Current time is 09:30 AM on Aug 10, 2026 Paris
      const refTime = new Date('2026-08-10T09:30:00+02:00');
      const sleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };
      const foodPrediction = predictNextFood(activities, mockProfile, refTime, { sleepSchedule, timeZone: 'Europe/Paris' });

      expect(foodPrediction.mode).toBe('daytime_schedule');
      expect(foodPrediction.urgency).toBe('overdue');
      expect(foodPrediction.reason).toContain('Breakfast');
      // Next expected is this morning (07:15 wake-up pee + 15 min), NOT tomorrow morning (+21h)
      expect(at(foodPrediction.nextExpectedAt!)).toBe('2026-08-10 07:30');
    });

    it('learns custom post-meal pee delay from historical meal-to-pee sequences', () => {
      const activities: Activity[] = [];
      // 5 consecutive days of meals with post-meal pees occurring at ~25 min
      for (let d = 0; d < 5; d++) {
        activities.push({ id: `food-${d}`, puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(10 + d, 12, 0), loggedBy: 'Matthieu' });
        activities.push({ id: `pee-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10 + d, 12, 25), loggedBy: 'Matthieu' });
      }

      const learned = calculateLearnedPostMealDelayMinutes(activities, 'pee', 20);
      expect(learned.isLearned).toBe(true);
      expect(learned.sampleCount).toBe(5);
      expect(learned.delayMins).toBe(25);
    });

    it('falls back to age baseline when fewer than 3 post-meal sequences exist', () => {
      const activities: Activity[] = [
        { id: 'f-1', puppyId: 'pup-1', type: 'food', timestamp: makeParisIso(10, 12, 0), loggedBy: 'Matthieu' },
        { id: 'p-1', puppyId: 'pup-1', type: 'pee', timestamp: makeParisIso(10, 12, 25), loggedBy: 'Matthieu' },
      ];

      const learned = calculateLearnedPostMealDelayMinutes(activities, 'pee', 20);
      expect(learned.isLearned).toBe(false);
      expect(learned.sampleCount).toBe(1);
      expect(learned.delayMins).toBe(20);
    });

    it('recognizes pre-meal pee break (<= 30m before eating) and maintains daytime baseline', () => {
      const preMealPee = new Date('2026-08-10T11:45:00Z'); // 15m before meal
      const meal = new Date('2026-08-10T12:00:00Z');
      const now = new Date('2026-08-10T12:15:00Z'); // 15m after meal

      const activities: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: preMealPee.toISOString(), loggedBy: 'Matthieu' },
        { id: '2', puppyId: 'pup-1', type: 'food', timestamp: meal.toISOString(), loggedBy: 'Matthieu' },
      ];

      const pred = predictNextPee(activities, mockProfile, now, { timeZone: 'UTC' });
      expect(pred.mode).toBe('daytime_baseline');
      expect(pred.reason).toMatch(/Learned average|bladder interval/);

      // 25 min before the meal is still a pre-meal pee: 11:35 + 4 h standard interval
      const twentyFiveMinutesBefore = predictNextPee(
        newestFirst([act('pee', '2026-08-10T11:35:00Z'), act('food', '2026-08-10T12:00:00Z')]),
        mockProfile,
        new Date('2026-08-10T12:10:00Z'),
        { timeZone: 'UTC' }
      );
      expect(twentyFiveMinutesBefore.mode).toBe('daytime_baseline');
      expect(twentyFiveMinutesBefore.nextExpectedAt!.toISOString()).toBe('2026-08-10T15:35:00.000Z');
    });

    it('triggers post-meal pee override when pee was NOT recent (> 30m before eating)', () => {
      const pastPee = new Date('2026-08-10T10:30:00Z'); // 90m before meal
      const meal = new Date('2026-08-10T12:00:00Z');
      const now = new Date('2026-08-10T12:15:00Z'); // 15m after meal

      const activities: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: pastPee.toISOString(), loggedBy: 'Matthieu' },
        { id: '2', puppyId: 'pup-1', type: 'food', timestamp: meal.toISOString(), loggedBy: 'Matthieu' },
      ];

      const pred = predictNextPee(activities, mockProfile, now, { timeZone: 'UTC' });
      expect(pred.mode).toBe('post_meal_override');
      expect(pred.reason).toContain('Post-meal potty break');
    });

    it('overrides night sleep mode when last poop is diarrhea during night hours', () => {
      const nightTime = new Date('2026-08-10T02:00:00Z'); // 2:00 AM (night)
      const recentDiarrhea = new Date('2026-08-10T01:30:00Z'); // 30m ago

      const activities: Activity[] = [
        {
          id: 'poop-diarrhea-night',
          puppyId: 'pup-1',
          type: 'poop',
          timestamp: recentDiarrhea.toISOString(),
          stoolConsistency: 'diarrhea',
          loggedBy: 'Matthieu',
        },
      ];

      const pred = predictNextPoop(activities, mockProfile, nightTime, { timeZone: 'UTC' });
      // Should NOT be 'night_sleep'
      expect(pred.mode).toBe('daytime_baseline');
      expect(pred.reason).toContain('Digestive alert');
      expect(pred.nextExpectedAt).toBeDefined();
      // Should be 60m after the diarrhea stool (02:30 UTC)
      expect(pred.nextExpectedAt?.toISOString()).toBe(new Date(recentDiarrhea.getTime() + 60 * 60 * 1000).toISOString());
    });
  });

  // 6. Age-Graduated Gastrocolic Maturation Tests
  describe('Age-Graduated Gastrocolic Maturation Model', () => {
    it('always enables post-meal override for young puppies under 3.5 months (< 14 weeks)', () => {
      // 2 months old
      expect(shouldApplyPostMealOverride(2.0, { isLearned: false, postMealRatio: 0 })).toBe(true);
      expect(shouldApplyPostMealOverride(3.0, { isLearned: true, postMealRatio: 0.15 })).toBe(true);
    });

    it('requires at least 40% post-meal potty ratio for transition puppies (3.5 to 5 months)', () => {
      // 4 months old
      expect(shouldApplyPostMealOverride(4.0, { isLearned: true, postMealRatio: 0.45 })).toBe(true);
      expect(shouldApplyPostMealOverride(4.0, { isLearned: true, postMealRatio: 0.40 })).toBe(true);
      expect(shouldApplyPostMealOverride(4.0, { isLearned: true, postMealRatio: 0.35 })).toBe(false);
      expect(shouldApplyPostMealOverride(4.0, { isLearned: true, postMealRatio: 0.20 })).toBe(false);
      // If unlearned (< 3 samples), give benefit of doubt during transition
      expect(shouldApplyPostMealOverride(4.0, { isLearned: false, postMealRatio: 0 })).toBe(true);
    });

    it('assumes voluntary cortical control for adolescent/adult dogs (>= 5 months)', () => {
      // 5.5 months old (like Balma at 20.5 weeks)
      expect(shouldApplyPostMealOverride(5.5, { isLearned: true, postMealRatio: 0.24 })).toBe(false);
      expect(shouldApplyPostMealOverride(5.5, { isLearned: false, postMealRatio: 0 })).toBe(false);
      // Only true if statistically proven habit (>= 50%); 45% is enough below 5 months but not here
      expect(shouldApplyPostMealOverride(5.5, { isLearned: true, postMealRatio: 0.45 })).toBe(false);
      expect(shouldApplyPostMealOverride(5.5, { isLearned: true, postMealRatio: 0.50 })).toBe(true);
      expect(shouldApplyPostMealOverride(5.5, { isLearned: true, postMealRatio: 0.60 })).toBe(true);
    });

    it('calculates accurate postMealRatio in calculateLearnedPostMealDelayMinutes', () => {
      const activities: Activity[] = [
        // Meal 1 followed by pee in 15m
        { id: '1', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-19T07:00:00Z', loggedBy: 'Matthieu' },
        { id: '2', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-19T07:15:00Z', loggedBy: 'Matthieu' },
        // Meal 2 NOT followed by pee for 3 hours
        { id: '3', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-19T11:00:00Z', loggedBy: 'Matthieu' },
        { id: '4', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-19T14:00:00Z', loggedBy: 'Matthieu' },
      ];

      const result = calculateLearnedPostMealDelayMinutes(activities, 'pee', 20);
      expect(result.postMealRatio).toBe(0.5); // 1 out of 2 meals within window
    });

    it('prevents false post-meal pee alarms for a 4.8-month-old puppy whose learned post-meal ratio is below 40% (Balma scenario)', () => {
      const adolescentProfile: PuppyProfile = {
        ...mockProfile,
        birthDate: '2026-03-27', // 4.8 months old on 2026-08-19
      };

      const now = new Date('2026-08-19T08:15:00+02:00'); // 15 mins after breakfast
      // Dataset with 4 meals where potty consistently happens 2-3 hours later (ratio < 40%)
      const activities: Activity[] = [
        { id: 'p1', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-18T07:15:00+02:00', loggedBy: 'Matthieu' },
        { id: 'f1', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-18T08:00:00+02:00', loggedBy: 'Matthieu' },
        { id: 'p2', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-18T11:30:00+02:00', loggedBy: 'Matthieu' },

        { id: 'f2', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-18T13:00:00+02:00', loggedBy: 'Matthieu' },
        { id: 'p3', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-18T16:30:00+02:00', loggedBy: 'Matthieu' },

        { id: 'f3', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-18T19:30:00+02:00', loggedBy: 'Matthieu' },
        { id: 'p4', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-18T22:30:00+02:00', loggedBy: 'Matthieu' },

        // Today morning (pee was at 06:00 AM, 2 hours before 08:00 AM breakfast)
        { id: 'p5', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-19T06:00:00+02:00', loggedBy: 'Matthieu' },
        { id: 'f4', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-19T08:00:00+02:00', loggedBy: 'Matthieu' },
      ];

      const pred = predictNextPee(activities, adolescentProfile, now, { timeZone: 'Europe/Paris' });
      // Should NOT force post_meal_override (~20m)
      expect(pred.mode).toBe('daytime_baseline');
      expect(pred.reason).toMatch(/Learned average|bladder interval/);
      // 06:00 pee + learned 5h
      expect(at(pred.nextExpectedAt!)).toBe('2026-08-19 11:00');
    });

    it('triggers post-meal pee override for an 8-week-old young puppy after eating', () => {
      const youngPuppyProfile: PuppyProfile = {
        ...mockProfile,
        birthDate: '2026-06-24', // 8 weeks old on 2026-08-19
      };

      const now = new Date('2026-08-19T08:10:00+02:00'); // 10 mins after eating
      const activities: Activity[] = [
        { id: 'p1', puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-19T07:00:00+02:00', loggedBy: 'Matthieu' },
        { id: 'f1', puppyId: 'pup-1', type: 'food', timestamp: '2026-08-19T08:00:00+02:00', loggedBy: 'Matthieu' },
      ];

      const pred = predictNextPee(activities, youngPuppyProfile, now, { timeZone: 'Europe/Paris' });
      expect(pred.mode).toBe('post_meal_override');
      expect(pred.reason).toContain('Post-meal potty break');
    });
  });

  // 6. Morning Wake-Up Potty Predictions (Overnight Sleep Transition)
  describe('Morning Wake-Up Potty Predictions', () => {
    it('predicts the morning wake-up poop (07:34 wake-up pee + 30 min) instead of the middle-of-night standard time when the last poop was the previous evening (Screenshot bug fix)', () => {
      // The last poop is yesterday evening at 17:38 PM (the 19:35 one is removed), and the wake-up pee is at 07:34 AM today
      const dataset = newestFirst([
        ...generateRealisticMultiDayDataset().filter((activity) => activity.id !== 'po2-6'),
        act('poop', '2026-08-07T17:38:00+02:00'),
        act('pee', '2026-08-08T07:34:00+02:00'),
      ]);

      const now = new Date('2026-08-08T07:34:00+02:00');
      const predictions = calculatePredictions(dataset, mockProfile, now, 'Europe/Paris');

      // 17:38 + learned 11h50 lands in the middle of the night...
      expect(at(predictions.standardPoopExpectedAt!)).toBe('2026-08-08 05:28');
      // ...so the prediction is the morning outing instead (learned 30 min pee → poop offset)
      expect(predictions.nextPoopExpectedAt).not.toBeNull();
      expect(at(predictions.nextPoopExpectedAt!)).toBe('2026-08-08 08:04');
      expect(predictions.poopMode).toBe('daytime_baseline');
      expect(predictions.poopUrgency).toBe('soon');
      expect(predictions.poopReason).toBe('Morning outing (~08:04)');
    });

    it('predicts morning wake-up pee (~07:00 AM) instead of middle-of-night (02:00 AM) before first pee is logged today', () => {
      const dataset = generateRealisticMultiDayDataset();
      // Last pee was bedtime 22:30 PM on Aug 7
      const now = new Date('2026-08-08T07:15:00+02:00'); // Morning Aug 8, no pees logged yet today
      const predictions = calculatePredictions(dataset, mockProfile, now, 'Europe/Paris');

      // Pee prediction should target morning wakeup (07:00 AM), NOT 02:00/03:30 AM
      expect(at(predictions.nextPeeExpectedAt!)).toBe('2026-08-08 07:00');
      expect(predictions.peeMode).toBe('daytime_baseline');
      expect(predictions.peeUrgency).toBe('overdue');
      expect(predictions.peeReason).toContain('Morning outing');
    });

    // Newest first, as production feeds them. The wake-up pee is 07:00: the 04:30 night potty is before 05:00,
    // and the 02:30 one belongs to the previous logical day (which ends at 04:00).
    const morningPees = [
      act('pee', '2026-08-07T10:00:00+02:00'),
      act('pee', '2026-08-07T07:00:00+02:00'),
      act('pee', '2026-08-07T04:30:00+02:00'),
      act('pee', '2026-08-07T02:30:00+02:00'),
      act('pee', '2026-08-06T22:00:00+02:00'),
      act('poop', '2026-08-06T19:30:00+02:00'),
      act('food', '2026-08-06T19:00:00+02:00', { quantityGrams: 80 }),
    ];

    it('anchors the morning poop and breakfast on the wake-up pee, not the latest pee or a night potty (R2)', () => {
      const predictions = calculatePredictions(morningPees, BALMA, new Date('2026-08-07T10:05:00+02:00'), 'Europe/Paris');

      expect(at(predictions.nextPoopExpectedAt!)).toBe('2026-08-07 07:10');
      expect(predictions.poopMode).toBe('daytime_baseline');
      expect(predictions.poopReason).toBe('Morning outing (~07:10)');
      expect(predictions.poopUrgency).toBe('overdue');
      expect(at(predictions.nextFoodExpectedAt!)).toBe('2026-08-07 07:30');
      expect(predictions.foodMode).toBe('daytime_schedule');
      expect(predictions.foodReason).toBe('Breakfast (~07:30, Meal 1 of 3)');
      expect(predictions.foodUrgency).toBe('overdue');
    });

    it('returns the same predictions whatever the order of the activity list', () => {
      const generated = generateRealisticMultiDayDataset();
      const scenarios: Array<[Activity[], string]> = [
        [morningPees, '2026-08-07T10:05:00+02:00'],
        ...['2026-08-07T07:20:00+02:00', '2026-08-07T13:00:00+02:00', '2026-08-07T23:30:00+02:00', '2026-08-08T07:40:00+02:00'].map(
          (referenceIso): [Activity[], string] => [generated, referenceIso]
        ),
        // Two pees before the first poop and meal of a new day
        [[act('pee', '2026-08-08T09:00:00+02:00'), act('pee', '2026-08-08T07:00:00+02:00'), ...generated], '2026-08-08T09:10:00+02:00'],
        // Two pees inside one post-meal window, then a new meal
        [
          [
            act('food', '2026-08-08T12:00:00+02:00', { quantityGrams: 80 }),
            act('pee', '2026-08-08T07:40:00+02:00'),
            act('pee', '2026-08-08T07:10:00+02:00'),
            act('food', '2026-08-08T07:00:00+02:00', { quantityGrams: 80 }),
            ...generated,
          ],
          '2026-08-08T12:05:00+02:00',
        ],
      ];

      for (const [activities, referenceIso] of scenarios) {
        const referenceTime = new Date(referenceIso);
        const reversed = calculatePredictions([...activities].reverse(), BALMA, referenceTime, 'Europe/Paris');
        expect(reversed).toEqual(calculatePredictions(activities, BALMA, referenceTime, 'Europe/Paris'));
      }
    });
  });
});

