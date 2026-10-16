import type {
  Activity,
  PuppyProfile,
  EffectiveWeightInfo,
  WeightProjectionResult,
} from '../types';
import { getPuppyAge } from './predictions';
import { findBreed } from '../data/breedsCatalog';

/** A weight event: an activity of type 'weight' with its weight. */
export type UnifiedWeightEntry = Activity & { weightKg: number };

const formatKgNumber = (kg: number, lang: 'en' | 'fr', maximumFractionDigits = 1, signDisplay: 'auto' | 'exceptZero' = 'auto') =>
  new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits, signDisplay }).format(kg);

/** A change with its sign, at most `maximumFractionDigits` decimals: '+60', '-0,6'. */
export function formatChange(value: number, lang: 'en' | 'fr', maximumFractionDigits = 0): string {
  return formatKgNumber(value, lang, maximumFractionDigits, 'exceptZero');
}

/** A weight as the app shows it, at most 1 decimal: '6,4 kg' in French, '6.4 kg' in English. */
export function formatKg(kg: number, lang: 'en' | 'fr'): string {
  return `${formatKgNumber(kg, lang)} kg`;
}

/** An estimated adult range: whole kilos from 10 kg ('13–15 kg'), else at most 1 decimal ('2,2–2,9 kg'). */
export function formatKgRange(minKg: number, maxKg: number, lang: 'en' | 'fr'): string {
  const digits = maxKg >= 10 ? 0 : 1;
  return `${formatKgNumber(minKg, lang, digits)}–${formatKgNumber(maxKg, lang, digits)} kg`;
}

/**
 * Returns baseline expected adult weight for a breed, with gender awareness.
 * References: FCI / AKC / Société Centrale Canine breed standards.
 */
export function getExpectedAdultWeight(
  breed: string,
  gender?: 'male' | 'female' | null,
  customExpectedWeight?: number | null
): number {
  // Priority 1: User-provided custom expected weight (mixed breeds)
  if (customExpectedWeight && customExpectedWeight >= 1.0) {
    return customExpectedWeight;
  }

  // Priority 2: Veterinary catalog lookup
  const entry = findBreed(breed);
  if (entry) {
    if (gender === 'female') return entry.femaleWeightKg;
    if (gender === 'male') return entry.maleWeightKg;
    if (entry.defaultWeightKg !== undefined) return entry.defaultWeightKg;
    return Math.round(((entry.femaleWeightKg + entry.maleWeightKg) / 2) * 10) / 10;
  }

  // Priority 3: Fallback — medium breed default
  return 13;
}

/** Catalog entries whose weight is a placeholder, not a breed standard. */
const PLACEHOLDER_BREED_IDS = new Set(['mixed-breed', 'unknown', 'other']);

/**
 * The adult weight the chart's expected zone uses: the one typed for the dog, else the breed standard for its sex.
 * Null when the breed is unknown and none was typed: the 13 kg fallback is made up, so no zone.
 */
export function getKnownAdultWeight(profile: Pick<PuppyProfile, 'breed' | 'gender' | 'expectedAdultWeightKg'>): number | null {
  const entry = findBreed(profile.breed);
  const hasTypedWeight = (profile.expectedAdultWeightKg ?? 0) >= 1;
  if (!hasTypedWeight && (!entry || PLACEHOLDER_BREED_IDS.has(entry.id))) return null;
  return getExpectedAdultWeight(profile.breed, profile.gender, profile.expectedAdultWeightKg);
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

/** The age the dog of this size reaches its adult weight: the curve's last anchor (52 weeks; 60 for IV, 68 for V). */
export function getWalthamAdultWeeks(category: WalthamCategory): number {
  return WALTHAM_ANCHORS[category].at(-1)!.w;
}

/**
 * The curve's slope (fraction per week) at each anchor, for a monotone cubic (PCHIP, Fritsch–Carlson): inside, the
 * weighted harmonic mean of the two neighbouring secants, so the curve never goes flat at an anchor nor overshoots;
 * at the first anchor, the slope of the power curve before it; at the last, 0 (growth ends).
 */
const WALTHAM_SLOPES = Object.fromEntries(
  Object.entries(WALTHAM_ANCHORS).map(([category, anchors]) => [
    category,
    anchors.map((anchor, index) => {
      if (index === 0) return (1.1 * anchor.f) / anchor.w;
      if (index === anchors.length - 1) return 0;
      const before = anchors[index - 1];
      const after = anchors[index + 1];
      const secantBefore = (anchor.f - before.f) / (anchor.w - before.w);
      const secantAfter = (after.f - anchor.f) / (after.w - anchor.w);
      const weightBefore = 2 * (after.w - anchor.w) + (anchor.w - before.w);
      const weightAfter = (after.w - anchor.w) + 2 * (anchor.w - before.w);
      return (weightBefore + weightAfter) / (weightBefore / secantBefore + weightAfter / secantAfter);
    }),
  ])
) as Record<WalthamCategory, number[]>;

/**
 * Evaluates the expected fraction of adult weight at a given age: a monotone cubic (PCHIP) through the WALTHAM
 * clinical anchors, so the implied daily gain changes smoothly instead of stopping at every anchor.
 */
export function getWalthamGrowthFraction(category: WalthamCategory, ageWeeks: number): number {
  if (ageWeeks <= 2) return 0.06;
  const anchors = WALTHAM_ANCHORS[category];
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (ageWeeks <= first.w) {
    return Math.max(0.06, first.f * Math.pow(ageWeeks / first.w, 1.1));
  }
  // An unreadable age (NaN) too, as before
  if (!(ageWeeks < last.w)) {
    return 1.0;
  }

  // The interval [anchors[index], anchors[index + 1]] holding this age
  const index = anchors.slice(1).findIndex((anchor) => ageWeeks <= anchor.w);
  const start = anchors[index];
  const end = anchors[index + 1];
  const [startSlope, endSlope] = WALTHAM_SLOPES[category].slice(index, index + 2);
  const span = end.w - start.w;
  const t = (ageWeeks - start.w) / span;
  // Cubic Hermite basis
  return (2 * t ** 3 - 3 * t ** 2 + 1) * start.f
    + (t ** 3 - 2 * t ** 2 + t) * span * startSlope
    + (-2 * t ** 3 + 3 * t ** 2) * end.f
    + (t ** 3 - t ** 2) * span * endSlope;
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
 * Every weight event (an activity of type 'weight'), oldest first. Each weigh-in is its own
 * event, a vet visit's included: nothing is merged, and health records hold no weight.
 */
export function getUnifiedWeightEntries(activities: Activity[] = []): UnifiedWeightEntry[] {
  return activities
    .filter((activity): activity is UnifiedWeightEntry => activity.type === 'weight' && (activity.weightKg ?? 0) > 0)
    .sort((entryA, entryB) => Date.parse(entryA.timestamp) - Date.parse(entryB.timestamp));
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * The measured gain in g/day: least squares through the weigh-ins of the 28 days up to the last one, reaching back to the
 * latest weigh-in at least 7 days before the last when those span less than a week. Null when no weigh-in is 7 days or
 * more before the last one.
 */
export function getMeasuredPace(entries: UnifiedWeightEntry[]): { gramsPerDay: number; days: number } | null {
  const lastTime = Date.parse(entries.at(-1)?.timestamp ?? '');
  const daysBeforeLast = (entry: UnifiedWeightEntry) => (lastTime - Date.parse(entry.timestamp)) / DAY_MS;
  const weekBeforeIndex = entries.findLastIndex((entry) => daysBeforeLast(entry) >= 7);
  if (weekBeforeIndex === -1) return null;
  const firstIndex = Math.min(weekBeforeIndex, entries.findIndex((entry) => daysBeforeLast(entry) <= 28));
  const points = entries.slice(firstIndex).map((entry) => ({ day: Date.parse(entry.timestamp) / DAY_MS, kg: entry.weightKg }));
  const days = points[points.length - 1].day - points[0].day;
  const meanDay = points.reduce((sum, point) => sum + point.day, 0) / points.length;
  const meanKg = points.reduce((sum, point) => sum + point.kg, 0) / points.length;
  const covariance = points.reduce((sum, point) => sum + (point.day - meanDay) * (point.kg - meanKg), 0);
  const variance = points.reduce((sum, point) => sum + (point.day - meanDay) ** 2, 0);
  return { gramsPerDay: Math.round((covariance / variance) * 1000), days: Math.round(days) };
}

/** What the growth curve needs from the dog. */
export type GrowthProfile = Pick<PuppyProfile, 'birthDate' | 'breed' | 'gender' | 'expectedAdultWeightKg'>;

const isOffByTwo = (kg: number, expectedKg: number) => kg > expectedKg * 2 || kg < expectedKg / 2;
const isNewborn = (at: string, profile: GrowthProfile) => getAgeInWeeks(profile.birthDate, at) < 4;

/**
 * A typed weight more than double or less than half its neighbour moved along the growth curve to the typed date
 * (neighbour × f(typed age) / f(neighbour age)): likely a misplaced decimal point. A small breed doubling between
 * 8 and 16 weeks is growth, not a typo.
 */
export function isUnlikelyWeight(typedKg: number, typedAt: string, neighbour: UnifiedWeightEntry, profile: GrowthProfile): boolean {
  // Before 4 weeks (a birth weight) the curve says nothing: a newborn is 1–3 % of its adult weight, the curve 6 %
  if (isNewborn(typedAt, profile) || isNewborn(neighbour.timestamp, profile)) return false;
  const category = getWalthamCategory(getExpectedAdultWeight(profile.breed, profile.gender, profile.expectedAdultWeightKg));
  const fractionAt = (at: string) => getWalthamGrowthFraction(category, getAgeInWeeks(profile.birthDate, at));
  const expectedKg = (neighbour.weightKg * fractionAt(typedAt)) / fractionAt(neighbour.timestamp);
  return isOffByTwo(typedKg, expectedKg);
}

/**
 * The ids of saved weigh-ins (oldest first) that fail that check against both neighbours: the one before and the one
 * after; the first and the last against the two nearest (so the weigh-in next to a typo is not flagged with it). With
 * only two that disagree, the one far off the breed curve (adult × its growth fraction, ×2 or ÷2), none when the adult
 * weight is unknown. Weigh-ins before 4 weeks are left out of the check. The flagged ones are left out of the line, the
 * scale, the estimates and the pace until edited, never hidden.
 */
export function findUnlikelyWeighIns(allEntries: UnifiedWeightEntry[], profile: GrowthProfile): Set<string> {
  const entries = allEntries.filter((entry) => !isNewborn(entry.timestamp, profile));
  if (entries.length === 2) {
    const adultKg = getKnownAdultWeight(profile);
    if (adultKg === null || !isUnlikelyWeight(entries[1].weightKg, entries[1].timestamp, entries[0], profile)) return new Set();
    const category = getWalthamCategory(adultKg);
    return new Set(entries
      .filter((entry) => isOffByTwo(entry.weightKg, adultKg * getWalthamGrowthFraction(category, getAgeInWeeks(profile.birthDate, entry.timestamp))))
      .map((entry) => entry.id));
  }
  return new Set(
    entries
      .filter((entry, index) => {
        const neighbours = index === 0
          ? entries.slice(1, 3)
          : index === entries.length - 1
            ? entries.slice(Math.max(0, index - 2), index)
            : [entries[index - 1], entries[index + 1]];
        if (neighbours.length < 2) return false;
        return neighbours.every((neighbour) => isUnlikelyWeight(entry.weightKg, entry.timestamp, neighbour, profile));
      })
      .map((entry) => entry.id)
  );
}

/** Every weight event, oldest first, without the ones that look like a typo: what the estimates and the pace use. */
export function getTrustedWeightEntries(activities: Activity[], profile: GrowthProfile): UnifiedWeightEntry[] {
  const entries = getUnifiedWeightEntries(activities);
  const unlikely = findUnlikelyWeighIns(entries, profile);
  return entries.filter((entry) => !unlikely.has(entry.id));
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
  gender?: 'male' | 'female' | null,
  customExpectedWeight?: number | null
): WeightProjectionResult {
  const breedBaselineKg = getExpectedAdultWeight(breed, gender, customExpectedWeight);
  const initialCategory = getWalthamCategory(breedBaselineKg);

  const validLogs = (weightLogs || []).filter(
    (log): log is Activity | UnifiedWeightEntry =>
      Boolean(log && typeof log.weightKg === 'number' && log.weightKg > 0)
  );

  // Before the first weigh-in: the breed baseline. Never the profile weight: legacy, an older dog's is a made-up 4.5 kg (a new dog has none).
  if (validLogs.length === 0) {
    const adultTarget = breedBaselineKg;
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

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** The dog's age in weeks, with the fraction of a week; `at`: now by default. */
export function getAgeInWeeks(birthDate: string, at: string | number = Date.now()): number {
  return (new Date(at).getTime() - new Date(birthDate).getTime()) / WEEK_MS;
}

/**
 * Estimates the weight at a later age along the dog's own track: the last weigh-in moved along the breed-size growth
 * curve (last × f(target) / f(last)), so a dog above or below the curve stays as far from it, whatever the gap.
 */
export function estimateCurrentWeightFromLastLog(
  lastWeightKg: number,
  lastAgeWeeks: number,
  targetAgeWeeks: number,
  adultTargetKg: number
): number {
  if (targetAgeWeeks <= lastAgeWeeks) return lastWeightKg;
  const category = getWalthamCategory(adultTargetKg);
  const estimatedWeight = lastWeightKg * getWalthamGrowthFraction(category, targetAgeWeeks) / getWalthamGrowthFraction(category, lastAgeWeeks);
  return Number(estimatedWeight.toFixed(2));
}

/**
 * Single central utility to calculate effective current weight for a puppy from its weight events.
 */
export function getEffectivePuppyWeight(
  profile?: Partial<PuppyProfile> | null,
  activities: Activity[] = [],
  targetDateISO: string = new Date().toISOString()
): EffectiveWeightInfo {
  const birthDate = profile?.birthDate || '2025-01-01';
  const ageWeeks = getPuppyAge(birthDate, targetDateISO).weeks;
  const breed = profile?.breed || 'English Cocker Spaniel';
  const adultBaseline = getExpectedAdultWeight(breed, profile?.gender, profile?.expectedAdultWeightKg);

  const unifiedEntries = getTrustedWeightEntries(activities, { birthDate, breed, gender: profile?.gender, expectedAdultWeightKg: profile?.expectedAdultWeightKg });

  // Before the first weigh-in: the breed curve at this age. Never the profile weight: legacy, an older dog's is a made-up 4.5 kg (a new dog has none).
  if (unifiedEntries.length === 0) {
    const breedCurveKg = adultBaseline * getWalthamGrowthFraction(getWalthamCategory(adultBaseline), ageWeeks);
    return {
      lastLoggedWeight: undefined,
      lastLoggedTimestamp: undefined,
      estimatedCurrentWeight: Number(breedCurveKg.toFixed(2)),
      daysSinceLastLog: 0,
      isEstimated: true,
    };
  }

  const lastEntry = unifiedEntries[unifiedEntries.length - 1];
  const lastLoggedWeight = lastEntry.weightKg;
  const lastLoggedTimestamp = lastEntry.timestamp;

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
    getAgeInWeeks(birthDate, lastLoggedTimestamp),
    getAgeInWeeks(birthDate, targetDateISO),
    adultBaseline
  );

  return {
    lastLoggedWeight,
    lastLoggedTimestamp,
    estimatedCurrentWeight,
    daysSinceLastLog: Math.round(daysSinceLastLog),
    isEstimated: estimatedCurrentWeight !== lastLoggedWeight,
  };
}
