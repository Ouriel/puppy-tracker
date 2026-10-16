import { describe, it, expect, vi } from 'vitest';
import {
  getWalthamCategory,
  getWalthamGrowthFraction,
  getWalthamGrowthVelocity,
  getUnifiedWeightEntries,
  calculateProjectedAdultWeightRange,
  estimateCurrentWeightFromLastLog,
  getEffectivePuppyWeight,
  formatKg,
  formatGrams,
  getMeasuredPace,
  isUnlikelyWeight,
  findUnlikelyWeighIns,
  getTrustedWeightEntries,
  getKnownAdultWeight,
  getWalthamAdultWeeks,
  type UnifiedWeightEntry,
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

    it('estimates today along the dog\'s own track: the last weigh-in × f(today) / f(last weigh-in)', () => {
      // Last weigh-in: 9.5 kg at 21.7 weeks. Target: 5 days later.
      // Pin changed on purpose: it was the Gompertz velocity at today's age × 5 days (9.70–9.82); now the dog stays
      // on her own curve: 9.5 × 0.6926 / 0.6775
      expect(estimateCurrentWeightFromLastLog(9.5, 21.7, 21.7 + 5 / 7, 14.4)).toBeCloseTo(9.71, 2);
    });

    it('after a long gap, the estimate stays on the dog\'s curve (the velocity × days drifted about 10 % below it)', () => {
      // 4 kg at 10 weeks, 20 weeks without a weigh-in
      const estimated = estimateCurrentWeightFromLastLog(4, 10, 30, 14);

      expect(estimated / getWalthamGrowthFraction('III', 30)).toBeCloseTo(4 / getWalthamGrowthFraction('III', 10), 2);
      expect(estimated).toBeCloseTo(9.45, 2); // the velocity × days gave 8.48
    });

    it('a large dog moves along its own size\'s curve: 10 kg at 12 weeks is 14 kg at 16 weeks for a 40 kg adult (category V)', () => {
      // 10 × 0.42 / 0.30; the medium curve (category III) would give 12,86
      expect(estimateCurrentWeightFromLastLog(10, 12, 16, 40)).toBeCloseTo(14, 2);
    });

    it('a weigh-in in the future or today estimates the weigh-in itself', () => {
      expect(estimateCurrentWeightFromLastLog(9.5, 21.7, 21.7, 14.4)).toBe(9.5);
      expect(estimateCurrentWeightFromLastLog(9.5, 21.7, 21, 14.4)).toBe(9.5);
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
        // No model g/day any more (it was 50, the Gompertz velocity at 22 weeks): the screens show getMeasuredPace
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

  describe('getMeasuredPace: the measured gain, least squares over the 28 days up to the last weigh-in', () => {
    const weighIn = (date: string, weightKg: number): UnifiedWeightEntry =>
      ({ id: date, puppyId: 'pup-pistache', type: 'weight', timestamp: `${date}T08:00:00.000Z`, weightKg, loggedBy: 'Sam' });

    it('fits a line through the weigh-ins of the last 28 days, leaving older ones out', () => {
      // +60 g/day exactly; the July weigh-in would bend the line
      const pace = getMeasuredPace([weighIn('2026-07-01', 3), weighIn('2026-09-01', 9), weighIn('2026-09-11', 9.6), weighIn('2026-09-21', 10.2)]);

      expect(pace).toEqual({ gramsPerDay: 60, days: 20 });
    });

    it('a loss reads negative', () => {
      expect(getMeasuredPace([weighIn('2026-09-01', 10), weighIn('2026-09-11', 9.8)])).toEqual({ gramsPerDay: -20, days: 10 });
    });

    it('one weigh-in, or two less than 7 days apart: no pace', () => {
      expect(getMeasuredPace([weighIn('2026-09-01', 9)])).toBeNull();
      expect(getMeasuredPace([weighIn('2026-09-01', 9), weighIn('2026-09-05', 9.3)])).toBeNull();
    });

    it('a single weigh-in in the last 28 days: the pace from the one before it', () => {
      expect(getMeasuredPace([weighIn('2026-08-01', 7.2), weighIn('2026-09-10', 9.6)])).toEqual({ gramsPerDay: 60, days: 40 });
    });

    it('the last weigh-ins less than a week apart: the pace reaches back to the latest weigh-in a week or more before the last one', () => {
      // The last two 3 days apart, the one before 40 days earlier
      expect(getMeasuredPace([weighIn('2026-07-01', 5), weighIn('2026-08-10', 6.2), weighIn('2026-08-13', 6.3)])).toEqual({ gramsPerDay: 30, days: 43 });
      // Two on the same day, 30 days after the one before
      const sameDay: UnifiedWeightEntry = { ...weighIn('2026-08-31', 8.9), id: 'same-day', timestamp: '2026-08-31T18:00:00.000Z' };
      expect(getMeasuredPace([weighIn('2026-08-01', 7), weighIn('2026-08-31', 8.8), sameDay])).toEqual({ gramsPerDay: 61, days: 30 });
    });

    it('least squares, not the two ends: 48 g/day through uneven weigh-ins (the ends alone give 50)', () => {
      expect(getMeasuredPace([weighIn('2026-09-01', 5), weighIn('2026-09-08', 5.5), weighIn('2026-09-15', 5.7), weighIn('2026-09-29', 6.4)])).toEqual({ gramsPerDay: 48, days: 28 });
    });

    it('a weigh-in 25 days before the last one counts (61 g/day; without it, 40)', () => {
      expect(getMeasuredPace([weighIn('2026-07-01', 3), weighIn('2026-08-05', 8.5), weighIn('2026-08-20', 9.6), weighIn('2026-08-30', 10)])).toEqual({ gramsPerDay: 61, days: 25 });
    });

    it('7 days apart is enough, 6.9 days is not', () => {
      expect(getMeasuredPace([weighIn('2026-09-01', 9), weighIn('2026-09-08', 9.4)])).toEqual({ gramsPerDay: 57, days: 7 });
      expect(getMeasuredPace([weighIn('2026-09-01', 9), { ...weighIn('2026-09-08', 9.4), timestamp: '2026-09-08T05:36:00.000Z' }])).toBeNull();
    });
  });

  describe('typo check: a weight compared with its neighbour moved along the growth curve', () => {
    const weighIn = (id: string, date: string, weightKg: number): UnifiedWeightEntry =>
      ({ id, puppyId: 'pup-pistache', type: 'weight', timestamp: `${date}T08:00:00.000Z`, weightKg, loggedBy: 'Sam' });
    const chihuahua: PuppyProfile = { ...pistacheProfile, breed: 'Chihuahua', birthDate: '2026-04-03' };

    it('a small breed doubling between 8 and 16 weeks is growth, not a typo (the raw ×2 rule warned)', () => {
      // 0.8 kg at 8 weeks; her curve goes from 32 % to 65 % of the adult weight by 16 weeks
      expect(isUnlikelyWeight(1.65, '2026-07-24T08:00:00.000Z', weighIn('w8', '2026-05-29', 0.8), chihuahua)).toBe(false);
    });

    it.each([[113, true], [1.13, true], [11.9, false]])('%s kg typed a week after 11,3 kg: unlikely %s', (typedKg, expected) => {
      expect(isUnlikelyWeight(typedKg, '2026-09-08T08:00:00.000Z', weighIn('w', '2026-09-01', 11.3), pistacheProfile)).toBe(expected);
    });

    it('a saved weigh-in is flagged when it fails against both neighbours; the first and the last against the two nearest', () => {
      const series = [weighIn('a', '2026-08-01', 7.8), weighIn('b', '2026-08-15', 8.4), weighIn('typo', '2026-08-29', 91), weighIn('c', '2026-09-12', 9.9)];

      // c, next to the typo, still matches b
      expect(findUnlikelyWeighIns(series, pistacheProfile)).toEqual(new Set(['typo']));
      expect(findUnlikelyWeighIns([...series.slice(0, 2), weighIn('last', '2026-08-29', 0.9)], pistacheProfile)).toEqual(new Set(['last']));
      expect(findUnlikelyWeighIns([weighIn('first', '2026-07-18', 72), ...series.slice(0, 2)], pistacheProfile)).toEqual(new Set(['first']));
    });

    it('a flagged weigh-in is left out of the current weight and its estimate until edited', () => {
      const withTypo = [...pistacheActivities, { ...pistacheActivities[5], id: 'typo', timestamp: '2026-09-05T08:00:00.000Z', weightKg: 97 }];

      expect(getTrustedWeightEntries(withTypo, pistacheProfile).map((entry) => entry.id)).not.toContain('typo');
      expect(getEffectivePuppyWeight(pistacheProfile, withTypo, '2026-09-06T16:00:00.000Z').lastLoggedWeight).toBe(9.5);
    });

    it('two weigh-ins far apart: the one far off the breed curve (adult × its growth fraction) is flagged; one alone never', () => {
      expect(findUnlikelyWeighIns([weighIn('a', '2026-08-01', 7.8), weighIn('typo', '2026-08-15', 84)], pistacheProfile)).toEqual(new Set(['typo']));
      expect(findUnlikelyWeighIns([weighIn('only', '2026-08-01', 78)], pistacheProfile)).toEqual(new Set());
    });

    it('two weigh-ins, the older one the typo: the older one is flagged, never the right one after it', () => {
      // 10 and 12 weeks old; a 13 kg Cocker female is about 4,5 then 5,5 kg
      const series = [weighIn('typo', '2026-06-12', 46), weighIn('b', '2026-06-26', 5.5)];

      expect(findUnlikelyWeighIns(series, pistacheProfile)).toEqual(new Set(['typo']));
      expect(getTrustedWeightEntries(series, pistacheProfile).map((entry) => entry.id)).toEqual(['b']);
    });

    it('two weigh-ins far apart, a breed the app does not know and no adult weight typed: neither is flagged', () => {
      const series = [weighIn('a', '2026-06-12', 46), weighIn('b', '2026-06-26', 5.5)];

      expect(findUnlikelyWeighIns(series, { ...pistacheProfile, breed: 'Labradoodle' })).toEqual(new Set());
    });

    it('a birth weight is not a typo: the curve says nothing before 4 weeks', () => {
      const labrador: PuppyProfile = { ...pistacheProfile, breed: 'Labrador Retriever' };
      // Birth (0,45 kg), then 8, 9 and 10 weeks old
      const series = [weighIn('birth', '2026-04-03', 0.45), weighIn('w8', '2026-05-29', 7), weighIn('w9', '2026-06-05', 7.6), weighIn('w10', '2026-06-12', 8.3)];

      expect(findUnlikelyWeighIns(series, labrador)).toEqual(new Set());
      // Typing 3,5 kg at 8 weeks after a 0,3 kg birth weight: no "check the decimal point"
      expect(isUnlikelyWeight(3.5, '2026-05-29T08:00:00.000Z', weighIn('birth', '2026-04-03', 0.3), pistacheProfile)).toBe(false);
      // A typo next to a birth weight is still caught by the weigh-ins after it
      expect(findUnlikelyWeighIns([series[0], weighIn('typo', '2026-05-29', 70), ...series.slice(2)], labrador)).toEqual(new Set(['typo']));
    });
  });

  describe('getKnownAdultWeight: the adult weight the chart\'s expected zone uses', () => {
    it('the breed standard for the sex, or the adult weight typed for the dog', () => {
      expect(getKnownAdultWeight({ breed: 'English Cocker Spaniel', gender: 'female' })).toBe(13);
      expect(getKnownAdultWeight({ breed: 'Labradoodle', expectedAdultWeightKg: 24 })).toBe(24);
    });

    it.each(['Labradoodle', 'Mixed Breed', 'Unknown Breed', 'Other'])('none for "%s" with no typed weight: the 13 kg fallback is made up', (breed) => {
      expect(getKnownAdultWeight({ breed, gender: 'female' })).toBeNull();
    });
  });

  describe('formatKg: one number format for every weight on screen and in the PDF', () => {
    it.each([
      [6.4, 'fr', '6,4 kg'],
      [6.4, 'en', '6.4 kg'],
      [10.05, 'fr', '10,1 kg'], // at most 1 decimal
      [7, 'fr', '7 kg'], // no trailing ",0"
      [4.075, 'en', '4.1 kg'],
    ] as const)('%s in %s reads "%s"', (kg, lang, text) => {
      expect(formatKg(kg, lang)).toBe(text);
    });
  });

  describe('formatGrams: the number in the app language, a no-break space before "g"', () => {
    it.each([
      [240, 'fr', '240\u00a0g'],
      [240, 'en', '240\u00a0g'],
      [1200, 'fr', '1\u202f200\u00a0g'],
      [1200, 'en', '1,200\u00a0g'],
      [79.6, 'fr', '80\u00a0g'],
    ] as const)('%s in %s reads "%s"', (grams, lang, text) => {
      expect(formatGrams(grams, lang)).toBe(text);
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

    it('returns the WALTHAM anchors and a monotone cubic (PCHIP) between them', () => {
      const fracAt8w = getWalthamGrowthFraction('III', 8);
      const fracAt26w = getWalthamGrowthFraction('III', 26);
      const fracAt52w = getWalthamGrowthFraction('III', 52);
      expect(fracAt8w).toBeCloseTo(0.27, 2);
      expect(fracAt26w).toBeCloseTo(0.76, 2);
      expect(fracAt52w).toBe(1.0);

      // Pin changed on purpose (0.2934 with smoothstep): the curve now leaves the 8w anchor at the pace of its
      // neighbours (0.0375/week) instead of flat, so 1 week later it is higher
      expect(getWalthamGrowthFraction('III', 9)).toBeCloseTo(0.3083, 4);
    });

    it.each(['I', 'II', 'III', 'IV', 'V'] as const)('category %s: never flat at an anchor before adulthood, never going down', (category) => {
      const fraction = (weeks: number) => getWalthamGrowthFraction(category, weeks);
      const slopeAt = (weeks: number) => (fraction(weeks + 0.01) - fraction(weeks - 0.01)) / 0.02;
      // Smoothstep made the curve flat at 8, 12, 16, 20, 26 and 36 weeks: a 14 kg dog's implied gain swung from 0 to 100+ g/day.
      // Now the slope at an anchor is of the order of its neighbouring secants (weeks 4 apart at least).
      for (const anchorWeeks of [8, 12, 16, 20, 26, 36]) {
        const secantBefore = (fraction(anchorWeeks) - fraction(anchorWeeks - 4)) / 4;
        const secantAfter = (fraction(anchorWeeks + 4) - fraction(anchorWeeks)) / 4;
        expect(slopeAt(anchorWeeks)).toBeGreaterThan(Math.min(secantBefore, secantAfter) / 4);
      }
      for (let weeks = 2; weeks < 70; weeks += 0.1) {
        expect(getWalthamGrowthFraction(category, weeks + 0.1)).toBeGreaterThanOrEqual(getWalthamGrowthFraction(category, weeks));
      }
    });

    it.each([['I', 52], ['III', 52], ['IV', 60], ['V', 68]] as const)('category %s: growth eases to a stop at the adult age (%s weeks), never past 100 %', (category, adultWeeks) => {
      const slopeJustBefore = (getWalthamGrowthFraction(category, adultWeeks) - getWalthamGrowthFraction(category, adultWeeks - 0.1)) / 0.1;

      expect(slopeJustBefore).toBeLessThan(0.001); // per week; the last secant as end slope would leave 0.0025–0.007
      expect(getWalthamAdultWeeks(category)).toBe(adultWeeks);
    });
  });
});
