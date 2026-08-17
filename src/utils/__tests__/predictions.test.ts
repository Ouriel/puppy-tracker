import { describe, it, expect } from 'vitest';
import {
  getPuppyAge,
  calculateVetFoodGramGoal,
  detectSleepSchedule,
  calculateLearnedIntervalMinutes,
  calculateLearnedPostMealDelayMinutes,
  calculateMorningSequenceOffsets,
  predictNextPee,
  predictNextPoop,
  predictNextFood,
  calculatePredictions,
} from '../predictions';
import type { Activity, PuppyProfile } from '../../types';

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
   * Helper to generate a realistic 7-day multi-day activity dataset (modeled after real puppy logs)
   */
  function generateRealisticMultiDayDataset(): Activity[] {
    const activities: Activity[] = [];
    const baseDate = new Date(2026, 7, 1); // Aug 1 2026

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const day = new Date(baseDate);
      day.setDate(day.getDate() + dayOffset);

      // Breakfast 07:00 AM
      const bfast = new Date(day); bfast.setHours(7, 0, 0, 0);
      activities.push({ id: `f1-${dayOffset}`, puppyId: 'pup-1', type: 'food', timestamp: bfast.toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' });

      // First-morning pee 07:15 AM
      const mPee = new Date(day); mPee.setHours(7, 15, 0, 0);
      activities.push({ id: `p1-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: mPee.toISOString(), loggedBy: 'Matthieu' });

      // Morning post-breakfast poop 07:45 AM
      const mPoop = new Date(day); mPoop.setHours(7, 45, 0, 0);
      activities.push({ id: `po1-${dayOffset}`, puppyId: 'pup-1', type: 'poop', timestamp: mPoop.toISOString(), loggedBy: 'Matthieu' });

      // Mid-morning pee 10:00 AM
      const mmPee = new Date(day); mmPee.setHours(10, 0, 0, 0);
      activities.push({ id: `p2-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: mmPee.toISOString(), loggedBy: 'Matthieu' });

      // Lunch 12:00 PM
      const lunch = new Date(day); lunch.setHours(12, 0, 0, 0);
      activities.push({ id: `f2-${dayOffset}`, puppyId: 'pup-1', type: 'food', timestamp: lunch.toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' });

      // Post-lunch pee 12:20 PM
      const lPee = new Date(day); lPee.setHours(12, 20, 0, 0);
      activities.push({ id: `p3-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: lPee.toISOString(), loggedBy: 'Matthieu' });

      // Afternoon pee 15:30 PM
      const aPee = new Date(day); aPee.setHours(15, 30, 0, 0);
      activities.push({ id: `p4-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: aPee.toISOString(), loggedBy: 'Matthieu' });

      // Dinner 19:00 PM
      const dinner = new Date(day); dinner.setHours(19, 0, 0, 0);
      activities.push({ id: `f3-${dayOffset}`, puppyId: 'pup-1', type: 'food', timestamp: dinner.toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' });

      // Post-dinner poop 19:35 PM
      const ePoop = new Date(day); ePoop.setHours(19, 35, 0, 0);
      activities.push({ id: `po2-${dayOffset}`, puppyId: 'pup-1', type: 'poop', timestamp: ePoop.toISOString(), loggedBy: 'Matthieu' });

      // Bedtime pee 22:30 PM
      const bedPee = new Date(day); bedPee.setHours(22, 30, 0, 0);
      activities.push({ id: `p5-${dayOffset}`, puppyId: 'pup-1', type: 'pee', timestamp: bedPee.toISOString(), loggedBy: 'Matthieu' });
    }

    return activities;
  }

  // 1. getPuppyAge
  describe('getPuppyAge', () => {
    it('calculates puppy age in weeks for puppies under 16 weeks', () => {
      const ageInfo = getPuppyAge('2026-06-01');
      expect(ageInfo.weeks).toBeGreaterThan(0);
      expect(ageInfo.text).toContain('weeks old');
    });

    it('calculates puppy age in months and weeks for puppies over 16 weeks', () => {
      const ageInfo = getPuppyAge('2026-01-01');
      expect(ageInfo.weeks).toBeGreaterThanOrEqual(16);
      expect(ageInfo.text).toContain('mo');
      expect(ageInfo.text).toContain('wk old');
    });

    it('handles future birth dates safely by returning 0 weeks', () => {
      const ageInfo = getPuppyAge('2099-01-01');
      expect(ageInfo.weeks).toBe(0);
    });
  });

  // 2. calculateVetFoodGramGoal
  describe('calculateVetFoodGramGoal', () => {
    it('calculates RER and MER correctly for young growth stage (< 4 months)', () => {
      const goal = calculateVetFoodGramGoal(5.0, 3);
      expect(goal).toBeGreaterThan(160);
      expect(goal).toBeLessThan(210);
    });

    it('calculates MER correctly for medium growth stage (4-12 months)', () => {
      const goal = calculateVetFoodGramGoal(8.0, 5);
      expect(goal).toBeGreaterThan(150);
      expect(goal).toBeLessThan(200);
    });

    it('calculates MER correctly for adult stage (> 12 months)', () => {
      const goal = calculateVetFoodGramGoal(13.0, 14);
      expect(goal).toBeGreaterThan(180);
      expect(goal).toBeLessThan(220);
    });

    it('guards against zero, negative, or NaN weight/age inputs', () => {
      expect(calculateVetFoodGramGoal(0, 4)).toBe(240);
      expect(calculateVetFoodGramGoal(-5, 4)).toBe(240);
      expect(calculateVetFoodGramGoal(8, NaN)).toBeGreaterThan(0);
    });
  });

  // 3. detectSleepSchedule
  describe('detectSleepSchedule', () => {
    it('detects typical night sleep schedule from realistic activity logs', () => {
      const dataset = generateRealisticMultiDayDataset();
      const schedule = detectSleepSchedule(dataset, 'Europe/Paris');
      expect(schedule.bedtimeHour).toBeGreaterThanOrEqual(21);
      expect(schedule.bedtimeHour).toBeLessThanOrEqual(23);
      expect(schedule.wakeupHour).toBeGreaterThanOrEqual(6);
      expect(schedule.wakeupHour).toBeLessThanOrEqual(9);
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
    it('calculates median daytime pee interval excluding first-morning pees and multi-day lapses', () => {
      const dataset = generateRealisticMultiDayDataset();
      const schedule = detectSleepSchedule(dataset, 'Europe/Paris');
      const result = calculateLearnedIntervalMinutes(dataset, 'pee', 180, schedule, 'Europe/Paris');

      expect(result.isLearned).toBe(true);
      expect(result.sampleCount).toBeGreaterThan(5);
      expect(result.intervalMins).toBeGreaterThanOrEqual(30);
      expect(result.intervalMins).toBeLessThanOrEqual(360);
    });

    it('falls back to default interval when insufficient daytime samples exist', () => {
      const result = calculateLearnedIntervalMinutes([], 'pee', 120);
      expect(result.isLearned).toBe(false);
      expect(result.intervalMins).toBe(120);
      expect(result.sampleCount).toBe(0);
    });
  });

  // 5. calculatePredictions — Detailed Case Testing
  describe('calculatePredictions', () => {
    const dataset = generateRealisticMultiDayDataset();

    // 5.1 Pee Predictions
    describe('Pee Predictions', () => {
      it('predicts daytime baseline pee interval when no recent food trigger is active', () => {
        const referenceTime = new Date(2026, 7, 7, 14, 0); // Aug 7, 14:00 PM
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.peeMode).toBe('daytime_baseline');
        expect(predictions.nextPeeExpectedAt).not.toBeNull();
        expect(predictions.peeReason).toContain('Learned average');
      });

      it('triggers immediate post-meal pee override when food is logged after last pee (within 60 minutes)', () => {
        const referenceTime = new Date(2026, 7, 7, 12, 10); // 10 min after lunch at 12:00
        // Remove 12:20 PM pee from day 6 so food is strictly after last pee
        const customDataset = dataset.filter((act) => act.id !== 'p3-6');

        const predictions = calculatePredictions(customDataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.peeMode).toBe('post_meal_override');
        expect(predictions.peeReason).toContain('fed recently');
      });

      it('expires post-meal pee trigger after 60 minutes and reverts to daytime baseline', () => {
        const referenceTime = new Date(2026, 7, 7, 13, 15); // 75 min after lunch at 12:00
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.peeMode).toBe('daytime_baseline');
        expect(predictions.peeReason).not.toContain('post-meal');
      });

      it('enters night mode and predicts morning wakeup during sleep hours (e.g. 02:00 AM)', () => {
        const referenceTime = new Date(2026, 7, 8, 2, 0); // 02:00 AM night
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.peeMode).toBe('night_sleep');
        expect(predictions.peeReason).toContain('Night mode');
        expect(predictions.peeUrgency).toBe('safe');
      });

      it('includes mid-night break for young puppies under 2.5 months during night mode', () => {
        const youngProfile: PuppyProfile = { ...mockProfile, birthDate: '2026-07-01' }; // ~5 weeks old
        const nightTime = new Date(2026, 7, 8, 0, 30); // 00:30 AM night

        const youngDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(2026, 7, 7, 23, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(youngDataset, youngProfile, nightTime, 'Europe/Paris');
        expect(predictions.peeMode).toBe('night_sleep');
        expect(predictions.peeReason).toContain('Young puppy mid-night potty break');
      });

      it('enters night mode when approaching bedtime (within 1 hour of bedtime)', () => {
        const referenceTime = new Date(2026, 7, 7, 21, 15); // 21:15 PM (bedtime is 22:00)
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.peeMode).toBe('night_sleep');
      });

      it('disables post-meal pee trigger for older puppies (age >= 8 months)', () => {
        const olderProfile: PuppyProfile = { ...mockProfile, birthDate: '2025-10-01' }; // ~10 months old
        const referenceTime = new Date(2026, 7, 7, 12, 10);
        const activities: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(2026, 7, 7, 10, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 12, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(activities, olderProfile, referenceTime, 'Europe/Paris');
        expect(predictions.peeMode).toBe('daytime_baseline');
      });
    });

    // 5.2 Poop Predictions
    describe('Poop Predictions', () => {
      it('predicts gastrocolic post-meal poop break when food is logged after last poop (within 90 minutes)', () => {
        const referenceTime = new Date(2026, 7, 7, 12, 20); // 12:20 PM
        const simplePostMealDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: new Date(2026, 7, 7, 8, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 12, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(simplePostMealDataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.poopMode).toBe('post_meal_override');
        expect(predictions.poopReason).toContain('Poop break expected');
      });

      it('predicts daytime baseline poop based on learned interval when puppy ate today', () => {
        const referenceTime = new Date(2026, 7, 7, 14, 0); // 14:00 PM
        const simpleFeedingDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: new Date(2026, 7, 6, 19, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 8, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '3', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 12, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(simpleFeedingDataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.poopMode).toBe('daytime_baseline');
        expect(predictions.nextPoopExpectedAt).not.toBeNull();
      });

      it('handles recent constipation and bowel clearance gracefully with extended recovery phase and safe status', () => {
        const referenceTime = new Date(2026, 7, 8, 10, 0); // Aug 8, 10:00 AM daytime (12.8h after hard poop at 21:11)

        const constipationDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: new Date(2026, 7, 7, 21, 11).toISOString(), stoolConsistency: 'hard', loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 8, 8, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(constipationDataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.poopUrgency).toBe('safe');
        expect(predictions.poopReason).toContain('recovering from recent hard stool');
      });

      it('enters night sleep mode for poop during overnight hours', () => {
        const referenceTime = new Date(2026, 7, 8, 1, 30); // 01:30 AM night
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.poopMode).toBe('night_sleep');
        expect(predictions.poopReason).toMatch(/morning outing|post-breakfast/i);
      });

      it('disables post-meal poop trigger for older puppies (age >= 8 months)', () => {
        const olderProfile: PuppyProfile = { ...mockProfile, birthDate: '2025-10-01' }; // ~10 months old
        const referenceTime = new Date(2026, 7, 7, 12, 20);
        const activities: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: new Date(2026, 7, 7, 8, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 12, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(activities, olderProfile, referenceTime, 'Europe/Paris');
        expect(predictions.poopMode).toBe('daytime_baseline');
      });

      it('calculates realistic digestive transit interval (~6 hours after meal)', () => {
        const youngProfile: PuppyProfile = { ...mockProfile, birthDate: '2026-06-01' };
        const olderProfile: PuppyProfile = { ...mockProfile, birthDate: '2026-01-01' };

        const referenceTime = new Date(2026, 7, 7, 14, 0);

        const activities: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: new Date(2026, 7, 6, 19, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 12, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predYoung = calculatePredictions(activities, youngProfile, referenceTime, 'Europe/Paris');
        const predOlder = calculatePredictions(activities, olderProfile, referenceTime, 'Europe/Paris');

        // Meal at 12:00 + 6h = 18:00
        expect(predYoung.nextPoopExpectedAt?.getHours()).toBe(18);
        expect(predOlder.nextPoopExpectedAt?.getHours()).toBe(18);
      });
    });

    // 5.3 Food Predictions
    describe('Food Predictions', () => {
      it('calculates vet recommended target meals per day based on age (4 for <3mo, 3 for 3-6mo, 2 for >6mo)', () => {
        const pup2mo: PuppyProfile = { ...mockProfile, birthDate: '2026-06-01', targetMealsPerDay: 0 };
        const pup4mo: PuppyProfile = { ...mockProfile, birthDate: '2026-04-01', targetMealsPerDay: 0 };
        const pup8mo: PuppyProfile = { ...mockProfile, birthDate: '2025-12-01', targetMealsPerDay: 0 };

        const refTime = new Date(2026, 7, 7, 10, 0);

        const p2 = calculatePredictions([], pup2mo, refTime, 'Europe/Paris');
        const p4 = calculatePredictions([], pup4mo, refTime, 'Europe/Paris');
        const p8 = calculatePredictions([], pup8mo, refTime, 'Europe/Paris');

        expect(p2.foodReason).toContain('Meal 1 of 4');
        expect(p4.foodReason).toContain('Meal 1 of 3');
        expect(p8.foodReason).toContain('Meal 1 of 2');
      });

      it('predicts morning breakfast scheduled at wakeup:30 AM when no meals logged today', () => {
        const referenceTime = new Date(2026, 7, 7, 8, 15); // 08:15 AM (after wakeup 07:00 / 07:30 breakfast target)
        const noMealsToday = dataset.filter((act) => !act.id.startsWith('f') || !act.id.endsWith('-6'));

        const predictions = calculatePredictions(noMealsToday, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.foodMode).toBe('daytime_schedule');
        expect(predictions.foodReason).toMatch(/breakfast due|Breakfast scheduled|Breakfast overdue/i);
      });

      it('spaces remaining daytime meals evenly when partial meals have been logged today', () => {
        const referenceTime = new Date(2026, 7, 7, 10, 0); // 10:00 AM (1 meal logged so far: breakfast)
        const singleMealToday = dataset.filter((act) => act.id !== 'f2-6' && act.id !== 'f3-6'); // Keep only breakfast on day 6

        const predictions = calculatePredictions(singleMealToday, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.foodMode).toBe('daytime_schedule');
        expect(predictions.foodReason).toContain('Daytime meal schedule');
      });

      it('flags goal reached when daily food gram goal or target meal count is reached', () => {
        const referenceTime = new Date(2026, 7, 7, 19, 30); // 19:30 PM after dinner (3 meals logged, 240g reached)
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.foodMode).toBe('goal_reached');
        expect(predictions.foodUrgency).toBe('safe');
        expect(predictions.foodReason).toContain('goal reached');
      });

      it('enters night sleep mode for food during overnight hours', () => {
        const referenceTime = new Date(2026, 7, 8, 2, 0); // 02:00 AM
        const predictions = calculatePredictions(dataset, mockProfile, referenceTime, 'Europe/Paris');

        expect(predictions.foodMode).toBe('night_sleep');
        expect(predictions.foodUrgency).toBe('safe');
      });
    });

    // 5.4 Cross-Timezone Robustness
    describe('Cross-Timezone Robustness', () => {
      it('evaluates identical local predictions regardless of IANA timezone parameter', () => {
        // 14:00 UTC = 16:00 CEST (France, Day) = 10:00 EDT (New York, Day) = 04:00 HST (Honolulu, Night)
        const refUtc = new Date('2026-08-09T14:00:00.000Z');

        const predictionsParis = calculatePredictions(dataset, mockProfile, refUtc, 'Europe/Paris'); // 16:00 CEST (Day)
        const predictionsNY = calculatePredictions(dataset, mockProfile, refUtc, 'America/New_York'); // 10:00 EDT (Day)
        const predictionsHonolulu = calculatePredictions(dataset, mockProfile, refUtc, 'Pacific/Honolulu'); // 04:00 HST (Night)

        expect(predictionsParis.peeMode).toBe('daytime_baseline');
        expect(predictionsNY.peeMode).toBe('daytime_baseline');
        expect(predictionsHonolulu.peeMode).toBe('night_sleep');
      });
    });
  });

  // 6. Regression Bug Fixes (Bugs 1 - 5)
  describe('Regression Bug Fixes', () => {
    it('Bug 1: early morning potty before estimated wakeup overrides Night Mode', () => {
      // Reference time: 07:15 AM today. Wakeup schedule is 07:37 AM.
      // A pee log occurred at 07:05 AM today.
      const refTime = new Date(2026, 7, 13, 7, 15);
      const activities: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(2026, 7, 13, 7, 5).toISOString(), loggedBy: 'Matthieu' },
      ];

      const predictions = calculatePredictions(
        activities,
        mockProfile,
        refTime,
        'Europe/Paris',
        { bedtimeHour: 22, wakeupHour: 7.61, bedtimeStr: '22:00', wakeupStr: '07:37' }
      );

      expect(predictions.peeMode).toBe('daytime_baseline');
      expect(predictions.peeReason).not.toContain('Night mode');
    });

    it('Bug 2: late evening potty (e.g. 21:22 PM) predicts wakeup TOMORROW morning (+10h) and urgency is safe', () => {
      // Reference time: 21:22 PM today. Bedtime is 21:30 PM. Wakeup is 07:37 AM.
      const refTime = new Date(2026, 7, 13, 21, 22);
      const activities: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(2026, 7, 13, 21, 18).toISOString(), loggedBy: 'Matthieu' },
      ];

      const predictions = calculatePredictions(
        activities,
        mockProfile,
        refTime,
        'Europe/Paris',
        { bedtimeHour: 21.5, wakeupHour: 7.61, bedtimeStr: '21:30', wakeupStr: '07:37' }
      );

      expect(predictions.peeUrgency).toBe('safe');
      expect(predictions.nextPeeExpectedAt).not.toBeNull();
      // Target wakeup must be tomorrow at 07:37 AM (> refTime)
      expect(predictions.nextPeeExpectedAt!.getTime()).toBeGreaterThan(refTime.getTime());
      const diffMins = Math.round((predictions.nextPeeExpectedAt!.getTime() - refTime.getTime()) / 60000);
      expect(diffMins).toBeGreaterThan(500); // ~615 mins away tomorrow morning
    });

    it('Bug 4: feeding 3 small 40g meals (totaling 120g / 240g goal) does NOT trigger goal_reached', () => {
      const refTime = new Date(2026, 7, 13, 15, 0); // 15:00 PM afternoon
      const smallMeals: Activity[] = [
        { id: '1', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 13, 7, 0).toISOString(), quantityGrams: 40, loggedBy: 'Matthieu' },
        { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 13, 11, 0).toISOString(), quantityGrams: 40, loggedBy: 'Matthieu' },
        { id: '3', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 13, 14, 0).toISOString(), quantityGrams: 40, loggedBy: 'Matthieu' },
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
    });

    it('Bug 5: detectSleepSchedule adapts rapidly to shifted bedtime in recent days', () => {
      const activities: Activity[] = [];
      // Last 5 days: late bedtime pees at 23:00 PM
      for (let d = 0; d < 5; d++) {
        const date = new Date(2026, 7, 10 + d, 23, 0);
        activities.push({ id: `p-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: date.toISOString(), loggedBy: 'Matthieu' });
        const wakeDate = new Date(2026, 7, 10 + d, 7, 0);
        activities.push({ id: `w-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: wakeDate.toISOString(), loggedBy: 'Matthieu' });
      }

      const schedule = detectSleepSchedule(activities, 'Europe/Paris');
      expect(schedule.bedtimeHour).toBeGreaterThanOrEqual(22);
    });
  });

  // 7. Decoupled Predictors & Empirical Morning Sequence Tests
  describe('Decoupled Predictors & Empirical Morning Sequence', () => {
    it('predictNextPee executes independently and returns valid SinglePredictionResult', () => {
      const dataset = generateRealisticMultiDayDataset();
      const refTime = new Date(2026, 7, 7, 14, 0);
      const peeResult = predictNextPee(dataset, mockProfile, refTime, { timeZone: 'Europe/Paris' });

      expect(peeResult.mode).toBe('daytime_baseline');
      expect(peeResult.nextExpectedAt).not.toBeNull();
      expect(peeResult.deltaMins).toBeGreaterThan(0);
      expect(peeResult.urgency).toBe('safe');
    });

    it('predictNextPoop executes independently and returns valid SinglePredictionResult', () => {
      const dataset = generateRealisticMultiDayDataset();
      const refTime = new Date(2026, 7, 7, 14, 0);
      const poopResult = predictNextPoop(dataset, mockProfile, refTime, { timeZone: 'Europe/Paris' });

      expect(poopResult.mode).toBe('daytime_baseline');
      expect(poopResult.nextExpectedAt).not.toBeNull();
      expect(poopResult.deltaMins).toBeGreaterThan(0);
    });

    it('predictNextFood executes independently and returns valid FoodPredictionResult with portionGrams', () => {
      const dataset = generateRealisticMultiDayDataset();
      const refTime = new Date(2026, 7, 7, 14, 0);
      const foodResult = predictNextFood(dataset, mockProfile, refTime, { timeZone: 'Europe/Paris' });

      expect(foodResult.mode).toBe('daytime_schedule');
      expect(foodResult.portionGrams).toBeGreaterThan(0);
    });

    it('calculateMorningSequenceOffsets calculates empirical offsets from historical morning logs', () => {
      const activities: Activity[] = [];
      // 5 days of data: Pee at 07:00, Poop at 07:07 (+7m), Breakfast at 07:18 (+18m)
      for (let d = 0; d < 5; d++) {
        const date = new Date(2026, 7, 10 + d, 7, 0);
        activities.push({ id: `p-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: date.toISOString(), loggedBy: 'Matthieu' });
        const poopDate = new Date(2026, 7, 10 + d, 7, 7);
        activities.push({ id: `po-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: poopDate.toISOString(), loggedBy: 'Matthieu' });
        const foodDate = new Date(2026, 7, 10 + d, 7, 18);
        activities.push({ id: `f-${d}`, puppyId: 'pup-1', type: 'food', timestamp: foodDate.toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' });
      }

      const offsets = calculateMorningSequenceOffsets(activities, 'Europe/Paris');
      expect(offsets.morningPoopOffsetMins).toBe(7);
      expect(offsets.morningFoodOffsetMins).toBe(18);
    });

    it('adapts morning sequence ordering: nextPee <= nextPoop <= nextFood during night mode', () => {
      const activities: Activity[] = [];
      for (let d = 0; d < 5; d++) {
        const pDate = new Date(2026, 7, 10 + d, 7, 20);
        activities.push({ id: `p-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: pDate.toISOString(), loggedBy: 'Matthieu' });
        const poDate = new Date(2026, 7, 10 + d, 7, 28);
        activities.push({ id: `po-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: poDate.toISOString(), loggedBy: 'Matthieu' });
        const fDate = new Date(2026, 7, 10 + d, 7, 42);
        activities.push({ id: `f-${d}`, puppyId: 'pup-1', type: 'food', timestamp: fDate.toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' });
      }

      const nightRefTime = new Date(2026, 7, 15, 2, 0); // 02:00 AM
      const predictions = calculatePredictions(activities, mockProfile, nightRefTime, 'Europe/Paris');

      expect(predictions.nextPeeExpectedAt).not.toBeNull();
      expect(predictions.nextPoopExpectedAt).not.toBeNull();
      expect(predictions.nextFoodExpectedAt).not.toBeNull();

      // Ensure morning sequence order
      expect(predictions.nextPeeExpectedAt!.getTime()).toBeLessThanOrEqual(predictions.nextPoopExpectedAt!.getTime());
      expect(predictions.nextPoopExpectedAt!.getTime()).toBeLessThanOrEqual(predictions.nextFoodExpectedAt!.getTime());
    });

    it('factors in pre-bedtime waking retention intervals spanning across midnight (e.g. 21:30 to 00:30)', () => {
      const activities: Activity[] = [];
      // 5 days of data where puppy pees at 21:30 and has a final pre-bedtime outing at 00:30 (3h gap across midnight)
      for (let d = 0; d < 5; d++) {
        const eveningDate = new Date(2026, 7, 10 + d, 21, 30);
        activities.push({ id: `p-eve-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: eveningDate.toISOString(), loggedBy: 'Matthieu' });
        const midnightDate = new Date(2026, 7, 11 + d, 0, 30);
        activities.push({ id: `p-mid-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: midnightDate.toISOString(), loggedBy: 'Matthieu' });
      }

      const sleepSchedule = { bedtimeHour: 1, wakeupHour: 7, bedtimeStr: '01:00', wakeupStr: '07:00' };
      const learned = calculateLearnedIntervalMinutes(activities, 'pee', 120, sleepSchedule, 'Europe/Paris');

      expect(learned.isLearned).toBe(true);
      expect(learned.sampleCount).toBeGreaterThanOrEqual(4);
      expect(learned.intervalMins).toBe(180); // 3 hours (180 mins) exactly
    });

    it('calculates proper meal intervals when bedtime wraps past midnight', () => {
      const activities: Activity[] = [
        { id: 'f-1', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 10, 12, 0).toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' },
        { id: 'f-2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 10, 18, 0).toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' },
      ];

      const refTime = new Date(2026, 7, 10, 18, 15);
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
        const morningDate = new Date(2026, 7, 10 + d, 7, 30);
        activities.push({ id: `po-m-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: morningDate.toISOString(), loggedBy: 'Matthieu' });
        const eveningDate = new Date(2026, 7, 10 + d, 17, 15);
        activities.push({ id: `po-e-${d}`, puppyId: 'pup-1', type: 'poop', timestamp: eveningDate.toISOString(), loggedBy: 'Matthieu' });
      }

      const sleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };
      const learned = calculateLearnedIntervalMinutes(activities, 'poop', 300, sleepSchedule, 'Europe/Paris');

      expect(learned.isLearned).toBe(true);
      expect(learned.sampleCount).toBeGreaterThanOrEqual(4);
      // Learned interval should be ~585 mins (9h45m), NOT compressed to <5h
      expect(learned.intervalMins).toBeGreaterThanOrEqual(580);
      expect(learned.intervalMins).toBeLessThanOrEqual(860);
    });

    it('correctly marks breakfast as overdue during morning hours (e.g. 09:30 AM) when no breakfast is logged', () => {
      const activities: Activity[] = [
        // Yesterday's activities
        { id: 'f-prev', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 9, 19, 0).toISOString(), quantityGrams: 100, loggedBy: 'Matthieu' },
        // Wakeup activity recorded this morning at 07:15 AM
        { id: 'p-today', puppyId: 'pup-1', type: 'pee', timestamp: new Date(2026, 7, 10, 7, 15).toISOString(), loggedBy: 'Matthieu' },
      ];

      // Current time is 09:30 AM on Aug 10, 2026
      const refTime = new Date(2026, 7, 10, 9, 30);
      const sleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };
      const foodPrediction = predictNextFood(activities, mockProfile, refTime, { sleepSchedule, timeZone: 'Europe/Paris' });

      expect(foodPrediction.mode).toBe('daytime_schedule');
      expect(foodPrediction.urgency).toBe('overdue');
      expect(foodPrediction.reason).toContain('Breakfast overdue');
      // Next expected should be this morning (07:xx AM today), NOT tomorrow morning (+21h)
      expect(foodPrediction.nextExpectedAt).not.toBeNull();
      expect(foodPrediction.nextExpectedAt!.getDate()).toBe(10);
      expect(foodPrediction.nextExpectedAt!.getHours()).toBe(7);
      expect((refTime.getTime() - foodPrediction.nextExpectedAt!.getTime()) / 60000).toBeGreaterThan(60);
    });

    it('learns custom post-meal pee delay from historical meal-to-pee sequences', () => {
      const activities: Activity[] = [];
      // 5 consecutive days of meals with post-meal pees occurring at ~25 min
      for (let d = 0; d < 5; d++) {
        const mealDate = new Date(2026, 7, 10 + d, 12, 0);
        const peeDate = new Date(2026, 7, 10 + d, 12, 25);
        activities.push({ id: `food-${d}`, puppyId: 'pup-1', type: 'food', timestamp: mealDate.toISOString(), loggedBy: 'Matthieu' });
        activities.push({ id: `pee-${d}`, puppyId: 'pup-1', type: 'pee', timestamp: peeDate.toISOString(), loggedBy: 'Matthieu' });
      }

      const learned = calculateLearnedPostMealDelayMinutes(activities, 'pee', 20);
      expect(learned.isLearned).toBe(true);
      expect(learned.sampleCount).toBe(5);
      expect(learned.delayMins).toBe(25);
    });

    it('falls back to age baseline when fewer than 3 post-meal sequences exist', () => {
      const activities: Activity[] = [
        { id: 'f-1', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 10, 12, 0).toISOString(), loggedBy: 'Matthieu' },
        { id: 'p-1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(2026, 7, 10, 12, 25).toISOString(), loggedBy: 'Matthieu' },
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
      expect(pred.reason).toContain('Bladder emptied before meal');
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
      expect(pred.reason).toContain('Pup fed recently');
    });
  });
});
