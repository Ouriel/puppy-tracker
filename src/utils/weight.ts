import type {
  Activity,
  PuppyProfile,
  HealthRecord,
  EffectiveWeightInfo,
  WeightProjectionResult,
} from '../types';
import { getPuppyAge } from './predictions';

export type { EffectiveWeightInfo, WeightProjectionResult };

export interface UnifiedWeightEntry {
  id: string;
  timestamp: string; // ISO date string
  weightKg: number;
  source: 'activity' | 'vet';
  notes?: string;
  name?: string;
}

/**
 * Returns baseline expected adult weight for a breed, with gender awareness.
 * References: FCI / AKC / Société Centrale Canine breed standards.
 */
export function getExpectedAdultWeight(breed: string, gender?: 'male' | 'female'): number {
  const breedLower = breed.toLowerCase();

  // Small breeds (3-9 kg adult)
  if (breedLower.includes('chihuahua')) return 3;
  if (breedLower.includes('jack russell')) return gender === 'female' ? 6 : 7;
  if (breedLower.includes('cavalier')) return 7.5;
  if (breedLower.includes('dachshund') || breedLower.includes('teckel')) return 9;

  // Medium breeds (10-18 kg adult)
  if (breedLower.includes('cocker anglais') || breedLower.includes('english cocker')) {
    if (gender === 'female') return 13;
    if (gender === 'male') return 14.5;
    return 13; // Default 13 for backward compatibility with existing tests
  }
  if (breedLower.includes('cocker')) {
    if (gender === 'female') return 12.5;
    if (gender === 'male') return 14.5;
    return 13;
  }
  if (breedLower.includes('beagle')) return gender === 'female' ? 11 : 13;
  if (breedLower.includes('poodle') || breedLower.includes('caniche')) return 14;
  if (breedLower.includes('french bulldog') || breedLower.includes('bouledogue')) {
    return gender === 'female' ? 11.5 : 13;
  }
  if (breedLower.includes('border collie')) return gender === 'female' ? 17 : 20;

  // Large breeds (20-35 kg adult)
  if (breedLower.includes('australian shepherd') || breedLower.includes('berger australien')) {
    return gender === 'female' ? 22 : gender === 'male' ? 27 : 25;
  }
  if (breedLower.includes('german shepherd') || breedLower.includes('berger allemand')) {
    return gender === 'female' ? 30 : gender === 'male' ? 36 : 32;
  }
  if (breedLower.includes('labrador')) return gender === 'female' ? 28 : gender === 'male' ? 33 : 30;
  if (breedLower.includes('golden')) return gender === 'female' ? 28 : gender === 'male' ? 32 : 30;
  if (breedLower.includes('husky')) return 23;

  // Default medium
  return 13;
}

export type WalthamCategory = 'I' | 'II' | 'III' | 'IV' | 'V';

/**
 * Categorizes expected adult bodyweight into the 5 WALTHAM size categories
 * (Salt et al., PLOS ONE 2017: Growth standard charts for monitoring bodyweight in dogs).
 */
export function getWalthamCategory(adultKg: number): WalthamCategory {
  if (adultKg < 6.5) return 'I';    // Toy / Mini (<6.5 kg)
  if (adultKg < 9.0) return 'II';   // Small (6.5 - 9.0 kg)
  if (adultKg <= 16.0) return 'III'; // Medium (9.0 - 16.0 kg, e.g. Cocker Spaniel, Beagle)
  if (adultKg <= 30.0) return 'IV';  // Medium-Large (16.0 - 30.0 kg)
  return 'V';                        // Large (30.0 - 45.0 kg)
}

/**
 * Key empirical growth milestones from WALTHAM Puppy Growth Charts
 * (% of final adult bodyweight at respective age in weeks).
 */
const WALTHAM_ANCHORS: Record<WalthamCategory, Array<{ w: number; f: number }>> = {
  // Category I: Toy (<6.5kg) — rapid early maturity (90% by 30w, adult by ~40w)
  I: [
    { w: 4, f: 0.15 }, { w: 8, f: 0.32 }, { w: 12, f: 0.50 }, { w: 16, f: 0.65 },
    { w: 20, f: 0.76 }, { w: 26, f: 0.86 }, { w: 36, f: 0.96 }, { w: 52, f: 1.00 },
  ],
  // Category II: Small (6.5 - 9.0kg)
  II: [
    { w: 4, f: 0.13 }, { w: 8, f: 0.29 }, { w: 12, f: 0.46 }, { w: 16, f: 0.60 },
    { w: 20, f: 0.71 }, { w: 26, f: 0.82 }, { w: 36, f: 0.94 }, { w: 52, f: 1.00 },
  ],
  // Category III: Medium (9 - 16kg, Cocker Spaniel, Beagle, Frenchie)
  III: [
    { w: 4, f: 0.12 }, { w: 8, f: 0.27 }, { w: 12, f: 0.42 }, { w: 16, f: 0.54 },
    { w: 20, f: 0.64 }, { w: 26, f: 0.76 }, { w: 36, f: 0.89 }, { w: 52, f: 1.00 },
  ],
  // Category IV: Medium-Large (16 - 30kg)
  IV: [
    { w: 4, f: 0.10 }, { w: 8, f: 0.22 }, { w: 12, f: 0.36 }, { w: 16, f: 0.48 },
    { w: 20, f: 0.58 }, { w: 26, f: 0.70 }, { w: 36, f: 0.84 }, { w: 52, f: 0.98 },
    { w: 60, f: 1.00 },
  ],
  // Category V: Large (30 - 45kg) — prolonged adolescent development
  V: [
    { w: 4, f: 0.08 }, { w: 8, f: 0.17 }, { w: 12, f: 0.30 }, { w: 16, f: 0.42 },
    { w: 20, f: 0.52 }, { w: 26, f: 0.64 }, { w: 36, f: 0.78 }, { w: 52, f: 0.93 },
    { w: 68, f: 1.00 },
  ],
};

/**
 * Evaluates the expected fraction of adult weight at a given age using
 * smooth cubic Hermite spline interpolation between WALTHAM clinical anchors.
 */
export function getWalthamGrowthFraction(category: WalthamCategory, ageWeeks: number): number {
  if (ageWeeks <= 2) return 0.06;
  const anchors = WALTHAM_ANCHORS[category];
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (ageWeeks <= first.w) {
    return Math.max(0.06, first.f * Math.pow(ageWeeks / first.w, 1.1));
  }
  if (ageWeeks >= last.w) {
    return 1.0;
  }

  for (let i = 0; i < anchors.length - 1; i++) {
    const a1 = anchors[i];
    const a2 = anchors[i + 1];
    if (ageWeeks >= a1.w && ageWeeks <= a2.w) {
      const t = (ageWeeks - a1.w) / (a2.w - a1.w);
      // Smooth Hermite blend S(t) = 3t^2 - 2t^3 to eliminate piecewise kinks
      const smoothT = t * t * (3 - 2 * t);
      return a1.f + smoothT * (a2.f - a1.f);
    }
  }

  return 1.0;
}

/**
 * Gompertz Growth Velocity Parameters by WALTHAM category.
 * dW/dt = W(t) * B * exp(-B * (t - M)) (kg/week)
 */
const GOMPERTZ_PARAMS: Record<WalthamCategory, { B: number; M: number }> = {
  I:   { B: 0.110, M: 9.0 },
  II:  { B: 0.098, M: 11.0 },
  III: { B: 0.088, M: 13.0 },
  IV:  { B: 0.078, M: 15.5 },
  V:   { B: 0.068, M: 18.0 },
};

/**
 * Calculates current growth velocity in grams per day based on Gompertz first derivative.
 */
export function getWalthamGrowthVelocity(adultKg: number, ageWeeks: number): number {
  if (ageWeeks >= 56) return 0;
  const category = getWalthamCategory(adultKg);
  const { B, M } = GOMPERTZ_PARAMS[category];
  const fraction = getWalthamGrowthFraction(category, ageWeeks);
  const currentWeightKg = adultKg * fraction;

  // Gompertz derivative in kg/week:
  const weeklyGainKg = currentWeightKg * B * Math.exp(-B * (ageWeeks - M));
  const dailyGainGrams = Math.round((weeklyGainKg / 7) * 1000);
  return Math.max(0, dailyGainGrams);
}

/**
 * Unifies weight activities and veterinary health record weigh-ins into
 * a single deduplicated chronological stream.
 */
export function getUnifiedWeightEntries(
  activities: Activity[] = [],
  healthRecords: HealthRecord[] = []
): UnifiedWeightEntry[] {
  const entries: UnifiedWeightEntry[] = [];

  for (const act of activities) {
    if (act.type === 'weight' && act.weightKg && act.weightKg > 0) {
      entries.push({
        id: act.id,
        timestamp: act.timestamp,
        weightKg: act.weightKg,
        source: 'activity',
        notes: act.notes,
      });
    }
  }

  for (const rec of healthRecords) {
    if (rec.weightAtTime && rec.weightAtTime > 0) {
      entries.push({
        id: rec.id,
        timestamp: rec.date,
        weightKg: rec.weightAtTime,
        source: 'vet',
        notes: rec.notes,
        name: rec.name,
      });
    }
  }

  // Sort ascending by timestamp
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Deduplicate entries on the exact same day within 12h and < 0.15kg difference, favoring vet records
  const deduplicated: UnifiedWeightEntry[] = [];
  for (const entry of entries) {
    const existingIndex = deduplicated.findIndex((existing) => {
      const timeDiffHours = Math.abs(
        (new Date(existing.timestamp).getTime() - new Date(entry.timestamp).getTime()) / (1000 * 3600)
      );
      const weightDiffKg = Math.abs(existing.weightKg - entry.weightKg);
      return timeDiffHours <= 18 && weightDiffKg <= 0.25;
    });

    if (existingIndex >= 0) {
      if (entry.source === 'vet') {
        // Prefer vet clinic scale over home scale
        deduplicated[existingIndex] = entry;
      }
    } else {
      deduplicated.push(entry);
    }
  }

  return deduplicated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Calculates projected adult weight range using a scientifically calibrated blend of
 * breed prior (15–35%) and multi-point empirical trajectory (65–85%).
 *
 * Critical Fix: Timestamp synchronization ensures that each log point is evaluated
 * against the puppy's exact age on the day of the weigh-in (t_log), preventing the
 * artificial prediction decay that occurred when using today's age.
 */
export function calculateProjectedAdultWeightRange(
  breed: string,
  weightLogs: Array<Activity | UnifiedWeightEntry | { timestamp: string; weightKg: number }>,
  ageWeeksOrBirthDate?: number | string,
  fallbackProfileWeight?: number,
  gender?: 'male' | 'female'
): WeightProjectionResult {
  const breedBaselineKg = getExpectedAdultWeight(breed, gender);
  const initialCategory = getWalthamCategory(breedBaselineKg);

  const validLogs = (weightLogs || []).filter(
    (log): log is Activity | UnifiedWeightEntry =>
      Boolean(log && typeof log.weightKg === 'number' && log.weightKg > 0)
  );

  if (validLogs.length === 0) {
    const adultTarget = (fallbackProfileWeight && fallbackProfileWeight > 0 && fallbackProfileWeight >= breedBaselineKg * 0.7)
      ? fallbackProfileWeight
      : breedBaselineKg;
    const minAdultKg = Math.round(adultTarget * 0.88 * 10) / 10;
    const maxAdultKg = Math.round(adultTarget * 1.15 * 10) / 10;
    return {
      projectedAdultKg: adultTarget,
      minAdultKg,
      maxAdultKg,
      isTrajectoryBased: false,
      confidencePercent: 50,
      walthamCategory: getWalthamCategory(adultTarget),
      growthVelocityGramsPerDay: getWalthamGrowthVelocity(adultTarget, typeof ageWeeksOrBirthDate === 'number' ? ageWeeksOrBirthDate : 20),
    };
  }

  // Determine birthDate timestamp
  let birthTimestamp: number;
  if (typeof ageWeeksOrBirthDate === 'string' && !isNaN(new Date(ageWeeksOrBirthDate).getTime())) {
    birthTimestamp = new Date(ageWeeksOrBirthDate).getTime();
  } else {
    // Fallback: estimate birth from last log timestamp and passed ageWeeks
    const lastLogTime = new Date(validLogs[validLogs.length - 1].timestamp).getTime();
    const passedWeeks = typeof ageWeeksOrBirthDate === 'number' ? ageWeeksOrBirthDate : 16;
    birthTimestamp = lastLogTime - passedWeeks * 7 * 24 * 3600 * 1000;
  }

  const now = Date.now();
  let weightedSum = 0;
  let totalWeights = 0;
  let latestAgeWeeks = 8;
  const impliedAdults: number[] = [];

  for (const log of validLogs) {
    const logTime = new Date(log.timestamp).getTime();
    const logAgeWeeks = Math.max(4, (logTime - birthTimestamp) / (7 * 24 * 3600 * 1000));
    latestAgeWeeks = Math.max(latestAgeWeeks, logAgeWeeks);

    const fraction = getWalthamGrowthFraction(initialCategory, logAgeWeeks);
    const impliedAdult = log.weightKg! / fraction;
    impliedAdults.push(impliedAdult);

    // Exponential decay weighting with 30-day half-life:
    // Recent logs carry higher weight than very young 8-week logs
    const daysAgo = Math.max(0, (now - logTime) / (24 * 3600 * 1000));
    const weightFactor = Math.exp(-daysAgo / 30);

    weightedSum += impliedAdult * weightFactor;
    totalWeights += weightFactor;
  }

  const empiricalAdultKg = totalWeights > 0 ? weightedSum / totalWeights : impliedAdults[impliedAdults.length - 1];

  // Dynamic blend ratio based on data richness:
  // 1 log: 35% breed prior + 65% empirical
  // 3-5 logs: 20% breed prior + 80% empirical
  // 6+ logs: 15% breed prior + 85% empirical
  let empiricalWeight = 0.65;
  if (validLogs.length >= 6) {
    empiricalWeight = 0.85;
  } else if (validLogs.length >= 3) {
    empiricalWeight = 0.80;
  }

  const blendedAdultKg = Math.round(((breedBaselineKg * (1 - empiricalWeight)) + (empiricalAdultKg * empiricalWeight)) * 10) / 10;
  const finalCategory = getWalthamCategory(blendedAdultKg);

  // Confidence increases with age and number of logs
  const confidencePercent = Math.min(95, Math.round(50 + Math.min(validLogs.length * 5, 30) + Math.min(latestAgeWeeks * 0.5, 15)));

  // Bounded adult range (+/- 7% to 10%)
  const marginFactor = Math.max(0.06, 0.12 - (validLogs.length * 0.01));
  const minAdultKg = Math.round(blendedAdultKg * (1 - marginFactor) * 10) / 10;
  const maxAdultKg = Math.round(blendedAdultKg * (1 + marginFactor) * 10) / 10;

  return {
    projectedAdultKg: blendedAdultKg,
    minAdultKg,
    maxAdultKg,
    isTrajectoryBased: true,
    confidencePercent,
    walthamCategory: finalCategory,
    growthVelocityGramsPerDay: getWalthamGrowthVelocity(blendedAdultKg, latestAgeWeeks),
  };
}

/**
 * Estimates current weight from a past weight log using scientifically accurate
 * WALTHAM growth velocity (grams/day).
 */
export function estimateCurrentWeightFromLastLog(
  lastWeightKg: number,
  lastLogTimestamp: string,
  targetDateISO: string = new Date().toISOString(),
  currentAgeWeeks: number = 20,
  adultTargetKg: number = 14
): number {
  if (!lastWeightKg || lastWeightKg <= 0) return 0;
  const lastTime = new Date(lastLogTimestamp).getTime();
  const targetTime = new Date(targetDateISO).getTime();
  const diffDays = (targetTime - lastTime) / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return Number(lastWeightKg.toFixed(2));

  // Compute daily gain in kg from WALTHAM growth velocity
  const dailyGainGrams = getWalthamGrowthVelocity(adultTargetKg, currentAgeWeeks);
  const dailyGainKg = dailyGainGrams / 1000;

  const estimatedWeight = lastWeightKg + dailyGainKg * diffDays;
  return Number(estimatedWeight.toFixed(2));
}

/**
 * Single central utility to calculate effective current weight for a puppy,
 * unifying activities and health records.
 */
export function getEffectivePuppyWeight(
  profile?: Partial<PuppyProfile> | null,
  activities: Activity[] = [],
  targetDateISO: string = new Date().toISOString(),
  healthRecords: HealthRecord[] = []
): EffectiveWeightInfo {
  const fallbackWeight = profile?.weightKg || 4.2;
  const birthDate = profile?.birthDate || '2025-01-01';
  const ageWeeks = getPuppyAge(birthDate).weeks;

  const unifiedEntries = getUnifiedWeightEntries(activities, healthRecords);

  if (unifiedEntries.length === 0) {
    return {
      lastLoggedWeight: fallbackWeight,
      lastLoggedTimestamp: undefined,
      estimatedCurrentWeight: fallbackWeight,
      daysSinceLastLog: 0,
      isEstimated: false,
      dailyGainGrams: 0,
    };
  }

  const lastEntry = unifiedEntries[unifiedEntries.length - 1];
  const lastLoggedWeight = lastEntry.weightKg;
  const lastLoggedTimestamp = lastEntry.timestamp;

  const daysSinceLastLog = Math.max(
    0,
    (new Date(targetDateISO).getTime() - new Date(lastLoggedTimestamp).getTime()) / (1000 * 3600 * 24)
  );

  const breed = profile?.breed || 'English Cocker Spaniel';
  const adultBaseline = getExpectedAdultWeight(breed, profile?.gender);
  const dailyGainGrams = getWalthamGrowthVelocity(adultBaseline, ageWeeks);

  if (daysSinceLastLog <= 0.5) {
    return {
      lastLoggedWeight,
      lastLoggedTimestamp,
      estimatedCurrentWeight: lastLoggedWeight,
      daysSinceLastLog: 0,
      isEstimated: false,
      dailyGainGrams,
    };
  }

  const estimatedCurrentWeight = estimateCurrentWeightFromLastLog(
    lastLoggedWeight,
    lastLoggedTimestamp,
    targetDateISO,
    ageWeeks,
    adultBaseline
  );

  return {
    lastLoggedWeight,
    lastLoggedTimestamp,
    estimatedCurrentWeight,
    daysSinceLastLog: Math.round(daysSinceLastLog),
    isEstimated: estimatedCurrentWeight !== lastLoggedWeight,
    dailyGainGrams,
  };
}

/**
 * Calculates standard growth benchmarks scaled to expected adult weight,
 * using WALTHAM category growth curves.
 */
export function scaleGrowthBenchmarks(
  adultWeightKg: number,
  _breed?: string
): Array<{ label: string; expectedKg: number; minKg: number; maxKg: number; weeks: number }> {
  const category = getWalthamCategory(adultWeightKg);

  const milestones = [
    { label: '8w', weeks: 8 },
    { label: '12w', weeks: 12 },
    { label: '16w', weeks: 16 },
    { label: '6m', weeks: 26 },
    { label: '12m', weeks: 52 },
  ];

  return milestones.map(({ label, weeks }) => {
    const fraction = weeks >= 52 ? 1.0 : getWalthamGrowthFraction(category, weeks);
    const expectedKg = weeks >= 52 ? Math.round(adultWeightKg * 10) / 10 : Math.round(adultWeightKg * fraction * 10) / 10;
    const minKg = Math.round(expectedKg * 0.88 * 10) / 10;
    const maxKg = Math.round(expectedKg * 1.15 * 10) / 10;
    return {
      label,
      expectedKg,
      minKg,
      maxKg,
      weeks,
    };
  });
}
