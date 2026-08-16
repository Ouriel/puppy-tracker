import { describe, it, expect } from 'vitest';
import {
  getPuppyAge,
  calculateVetFoodGramGoal,
  detectSleepSchedule,
  calculateLearnedIntervalMinutes,
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
        expect(predictions.poopReason).toContain('Gastrocolic reflex');
      });

      it('predicts feeding-linked poop when puppy ate today but has not pooped yet', () => {
        const referenceTime = new Date(2026, 7, 7, 14, 0); // 14:00 PM
        const simpleFeedingDataset: Activity[] = [
          { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: new Date(2026, 7, 6, 19, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 8, 0).toISOString(), loggedBy: 'Matthieu' },
          { id: '3', puppyId: 'pup-1', type: 'food', timestamp: new Date(2026, 7, 7, 12, 0).toISOString(), loggedBy: 'Matthieu' },
        ];

        const predictions = calculatePredictions(simpleFeedingDataset, mockProfile, referenceTime, 'Europe/Paris');
        expect(predictions.poopReason).toContain('no poop yet');
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
        expect(predictions.poopReason).toContain('post-breakfast');
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
        // 14:00 UTC = 16:00 CEST (France) = 10:00 EDT (New York) = 23:00 JST (Tokyo night)
        const refUtc = new Date('2026-08-09T14:00:00.000Z');

        const predictionsParis = calculatePredictions(dataset, mockProfile, refUtc, 'Europe/Paris'); // 16:00 CEST (Day)
        const predictionsNY = calculatePredictions(dataset, mockProfile, refUtc, 'America/New_York'); // 10:00 EDT (Day)
        const predictionsTokyo = calculatePredictions(dataset, mockProfile, refUtc, 'Asia/Tokyo'); // 23:00 JST (Night)

        expect(predictionsParis.peeMode).toBe('daytime_baseline');
        expect(predictionsNY.peeMode).toBe('daytime_baseline');
        expect(predictionsTokyo.peeMode).toBe('night_sleep');
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
});
