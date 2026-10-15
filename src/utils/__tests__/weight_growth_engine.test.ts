import { describe, it, expect, vi } from 'vitest';
import {
  getWalthamCategory,
  getWalthamGrowthFraction,
  getWalthamGrowthVelocity,
  getUnifiedWeightEntries,
  calculateProjectedAdultWeightRange,
  estimateCurrentWeightFromLastLog,
  getEffectivePuppyWeight,
  scaleGrowthBenchmarks,
} from '../weight';
import { calculatePredictions } from '../predictions';
import type { Activity, PuppyProfile } from '../../types';
import { PISTACHE } from './fixtures';

describe('Canine Weight Prediction & WALTHAM Growth Engine', () => {
  const pistacheBirthDate = PISTACHE.birthDate;

  const pistacheActivities: Activity[] = [
    { id: 'act-1', puppyId: 'pup-pistache', type: 'weight', timestamp: '2026-06-03T10:00:00.000Z', weightKg: 4.075, loggedBy: 'Sam' },
    { id: 'act-2', puppyId: 'pup-pistache', type: 'weight', timestamp: '2026-07-04T12:07:00.000Z', weightKg: 6.0, loggedBy: 'Sam' },
    { id: 'act-3', puppyId: 'pup-pistache', type: 'weight', timestamp: '2026-08-01T12:06:00.000Z', weightKg: 7.8, loggedBy: 'Sam' },
    { id: 'act-4', puppyId: 'pup-pistache', type: 'weight', timestamp: '2026-08-14T20:08:00.000Z', weightKg: 8.3, loggedBy: 'Sam' },
    { id: 'act-5', puppyId: 'pup-pistache', type: 'weight', timestamp: '2026-08-25T15:36:00.000Z', weightKg: 8.9, loggedBy: 'Sam' },
    { id: 'act-6', puppyId: 'pup-pistache', type: 'weight', timestamp: '2026-09-01T16:02:00.000Z', weightKg: 9.5, loggedBy: 'Sam' },
  ];

  // Weigh-ins entered with a deworming: weight events at 12:00 Paris on the dose date, notes = product
  const pistacheVetWeighIns: Activity[] = ([
    ['vet-1', 'Drontal Chiot', '2026-05-31', 4.0],
    ['vet-2', 'Credelio Plus', '2026-07-05', 6.8],
    ['vet-3', 'Credelio Plus', '2026-08-03', 7.8],
    ['vet-4', 'Credelio Plus', '2026-09-03', 9.52],
  ] as const).map(([id, product, date, weightKg]) => ({ id, puppyId: 'pup-pistache', type: 'weight', timestamp: `${date}T10:00:00.000Z`, weightKg, notes: product, loggedBy: 'Sam' }));

  const pistacheProfile: PuppyProfile = {
    id: 'pup-pistache',
    name: 'Pistache',
    breed: 'English Cocker Spaniel / Cocker Anglais',
    birthDate: pistacheBirthDate,
    weightKg: 7.8,
    dailyFoodGramGoal: 240,
    targetMealsPerDay: 3,
    gender: 'female',
  };

  describe('Real Dog Data Regression: Pistache', () => {
    it('projects adult weight within healthy breed range (13.5 - 15.2 kg) from full longitudinal trail', () => {
      const unified = getUnifiedWeightEntries([...pistacheActivities, ...pistacheVetWeighIns]);
      expect(unified).toHaveLength(10);

      const result = calculateProjectedAdultWeightRange(
        pistacheProfile.breed,
        unified,
        pistacheBirthDate,
        pistacheProfile.gender
      );

      expect(result.isTrajectoryBased).toBe(true);
      expect(result.walthamCategory).toBe('III');
      // Pistache's empirical trajectory converges tightly around 14.0 - 14.4 kg
      expect(result.projectedAdultKg).toBeGreaterThanOrEqual(13.5);
      expect(result.projectedAdultKg).toBeLessThanOrEqual(14.8);
      // Min and max bounds encompass standard healthy Cocker range
      expect(result.minAdultKg).toBeGreaterThanOrEqual(12.5);
      expect(result.maxAdultKg).toBeLessThanOrEqual(16.0);
      expect(result.confidencePercent).toBeGreaterThanOrEqual(80);
    });

    it('fixes timestamp desynchronization bug (projection does not decay over elapsed time)', () => {
      // Simulating a snapshot where the only log is from August 1 (at age 17.1 weeks, 7.8kg)
      const singleLog = [pistacheActivities[2]]; // 7.8 kg on 2026-08-01

      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        // Calculate on August 1 (right after weigh-in, puppy was 17.1 weeks)
        vi.setSystemTime(new Date('2026-08-01T12:06:00.000Z'));
        const resOnJuly25 = calculateProjectedAdultWeightRange(
          pistacheProfile.breed,
          singleLog,
          pistacheBirthDate
        );

        // Calculate 6 weeks later without any new weigh-in
        vi.setSystemTime(new Date('2026-09-12T12:06:00.000Z'));
        const resSixWeeksLater = calculateProjectedAdultWeightRange(
          pistacheProfile.breed,
          singleLog,
          pistacheBirthDate
        );

        // The prediction MUST remain identical because the puppy was 17.1 weeks when 7.8kg was recorded!
        expect(resSixWeeksLater.projectedAdultKg).toBe(resOnJuly25.projectedAdultKg);
      } finally {
        vi.useRealTimers();
      }
    });

    it('blends 85% empirical trajectory with 15% breed baseline from 6 weigh-ins', () => {
      const sixWeighIns: Activity[] = [
        ['2026-05-08', 3], ['2026-05-22', 4], ['2026-06-08', 5], ['2026-06-22', 6], ['2026-07-08', 7], ['2026-07-22', 8],
      ].map(([date, weightKg]) => ({ id: `w-${date}`, puppyId: 'pup-pistache', type: 'weight', timestamp: `${date}T00:00:00.000Z`, weightKg: Number(weightKg), loggedBy: 'Sam' }));

      const result = calculateProjectedAdultWeightRange('English Cocker Spaniel', sixWeighIns, '2026-04-03T00:00:00.000Z', 'female');

      expect(result.isTrajectoryBased).toBe(true);
      expect(result.projectedAdultKg).toBe(14.9);
    });

    it('without weigh-ins, projects the breed baseline with a -12% / +15% range', () => {
      expect(calculateProjectedAdultWeightRange('English Cocker Spaniel', [], 20, 'female')).toMatchObject({
        projectedAdultKg: 13,
        minAdultKg: 11.4,
        maxAdultKg: 15,
        isTrajectoryBased: false,
        confidencePercent: 50,
      });
    });
  });

  describe('Gompertz Growth Velocity (dW/dt)', () => {
    it('computes realistic physiological daily weight gain for 20-22 week medium puppy (~50-65 g/day)', () => {
      const dailyGain = getWalthamGrowthVelocity(14.4, 21.6);
      expect(dailyGain).toBeGreaterThanOrEqual(45);
      expect(dailyGain).toBeLessThanOrEqual(65);
    });

    it('peaks between 10 and 14 weeks and never increases from week 16 toward adulthood', () => {
      const weeks = Array.from({ length: 53 }, (_, index) => index + 4); // 4..56 weeks
      const gains = weeks.map((week) => getWalthamGrowthVelocity(14.4, week));

      const peakWeek = weeks[gains.indexOf(Math.max(...gains))];
      expect(peakWeek).toBeGreaterThanOrEqual(10);
      expect(peakWeek).toBeLessThanOrEqual(14);

      const gainsFromWeek16 = gains.slice(weeks.indexOf(16));
      gainsFromWeek16.slice(1).forEach((gain, index) => {
        expect(gain).toBeLessThanOrEqual(gainsFromWeek16[index]);
      });

      const gainAt8w = getWalthamGrowthVelocity(14.4, 8);
      const gainAt13w = getWalthamGrowthVelocity(14.4, 13);
      const gainAt26w = getWalthamGrowthVelocity(14.4, 26);
      const gainAt48w = getWalthamGrowthVelocity(14.4, 48);
      expect(gainAt13w).toBeGreaterThanOrEqual(gainAt8w);
      expect(gainAt13w).toBeGreaterThan(gainAt26w);
      expect(gainAt26w).toBeGreaterThan(gainAt48w);
      expect(gainAt48w).toBeLessThan(15); // < 15 g/day near adulthood

      // Growth stops at 56 weeks
      expect(getWalthamGrowthVelocity(14.4, 55)).toBe(4);
      expect(getWalthamGrowthVelocity(14.4, 56)).toBe(0);
    });

    it('estimates accurate current weight between weigh-ins without severe underestimation', () => {
      // Last weigh-in: 9.5 kg on September 1. Target date: September 6 (5 days elapsed)
      const estimated = estimateCurrentWeightFromLastLog(
        9.5,
        '2026-09-01T16:00:00.000Z',
        '2026-09-06T16:00:00.000Z',
        21.7,
        14.4
      );

      // In 5 days at ~53 g/day, puppy should gain ~0.26 kg -> ~9.76 kg
      expect(estimated).toBeGreaterThanOrEqual(9.70);
      expect(estimated).toBeLessThanOrEqual(9.82);
    });
  });

  describe('Weight timeline: every weight event, nothing merged (Phase 5c)', () => {
    it('returns every weight event oldest first: a home weigh-in 2 h and 0.05 kg from a vet weigh-in is its own entry', () => {
      const homeWeighIn: Activity = { id: 'act-home', puppyId: 'pup-pistache', type: 'weight', timestamp: '2026-09-03T08:00:00.000Z', weightKg: 9.47, loggedBy: 'Sam' };
      const pee: Activity = { id: 'act-pee', puppyId: 'pup-pistache', type: 'pee', timestamp: '2026-09-03T09:00:00.000Z', loggedBy: 'Sam' };

      const unified = getUnifiedWeightEntries([pistacheVetWeighIns[3], pee, homeWeighIn, ...pistacheActivities]);

      expect(unified.map((entry) => entry.id)).toEqual(['act-1', 'act-2', 'act-3', 'act-4', 'act-5', 'act-6', 'act-home', 'vet-4']);
    });

    it('the last logged weight is the latest weight event, a vet weigh-in included', () => {
      // Puppy age must come from targetDateISO, never from the wall clock.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2027-06-08T12:00:00.000Z'));
      try {
        const effective = getEffectivePuppyWeight(
          pistacheProfile,
          [...pistacheActivities, ...pistacheVetWeighIns],
          '2026-09-06T16:00:00.000Z'
        );

        expect(effective.lastLoggedWeight).toBe(9.52); // The Sept 3 deworming weigh-in
        expect(effective.estimatedCurrentWeight).toBeGreaterThan(9.52);
        expect(effective.dailyGainGrams).toBe(50);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('a new dog before its first weigh-in: the profile weight is made up (4.5 kg by default), never used', () => {
    const newChihuahua: PuppyProfile = { ...pistacheProfile, breed: 'Chihuahua', birthDate: '2026-06-25', weightKg: 4.5 };

    it('the current weight is the breed curve at its age, and there is no last weigh-in', () => {
      // 12 weeks old: WALTHAM category I is at 50 % of the 2.5 kg female baseline
      expect(getEffectivePuppyWeight(newChihuahua, [], '2026-09-17T10:00:00.000Z')).toMatchObject({
        lastLoggedWeight: undefined,
        estimatedCurrentWeight: 1.25,
        isEstimated: true,
      });
    });
  });

  // Backlog item 19: a dog created from now on stores no profile weight (null), older dogs keep theirs
  describe('a dog without a profile weight (null): every estimate is the same as with one', () => {
    const target = '2026-09-06T16:00:00.000Z';
    const withoutWeight: PuppyProfile = { ...pistacheProfile, weightKg: null };

    it('before the first weigh-in: the same breed curve', () => {
      expect(getEffectivePuppyWeight(withoutWeight, [], target)).toEqual(getEffectivePuppyWeight(pistacheProfile, [], target));
    });

    it('with weigh-ins: the same last weigh-in, estimate and daily gain', () => {
      const weighIns = [...pistacheActivities, ...pistacheVetWeighIns];
      expect(getEffectivePuppyWeight(withoutWeight, weighIns, target)).toEqual(getEffectivePuppyWeight(pistacheProfile, weighIns, target));
    });

    it('the same potty and meal predictions', () => {
      const referenceTime = new Date(target);
      expect(calculatePredictions(pistacheActivities, withoutWeight, referenceTime, 'Europe/Paris')).toEqual(
        calculatePredictions(pistacheActivities, pistacheProfile, referenceTime, 'Europe/Paris')
      );
    });
  });

  describe('WALTHAM Category Benchmarks', () => {
    it('accurately categorizes breeds into WALTHAM 5-tier size classes', () => {
      expect(getWalthamCategory(4)).toBe('I');
      expect(getWalthamCategory(7.5)).toBe('II');
      expect(getWalthamCategory(14.0)).toBe('III');
      expect(getWalthamCategory(25.0)).toBe('IV');
      expect(getWalthamCategory(35.0)).toBe('V');
    });

    it('returns the WALTHAM anchors and a smooth Hermite blend between them', () => {
      const fracAt8w = getWalthamGrowthFraction('III', 8);
      const fracAt26w = getWalthamGrowthFraction('III', 26);
      const fracAt52w = getWalthamGrowthFraction('III', 52);
      expect(fracAt8w).toBeCloseTo(0.27, 2);
      expect(fracAt26w).toBeCloseTo(0.76, 2);
      expect(fracAt52w).toBe(1.0);

      // 9 weeks sits between the 8w (0.27) and 12w (0.42) anchors: t = 0.25, S(t) = 3t² - 2t³ = 0.15625
      expect(getWalthamGrowthFraction('III', 9)).toBeCloseTo(0.2934, 4);
    });

    it('produces category-accurate expected benchmarks for English Cocker Spaniel (Category III)', () => {
      const benchmarks = scaleGrowthBenchmarks(14.0, 'English Cocker Spaniel');
      const w8 = benchmarks.find((b) => b.label === '8w');
      const w12 = benchmarks.find((b) => b.label === '12w');
      const w16 = benchmarks.find((b) => b.label === '16w');
      const m6 = benchmarks.find((b) => b.label === '6m');
      const m12 = benchmarks.find((b) => b.label === '12m');

      // For a 14kg adult Cocker:
      // 8w should be ~3.8kg (min ~3.3, max ~4.3), correctly validating Pistache's 4.0kg!
      expect(w8?.expectedKg).toBeGreaterThanOrEqual(3.5);
      expect(w8?.expectedKg).toBeLessThanOrEqual(4.2);
      expect(w8?.minKg).toBeLessThanOrEqual(4.0);
      expect(w8?.maxKg).toBeGreaterThanOrEqual(4.0);

      // 12w should be ~5.9kg
      expect(w12?.expectedKg).toBeGreaterThanOrEqual(5.5);
      expect(w12?.expectedKg).toBeLessThanOrEqual(6.5);

      // 16w should be ~7.6kg
      expect(w16?.expectedKg).toBeGreaterThanOrEqual(7.0);
      expect(w16?.expectedKg).toBeLessThanOrEqual(8.2);

      // 6m should be ~10.6kg
      expect(m6?.expectedKg).toBeGreaterThanOrEqual(10.0);
      expect(m6?.expectedKg).toBeLessThanOrEqual(11.5);

      // 12m must equal adult target (14kg)
      expect(m12?.expectedKg).toBe(14.0);
    });
  });
});
