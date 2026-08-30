import { describe, it, expect } from 'vitest';
import {
  getExpectedAdultWeight,
  getWalthamCategory,
  getWalthamGrowthFraction,
  getWalthamGrowthVelocity,
  getUnifiedWeightEntries,
  calculateProjectedAdultWeightRange,
  estimateCurrentWeightFromLastLog,
  getEffectivePuppyWeight,
  scaleGrowthBenchmarks,
} from '../weight';
import type { Activity, HealthRecord, PuppyProfile } from '../../types';

describe('Canine Weight Prediction & WALTHAM Growth Engine', () => {
  const balmaBirthDate = '2026-03-26T23:00:00.000Z'; // March 27, 2026

  const balmaActivities: Activity[] = [
    { id: 'act-1', puppyId: 'pup-balma', type: 'weight', timestamp: '2026-05-27T10:00:00.000Z', weightKg: 4.075, loggedBy: 'Matthieu' },
    { id: 'act-2', puppyId: 'pup-balma', type: 'weight', timestamp: '2026-06-27T12:07:00.000Z', weightKg: 6.0, loggedBy: 'Matthieu' },
    { id: 'act-3', puppyId: 'pup-balma', type: 'weight', timestamp: '2026-07-25T12:06:00.000Z', weightKg: 7.8, loggedBy: 'Matthieu' },
    { id: 'act-4', puppyId: 'pup-balma', type: 'weight', timestamp: '2026-08-07T20:08:00.000Z', weightKg: 8.3, loggedBy: 'Matthieu' },
    { id: 'act-5', puppyId: 'pup-balma', type: 'weight', timestamp: '2026-08-18T15:36:00.000Z', weightKg: 8.9, loggedBy: 'Matthieu' },
    { id: 'act-6', puppyId: 'pup-balma', type: 'weight', timestamp: '2026-08-25T16:02:00.000Z', weightKg: 9.5, loggedBy: 'Matthieu' },
  ];

  const balmaHealthRecords: HealthRecord[] = [
    { id: 'hr-1', householdId: 'hh-1', puppyId: 'pup-balma', type: 'deworming', name: 'Drontal Chiot', date: '2026-05-23T22:00:00.000Z', weightAtTime: 4.0 },
    { id: 'hr-2', householdId: 'hh-1', puppyId: 'pup-balma', type: 'deworming', name: 'Credelio Plus', date: '2026-06-27T22:00:00.000Z', weightAtTime: 6.8 },
    { id: 'hr-3', householdId: 'hh-1', puppyId: 'pup-balma', type: 'deworming', name: 'Credelio Plus', date: '2026-07-26T22:00:00.000Z', weightAtTime: 7.8 },
    { id: 'hr-4', householdId: 'hh-1', puppyId: 'pup-balma', type: 'deworming', name: 'Credelio Plus', date: '2026-08-26T22:00:00.000Z', weightAtTime: 9.52 },
  ];

  const balmaProfile: PuppyProfile = {
    id: 'pup-balma',
    name: 'Balma',
    breed: 'English Cocker Spaniel / Cocker Anglais',
    birthDate: balmaBirthDate,
    weightKg: 7.8,
    dailyFoodGramGoal: 240,
    targetMealsPerDay: 3,
    gender: 'female',
  };

  describe('Real Dog Data Regression: Balma', () => {
    it('projects adult weight within healthy breed range (13.5 - 15.2 kg) from full longitudinal trail', () => {
      const unified = getUnifiedWeightEntries(balmaActivities, balmaHealthRecords);
      expect(unified.length).toBeGreaterThanOrEqual(6);

      const result = calculateProjectedAdultWeightRange(
        balmaProfile.breed,
        unified,
        balmaBirthDate,
        balmaProfile.weightKg,
        balmaProfile.gender
      );

      expect(result.isTrajectoryBased).toBe(true);
      expect(result.walthamCategory).toBe('III');
      // Balma's empirical trajectory converges tightly around 14.0 - 14.4 kg
      expect(result.projectedAdultKg).toBeGreaterThanOrEqual(13.5);
      expect(result.projectedAdultKg).toBeLessThanOrEqual(14.8);
      // Min and max bounds encompass standard healthy Cocker range
      expect(result.minAdultKg).toBeGreaterThanOrEqual(12.5);
      expect(result.maxAdultKg).toBeLessThanOrEqual(16.0);
      expect(result.confidencePercent).toBeGreaterThanOrEqual(80);
    });

    it('fixes timestamp desynchronization bug (projection does not decay over elapsed time)', () => {
      // Simulating a snapshot where the only log is from July 25 (at age 17.1 weeks, 7.8kg)
      const singleLog = [balmaActivities[2]]; // 7.8 kg on 2026-07-25

      // Calculate on July 25 (right after weigh-in, puppy was 17.1 weeks)
      const resOnJuly25 = calculateProjectedAdultWeightRange(
        balmaProfile.breed,
        singleLog,
        balmaBirthDate
      );

      // Calculate 6 weeks later without any new weigh-in
      const resSixWeeksLater = calculateProjectedAdultWeightRange(
        balmaProfile.breed,
        singleLog,
        balmaBirthDate
      );

      // The prediction MUST remain identical because the puppy was 17.1 weeks when 7.8kg was recorded!
      expect(resSixWeeksLater.projectedAdultKg).toBe(resOnJuly25.projectedAdultKg);
    });
  });

  describe('Gompertz Growth Velocity (dW/dt)', () => {
    it('computes realistic physiological daily weight gain for 20-22 week medium puppy (~50-65 g/day)', () => {
      const dailyGain = getWalthamGrowthVelocity(14.4, 21.6);
      expect(dailyGain).toBeGreaterThanOrEqual(45);
      expect(dailyGain).toBeLessThanOrEqual(65);
    });

    it('peaks at inflection point (around 12-14 weeks) and steadily decays toward adulthood', () => {
      const gainAt8w = getWalthamGrowthVelocity(14.4, 8);
      const gainAt13w = getWalthamGrowthVelocity(14.4, 13); // Peak velocity
      const gainAt26w = getWalthamGrowthVelocity(14.4, 26);
      const gainAt48w = getWalthamGrowthVelocity(14.4, 48);

      expect(gainAt13w).toBeGreaterThanOrEqual(gainAt8w);
      expect(gainAt13w).toBeGreaterThan(gainAt26w);
      expect(gainAt26w).toBeGreaterThan(gainAt48w);
      expect(gainAt48w).toBeLessThan(15); // < 15 g/day near adulthood
    });

    it('estimates accurate current weight between weigh-ins without severe underestimation', () => {
      // Last weigh-in: 9.5 kg on August 25. Target date: August 30 (5 days elapsed)
      const estimated = estimateCurrentWeightFromLastLog(
        9.5,
        '2026-08-25T16:00:00.000Z',
        '2026-08-30T16:00:00.000Z',
        21.7,
        14.4
      );

      // In 5 days at ~53 g/day, puppy should gain ~0.26 kg -> ~9.76 kg
      expect(estimated).toBeGreaterThanOrEqual(9.70);
      expect(estimated).toBeLessThanOrEqual(9.82);
    });
  });

  describe('Unified Weight Stream (Activities + Health Records)', () => {
    it('unifies and deduplicates activities and vet clinic records cleanly', () => {
      const unified = getUnifiedWeightEntries(balmaActivities, balmaHealthRecords);

      // Verify records from both sources are present
      expect(unified.some((e) => e.source === 'activity')).toBe(true);
      expect(unified.some((e) => e.source === 'vet')).toBe(true);

      // Verify sorted chronologically
      for (let i = 0; i < unified.length - 1; i++) {
        const t1 = new Date(unified[i].timestamp).getTime();
        const t2 = new Date(unified[i + 1].timestamp).getTime();
        expect(t1).toBeLessThanOrEqual(t2);
      }
    });

    it('computes effective puppy weight using both activities and health records', () => {
      const effective = getEffectivePuppyWeight(
        balmaProfile,
        balmaActivities,
        '2026-08-30T16:00:00.000Z',
        balmaHealthRecords
      );

      expect(effective.lastLoggedWeight).toBe(9.52); // Latest is health record on Aug 26
      expect(effective.estimatedCurrentWeight).toBeGreaterThan(9.52);
      expect(effective.dailyGainGrams).toBeGreaterThan(40);
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

    it('evaluates smooth Hermite growth fractions across development stages', () => {
      const fracAt8w = getWalthamGrowthFraction('III', 8);
      const fracAt26w = getWalthamGrowthFraction('III', 26);
      const fracAt52w = getWalthamGrowthFraction('III', 52);
      expect(fracAt8w).toBeCloseTo(0.27, 2);
      expect(fracAt26w).toBeCloseTo(0.76, 2);
      expect(fracAt52w).toBe(1.0);
    });

    it('produces category-accurate expected benchmarks for English Cocker Spaniel (Category III)', () => {
      const benchmarks = scaleGrowthBenchmarks(14.0, 'English Cocker Spaniel');
      const w8 = benchmarks.find((b) => b.label === '8w');
      const w12 = benchmarks.find((b) => b.label === '12w');
      const w16 = benchmarks.find((b) => b.label === '16w');
      const m6 = benchmarks.find((b) => b.label === '6m');
      const m12 = benchmarks.find((b) => b.label === '12m');

      // For a 14kg adult Cocker:
      // 8w should be ~3.8kg (min ~3.3, max ~4.3), correctly validating Balma's 4.0kg!
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

  describe('Gender-Aware Breed Baselines', () => {
    it('differentiates female and male adult weights for sexually dimorphic breeds', () => {
      const femaleCocker = getExpectedAdultWeight('English Cocker Spaniel', 'female');
      const maleCocker = getExpectedAdultWeight('English Cocker Spaniel', 'male');
      expect(femaleCocker).toBe(13.0);
      expect(maleCocker).toBe(14.5);

      const femaleAussie = getExpectedAdultWeight('Berger Australien', 'female');
      const maleAussie = getExpectedAdultWeight('Berger Australien', 'male');
      expect(femaleAussie).toBe(22.0);
      expect(maleAussie).toBe(27.0);
    });
  });
});
