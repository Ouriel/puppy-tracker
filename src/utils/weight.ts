import type { Activity, PuppyProfile } from '../types';
import { getPuppyAge } from './predictions';

/**
 * Returns baseline expected adult weight for a breed.
 */
export function getExpectedAdultWeight(breed: string): number {
  const breedLower = breed.toLowerCase();
  // Small breeds (3-9 kg adult)
  if (breedLower.includes('chihuahua')) return 3;
  if (breedLower.includes('jack russell')) return 7;
  if (breedLower.includes('cavalier')) return 7.5;
  if (breedLower.includes('dachshund') || breedLower.includes('teckel')) return 9;
  // Medium breeds (10-18 kg adult)
  if (breedLower.includes('cocker')) return 13;
  if (breedLower.includes('beagle')) return 12;
  if (breedLower.includes('poodle') || breedLower.includes('caniche')) return 14;
  if (breedLower.includes('french bulldog') || breedLower.includes('bouledogue')) return 12;
  if (breedLower.includes('border collie')) return 18;
  // Large breeds (20-35 kg adult)
  if (breedLower.includes('australian shepherd') || breedLower.includes('berger australien')) return 25;
  if (breedLower.includes('german shepherd') || breedLower.includes('berger allemand')) return 32;
  if (breedLower.includes('labrador')) return 30;
  if (breedLower.includes('golden')) return 30;
  if (breedLower.includes('husky')) return 23;
  // Default medium
  return 13;
}

/**
 * Calculates projected adult weight range using a blend of breed baseline (30%)
 * and empirical growth trajectory (70%).
 */
export function calculateProjectedAdultWeightRange(
  breed: string,
  weightLogs: Activity[],
  ageWeeks: number,
  fallbackProfileWeight?: number
): { projectedAdultKg: number; minAdultKg: number; maxAdultKg: number; isTrajectoryBased: boolean } {
  const breedBaselineKg = getExpectedAdultWeight(breed);

  const lastLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const lastWeightKg = lastLog?.weightKg || fallbackProfileWeight;

  if (!lastWeightKg || weightLogs.length === 0) {
    const minAdultKg = Math.round(breedBaselineKg * 0.88 * 10) / 10;
    const maxAdultKg = Math.round(breedBaselineKg * 1.15 * 10) / 10;
    return { projectedAdultKg: breedBaselineKg, minAdultKg, maxAdultKg, isTrajectoryBased: false };
  }

  // Logistic growth model expected completion percentage by week
  let expectedFraction = 0.20;
  if (ageWeeks <= 8) {
    expectedFraction = Math.max(0.15, 0.20 * (ageWeeks / 8));
  } else if (ageWeeks <= 12) {
    expectedFraction = 0.20 + (0.18 * ((ageWeeks - 8) / 4));
  } else if (ageWeeks <= 16) {
    expectedFraction = 0.38 + (0.17 * ((ageWeeks - 12) / 4));
  } else if (ageWeeks <= 26) {
    expectedFraction = 0.55 + (0.20 * ((ageWeeks - 16) / 10));
  } else if (ageWeeks <= 36) {
    expectedFraction = 0.75 + (0.15 * ((ageWeeks - 26) / 10));
  } else if (ageWeeks <= 52) {
    expectedFraction = 0.90 + (0.10 * ((ageWeeks - 36) / 16));
  } else {
    expectedFraction = 1.0;
  }

  const empiricalAdultKg = Math.max(lastWeightKg, lastWeightKg / expectedFraction);
  // Blend breed baseline (30%) + empirical trajectory (70%)
  const blendedAdultKg = Math.round(((breedBaselineKg * 0.3) + (empiricalAdultKg * 0.7)) * 10) / 10;

  const minAdultKg = Math.round(blendedAdultKg * 0.90 * 10) / 10;
  const maxAdultKg = Math.round(blendedAdultKg * 1.12 * 10) / 10;

  return {
    projectedAdultKg: blendedAdultKg,
    minAdultKg,
    maxAdultKg,
    isTrajectoryBased: true,
  };
}

/**
 * Estimates current weight from a past weight log using Waltham puppy growth velocity curves.
 * Growth velocity non-linearly decays from ~3.5%/week at 8w to ~0.3%/week at 48w.
 */
export function estimateCurrentWeightFromLastLog(
  lastWeightKg: number,
  lastLogTimestamp: string,
  targetDateISO: string = new Date().toISOString(),
  currentAgeWeeks: number = 20
): number {
  if (!lastWeightKg || lastWeightKg <= 0) return 0;
  const lastTime = new Date(lastLogTimestamp).getTime();
  const targetTime = new Date(targetDateISO).getTime();
  const diffDays = (targetTime - lastTime) / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return Number(lastWeightKg.toFixed(2));

  // Waltham non-linear weekly growth rate scaling
  let weeklyRatePercent = 0.015;
  if (currentAgeWeeks <= 8) {
    weeklyRatePercent = 0.035;
  } else if (currentAgeWeeks <= 12) {
    weeklyRatePercent = 0.025;
  } else if (currentAgeWeeks <= 20) {
    weeklyRatePercent = 0.015;
  } else if (currentAgeWeeks <= 36) {
    weeklyRatePercent = 0.007;
  } else if (currentAgeWeeks <= 52) {
    weeklyRatePercent = 0.003;
  } else {
    weeklyRatePercent = 0;
  }

  const dailyGainKg = (lastWeightKg * weeklyRatePercent) / 7;
  const estimatedWeight = lastWeightKg + dailyGainKg * diffDays;
  return Number(estimatedWeight.toFixed(2));
}

export interface EffectiveWeightInfo {
  /** The raw last weight logged (or fallback profile weight) */
  lastLoggedWeight: number;
  /** ISO timestamp of last weight log (or undefined if profile fallback) */
  lastLoggedTimestamp?: string;
  /** Estimated current weight as of targetDateISO using growth velocity curves */
  estimatedCurrentWeight: number;
  /** Days elapsed since last weight log */
  daysSinceLastLog: number;
  /** True if estimated weight differs from last logged weight because days have elapsed */
  isEstimated: boolean;
}

/**
 * Single central utility to calculate effective current weight for a puppy.
 */
export function getEffectivePuppyWeight(
  profile?: Partial<PuppyProfile> | null,
  activities: Activity[] = [],
  targetDateISO: string = new Date().toISOString()
): EffectiveWeightInfo {
  const fallbackWeight = profile?.weightKg || 4.2;
  const birthDate = profile?.birthDate || '2025-01-01';
  const ageWeeks = getPuppyAge(birthDate).weeks;

  const weightLogs = activities
    .filter((act) => act.type === 'weight' && act.weightKg && act.weightKg > 0)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (weightLogs.length === 0) {
    return {
      lastLoggedWeight: fallbackWeight,
      lastLoggedTimestamp: undefined,
      estimatedCurrentWeight: fallbackWeight,
      daysSinceLastLog: 0,
      isEstimated: false,
    };
  }

  const lastLog = weightLogs[0];
  const lastLoggedWeight = lastLog.weightKg!;
  const lastLoggedTimestamp = lastLog.timestamp;

  const daysSinceLastLog = Math.max(
    0,
    (new Date(targetDateISO).getTime() - new Date(lastLoggedTimestamp).getTime()) / (1000 * 3600 * 24)
  );

  if (daysSinceLastLog <= 0.5) {
    return {
      lastLoggedWeight,
      lastLoggedTimestamp,
      estimatedCurrentWeight: lastLoggedWeight,
      daysSinceLastLog: 0,
      isEstimated: false,
    };
  }

  const estimatedCurrentWeight = estimateCurrentWeightFromLastLog(
    lastLoggedWeight,
    lastLoggedTimestamp,
    targetDateISO,
    ageWeeks
  );

  return {
    lastLoggedWeight,
    lastLoggedTimestamp,
    estimatedCurrentWeight,
    daysSinceLastLog: Math.round(daysSinceLastLog),
    isEstimated: estimatedCurrentWeight !== lastLoggedWeight,
  };
}

/**
 * Calculates standard growth benchmarks scaled to expected adult weight.
 */
export function scaleGrowthBenchmarks(
  adultWeightKg: number
): Array<{ label: string; expectedKg: number; minKg: number; maxKg: number; weeks: number }> {
  const scale = adultWeightKg / 13; // 13 kg is the Cocker reference
  return [
    { label: '8w', expectedKg: Math.round(2.5 * scale * 10) / 10, minKg: Math.round(2.0 * scale * 10) / 10, maxKg: Math.round(3.2 * scale * 10) / 10, weeks: 8 },
    { label: '12w', expectedKg: Math.round(5.0 * scale * 10) / 10, minKg: Math.round(4.2 * scale * 10) / 10, maxKg: Math.round(6.0 * scale * 10) / 10, weeks: 12 },
    { label: '16w', expectedKg: Math.round(7.2 * scale * 10) / 10, minKg: Math.round(6.0 * scale * 10) / 10, maxKg: Math.round(8.5 * scale * 10) / 10, weeks: 16 },
    { label: '6m', expectedKg: Math.round(9.5 * scale * 10) / 10, minKg: Math.round(8.0 * scale * 10) / 10, maxKg: Math.round(11.0 * scale * 10) / 10, weeks: 26 },
    { label: '12m', expectedKg: Math.round(adultWeightKg * 10) / 10, minKg: Math.round(adultWeightKg * 0.88 * 10) / 10, maxKg: Math.round(adultWeightKg * 1.15 * 10) / 10, weeks: 52 },
  ];
}
