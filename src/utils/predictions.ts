import type {
  Activity,
  PredictionResult,
  PuppyProfile,
  ScheduleMode,
  FoodScheduleMode,
  SleepSchedule,
  PredictorOptions,
  SinglePredictionResult,
  FoodPredictionResult,
} from '../types';
import {
  parseIsoDate,
  formatLocalDate,
  formatLogicalDate,
  formatLocalTime,
  formatMinutesToXhXX,
  getLocalHour,
  getLocalDecimalHour,
  getUserTimezone,
  isSameLocalDate,
  getOccurrenceOfClockTimeInTimezone,
} from './date';

/**
 * Wrap-aware check: is the given hour within daytime (between wakeup and bedtime)?
 * Correctly handles schedules where bedtime wraps past midnight (e.g., bedtime=1, wakeup=7).
 */
export function isDaytimeHour(hour: number, wakeupHour: number, bedtimeHour: number): boolean {
  if (bedtimeHour > wakeupHour) {
    return hour >= wakeupHour && hour < bedtimeHour;
  }
  // Wrapped schedule (e.g., wakeup=7, bedtime=1): daytime = 7..23, 0
  return hour >= wakeupHour || hour < bedtimeHour;
}

/**
 * Wrap-aware check: is the given hour within nighttime?
 */
export function isNighttimeHour(hour: number, wakeupHour: number, bedtimeHour: number): boolean {
  return !isDaytimeHour(hour, wakeupHour, bedtimeHour);
}

/**
 * Wrap-aware check: is the given hour approaching bedtime (within ~1 hour prior to sleep)?
 */
export function isApproachingBedtime(hour: number, wakeupHour: number, bedtimeHour: number): boolean {
  const windowStart = Math.floor((bedtimeHour - 1 + 24) % 24);
  if (bedtimeHour > wakeupHour) {
    return hour >= windowStart && hour < bedtimeHour;
  }
  if (windowStart > bedtimeHour) {
    return hour >= windowStart || hour < bedtimeHour;
  }
  return hour >= windowStart && hour < bedtimeHour;
}

/**
 * Calculates puppy age in weeks and months from birth date.
 */
export function getPuppyAge(
  birthDateIso: string,
  targetDateIso: string | Date = new Date()
): { weeks: number; months: number; text: string } {
  const birth = parseIsoDate(birthDateIso);
  const target = parseIsoDate(targetDateIso);
  const diffMs = Math.max(0, target.getTime() - birth.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.max(0, Math.floor(diffDays / 7));
  const months = (diffDays / 30.4375).toFixed(1);

  if (weeks < 16) {
    return { weeks, months: Number(months), text: `${weeks} weeks old` };
  } else {
    const m = Math.floor(diffDays / 30.4375);
    const w = Math.floor((diffDays % 30.4375) / 7);
    return { weeks, months: Number(months), text: `${m} mo ${w} wk old` };
  }
}

/**
 * Calculates veterinary recommended daily food gram intake based on NRC/AAFCO RER / MER equations.
 * @internal Utility calculation for estimations & tests; production uses user-configured `PuppyProfile.dailyFoodGramGoal`.
 */
export function calculateVetFoodGramGoal(weightKg: number, ageMonths: number): number {
  if (!weightKg || weightKg <= 0) return 240;
  if (!ageMonths || isNaN(ageMonths) || ageMonths < 0) ageMonths = 6;
  const rer = 70 * Math.pow(weightKg, 0.75);
  const merMultiplier = ageMonths < 4 ? 3.0 : ageMonths <= 12 ? 2.0 : 1.6;
  const dailyKcal = rer * merMultiplier;
  const kcalPerGram = 3.8; // Standard AAFCO growth kibble density (~380 kcal/cup)
  return Math.round(dailyKcal / kcalPerGram);
}

/**
 * Calculates remaining portion grams for the next meal given daily goal and meals logged today.
 */
export function calculateNextMealPortion(
  dailyGramGoal: number = 200,
  targetMealsPerDay: number = 3,
  loggedGramsToday: number = 0,
  loggedMealsCountToday: number = 0
): number {
  const goal = dailyGramGoal || 200;
  const targetMeals = targetMealsPerDay || 3;
  const remainingGrams = Math.max(0, goal - loggedGramsToday);
  const remainingMeals = Math.max(1, targetMeals - loggedMealsCountToday);
  const portion = Math.round(remainingGrams / remainingMeals);
  return Number.isNaN(portion) ? Math.round(goal / targetMeals) : portion;
}

/**
 * Calculates the next upcoming occurrence of a decimal clock hour (e.g. 7.61 -> 07:37 AM) strictly after referenceDate.
 */
export function getNextOccurrenceOfClockTime(referenceDate: Date, targetHourDecimal: number, timeZone?: string): Date {
  const tz = timeZone || getUserTimezone();
  let candidate = getOccurrenceOfClockTimeInTimezone(referenceDate, targetHourDecimal, tz, 0);
  if (candidate.getTime() <= referenceDate.getTime()) {
    candidate = getOccurrenceOfClockTimeInTimezone(referenceDate, targetHourDecimal, tz, 1);
  }
  return candidate;
}

/**
 * Helper to compute weighted median of a series of minute values with exponential decay weights.
 */
function calculateWeightedMedian(data: { mins: number; weight: number }[], fallbackMins: number): number {
  if (data.length === 0) return fallbackMins;
  const sorted = [...data].sort((a, b) => a.mins - b.mins);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  const target = totalWeight * 0.5;
  let acc = 0;
  for (const item of sorted) {
    acc += item.weight;
    if (acc >= target) return item.mins;
  }
  return sorted[sorted.length - 1].mins;
}

/**
 * Learns puppy's exact night sleep schedule (bedtime & morning wakeup) dynamically from activity logs.
 * Uses Exponential Time-Decay Weighted Medians across daily first and last activities.
 */
export function detectSleepSchedule(
  activities: Activity[],
  timeZone?: string
): SleepSchedule {
  const defaultSchedule: SleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };

  const tz = timeZone || getUserTimezone();
  const maxLogTime = activities.reduce((max, act) => Math.max(max, parseIsoDate(act.timestamp).getTime()), 0);
  const nowTime = maxLogTime > 0 ? maxLogTime : Date.now();
  const fourteenDaysAgo = new Date(nowTime - 14 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((activity) => parseIsoDate(activity.timestamp) >= fourteenDaysAgo);
  const targetLogs = recentActivities.length >= 5 ? recentActivities : activities;

  if (targetLogs.length < 5) return defaultSchedule;

  const byDate: Record<string, Date[]> = {};

  targetLogs.forEach((activity) => {
    const d = parseIsoDate(activity.timestamp);
    const dateStr = formatLogicalDate(d, tz);
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(d);
  });

  const morningData: { mins: number; weight: number }[] = [];
  const eveningData: { mins: number; weight: number }[] = [];

  Object.values(byDate).forEach((logs) => {
    if (logs.length >= 2) {
      const sortedLogs = [...logs].sort((a, b) => a.getTime() - b.getTime());
      // First activity of the day after 05:00 AM (filters out mid-night potty breaks)
      const firstMorning = sortedLogs.find((a) => getLocalHour(a, tz) >= 5) || sortedLogs[0];
      const last = sortedLogs[sortedLogs.length - 1];

      const firstM = getLocalHour(firstMorning, tz) * 60 + firstMorning.getMinutes();
      let lastM = getLocalHour(last, tz) * 60 + last.getMinutes();

      // Exponential time decay (7-day half-life so full week sets the schedule smoothly)
      const daysAgo = Math.max(0, (nowTime - last.getTime()) / (1000 * 60 * 60 * 24));
      const weight = Math.exp(-daysAgo / 7);

      morningData.push({ mins: firstM, weight });

      // Wrap bedtime if past midnight
      if (lastM < 12 * 60) {
        lastM += 24 * 60;
      }
      eveningData.push({ mins: lastM, weight });
    }
  });

  const avgWakeMins = calculateWeightedMedian(morningData, 7 * 60);
  const rawBedMins = calculateWeightedMedian(eveningData, 22 * 60);
  const avgBedMins = rawBedMins % (24 * 60);

  const wakeupHour = avgWakeMins / 60;
  const bedtimeHour = avgBedMins / 60;

  const wH = Math.floor(avgWakeMins / 60);
  const wM = Math.round(avgWakeMins % 60);
  const bH = Math.floor(avgBedMins / 60);
  const bM = Math.round(avgBedMins % 60);

  const wakeupStr = `${String(wH).padStart(2, '0')}:${String(wM).padStart(2, '0')}`;
  const bedtimeStr = `${String(bH).padStart(2, '0')}:${String(bM).padStart(2, '0')}`;

  return { bedtimeHour, wakeupHour, bedtimeStr, wakeupStr };
}

/**
 * Calculates empirical morning sequence offsets (poop offset & breakfast offset relative to first morning pee).
 * Zero hardcoded numbers: learns directly from the household's actual morning logs.
 */
export function calculateMorningSequenceOffsets(
  activities: Activity[],
  timeZone?: string
): { morningPoopOffsetMins: number; morningFoodOffsetMins: number } {
  const defaultOffsets = { morningPoopOffsetMins: 10, morningFoodOffsetMins: 20 };
  const tz = timeZone || getUserTimezone();

  const maxLogTime = activities.reduce((max, act) => Math.max(max, parseIsoDate(act.timestamp).getTime()), 0);
  const nowTime = maxLogTime > 0 ? maxLogTime : Date.now();
  const thirtyDaysAgo = new Date(nowTime - 30 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((activity) => parseIsoDate(activity.timestamp) >= thirtyDaysAgo);

  const byDate: Record<string, Activity[]> = {};
  recentActivities.forEach((act) => {
    const d = parseIsoDate(act.timestamp);
    const dateStr = formatLocalDate(d, tz);
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(act);
  });

  const poopOffsets: { mins: number; weight: number }[] = [];
  const foodOffsets: { mins: number; weight: number }[] = [];

  Object.values(byDate).forEach((dayLogs) => {
    const sorted = [...dayLogs].sort(
      (a, b) => parseIsoDate(a.timestamp).getTime() - parseIsoDate(b.timestamp).getTime()
    );

    const firstPee =
      sorted.find((a) => a.type === 'pee' && getLocalHour(parseIsoDate(a.timestamp), tz) >= 5) ||
      sorted.find((a) => a.type === 'pee');
    if (!firstPee) return;

    const firstPeeTime = parseIsoDate(firstPee.timestamp).getTime();
    const daysAgo = Math.max(0, (nowTime - firstPeeTime) / (1000 * 60 * 60 * 24));
    const weight = Math.exp(-daysAgo / 7);

    // Look for first poop within 2.5 hours of first pee
    const firstPoop = sorted.find((a) => a.type === 'poop');
    if (firstPoop) {
      const firstPoopTime = parseIsoDate(firstPoop.timestamp).getTime();
      const diffMins = Math.round((firstPoopTime - firstPeeTime) / 60000);
      if (diffMins >= -30 && diffMins <= 150) {
        poopOffsets.push({ mins: Math.max(0, diffMins), weight });
      }
    }

    // Look for first meal within 3 hours of first pee
    const firstFood = sorted.find((a) => a.type === 'food');
    if (firstFood) {
      const firstFoodTime = parseIsoDate(firstFood.timestamp).getTime();
      const diffMins = Math.round((firstFoodTime - firstPeeTime) / 60000);
      if (diffMins >= -30 && diffMins <= 180) {
        foodOffsets.push({ mins: Math.max(0, diffMins), weight });
      }
    }
  });

  const morningPoopOffsetMins = Math.round(calculateWeightedMedian(poopOffsets, defaultOffsets.morningPoopOffsetMins));
  let morningFoodOffsetMins = Math.round(calculateWeightedMedian(foodOffsets, defaultOffsets.morningFoodOffsetMins));

  // Enforce morning sequence: Pee ≤ Poop ≤ Breakfast
  if (morningFoodOffsetMins <= morningPoopOffsetMins) {
    morningFoodOffsetMins = morningPoopOffsetMins + 5;
  }

  return { morningPoopOffsetMins, morningFoodOffsetMins };
}

/**
 * Learns puppy's historical typical meal times (breakfast, lunch, dinner) from food logs
 */
export function detectMealSchedule(
  activities: Activity[],
  timeZone?: string
): { breakfastMins: number; lunchMins: number; dinnerMins: number } {
  const defaultMeals = { breakfastMins: 7 * 60 + 30, lunchMins: 12 * 60 + 30, dinnerMins: 19 * 60 + 30 };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const foodLogs = activities.filter(
    (activity) => activity.type === 'food' && parseIsoDate(activity.timestamp) >= thirtyDaysAgo
  );

  if (foodLogs.length < 3) return defaultMeals;

  const tz = timeZone || getUserTimezone();
  const bfasts: number[] = [];
  const lunches: number[] = [];
  const dinners: number[] = [];

  foodLogs.forEach((f) => {
    const d = parseIsoDate(f.timestamp);
    const m = getLocalHour(d, tz) * 60 + d.getMinutes();
    if (m >= 5 * 60 && m < 11 * 60) bfasts.push(m);
    else if (m >= 11 * 60 && m < 16 * 60) lunches.push(m);
    else if (m >= 16 * 60 && m <= 23 * 60 + 59) dinners.push(m);
  });

  const breakfastMins = bfasts.length ? Math.round(bfasts.reduce((a, b) => a + b, 0) / bfasts.length) : defaultMeals.breakfastMins;
  const lunchMins = lunches.length ? Math.round(lunches.reduce((a, b) => a + b, 0) / lunches.length) : defaultMeals.lunchMins;
  const dinnerMins = dinners.length ? Math.round(dinners.reduce((a, b) => a + b, 0) / dinners.length) : defaultMeals.dinnerMins;

  return { breakfastMins, lunchMins, dinnerMins };
}

/**
 * Calculates adaptive average daytime interval between activities using exponential time decay
 * (prioritizing recent days as puppy grows) and computes dynamic ± delta tolerances via semi-IQR.
 */
export function calculateLearnedIntervalMinutes(
  activities: Activity[],
  type: 'pee' | 'poop' | 'food',
  fallbackMinutes: number,
  sleepSchedule: SleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' },
  timeZone?: string
): { intervalMins: number; deltaMins: number; sampleCount: number; isLearned: boolean } {
  const maxLogTime = activities.reduce((max, act) => Math.max(max, parseIsoDate(act.timestamp).getTime()), 0);
  const nowTime = maxLogTime > 0 ? maxLogTime : Date.now();
  const thirtyDaysAgo = new Date(nowTime - 30 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((activity) => parseIsoDate(activity.timestamp) >= thirtyDaysAgo);
  const targetActivities = recentActivities.length >= 5 ? recentActivities : activities;

  const sortedLogs = [...targetActivities]
    .filter((activity) => activity.type === type)
    .sort((activityA, activityB) => parseIsoDate(activityA.timestamp).getTime() - parseIsoDate(activityB.timestamp).getTime());

  const defaultDelta = type === 'pee' ? 20 : type === 'poop' ? 25 : 30;

  if (sortedLogs.length < 2) {
    return { intervalMins: fallbackMinutes, deltaMins: defaultDelta, sampleCount: sortedLogs.length, isLearned: false };
  }

  // Filter gaps: for pee, daytime waking intervals; for poop, 24/7 digestive transit intervals
  const minThresholdMins = type === 'pee' ? 45 : 90; // Exclude short double-void walk pees (<45m) and same-walk poops (<90m)
  const maxThresholdMins = type === 'pee' ? 8 * 60 : 24 * 60;
  const intervals: { diffMinutes: number; weight: number }[] = [];

  for (let i = 1; i < sortedLogs.length; i++) {
    const prevTime = parseIsoDate(sortedLogs[i - 1].timestamp);
    const currTime = parseIsoDate(sortedLogs[i].timestamp);
    const diffMinutes = (currTime.getTime() - prevTime.getTime()) / (1000 * 60);

    if (diffMinutes >= minThresholdMins && diffMinutes <= maxThresholdMins) {
      if (type === 'poop') {
        // Gastrointestinal transit operates continuously 24/7 across consecutive bowel movements
        const daysAgo = Math.max(0, (nowTime - currTime.getTime()) / (1000 * 60 * 60 * 24));
        const weight = Math.exp(-daysAgo / 3);
        intervals.push({ diffMinutes, weight });
      } else {
        const prevHour = getLocalDecimalHour(prevTime, timeZone);
        const currHour = getLocalDecimalHour(currTime, timeZone);

        const isPrevDay = isDaytimeHour(prevHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
        const isCurrDay = isDaytimeHour(currHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);

        // An interval spans overnight sleep if it starts in the evening/night and ends the next morning after waking up
        const isDifferentDays = formatLocalDate(prevTime, timeZone) !== formatLocalDate(currTime, timeZone);
        const crossesNight = isDifferentDays && diffMinutes >= 4.5 * 60 && (
          (prevHour >= 20 || isNighttimeHour(prevHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour)) &&
          (currHour >= (sleepSchedule.wakeupHour - 2) && currHour <= (sleepSchedule.wakeupHour + 3.5))
        );

        // Allow valid waking retention intervals (including pre-bedtime outings around midnight)
        if (isPrevDay && isCurrDay && !crossesNight && diffMinutes <= 8 * 60) {
          // Exponential time decay: 3-day half-life so recent days count significantly more
          const daysAgo = Math.max(0, (nowTime - currTime.getTime()) / (1000 * 60 * 60 * 24));
          const weight = Math.exp(-daysAgo / 3);
          intervals.push({ diffMinutes, weight });
        }
      }
    }
  }

  if (intervals.length === 0) {
    return { intervalMins: fallbackMinutes, deltaMins: defaultDelta, sampleCount: 0, isLearned: false };
  }

  intervals.sort((a, b) => a.diffMinutes - b.diffMinutes);
  const totalWeight = intervals.reduce((sum, item) => sum + item.weight, 0);

  const getWeightedPercentile = (p: number): number => {
    const targetWeight = totalWeight * p;
    let accumulated = 0;
    for (const item of intervals) {
      accumulated += item.weight;
      if (accumulated >= targetWeight) return item.diffMinutes;
    }
    return intervals[intervals.length - 1].diffMinutes;
  };

  const p25 = getWeightedPercentile(0.25);
  const medianMinutes = Math.round(getWeightedPercentile(0.50));
  const p75 = getWeightedPercentile(0.75);

  // Semi-IQR for dynamic ± delta margin
  const rawDelta = Math.round((p75 - p25) / 2);
  const minDelta = type === 'pee' ? 15 : 30;
  const maxDelta = type === 'pee' ? 45 : 90;
  const deltaMins = Math.max(minDelta, Math.min(rawDelta, maxDelta));

  const minInterval = type === 'pee' ? 30 : 180;
  const maxInterval = type === 'pee' ? 360 : 1440;

  return {
    intervalMins: Math.max(minInterval, Math.min(medianMinutes, maxInterval)),
    deltaMins,
    sampleCount: intervals.length,
    isLearned: true,
  };
}

/**
 * Calculates adaptive learned delay between eating a meal and subsequent potty event (pee / poop).
 * Uses exponential recency weighting and semi-IQR tolerance, falling back to age baselines when < 3 samples exist.
 */
export function calculateLearnedPostMealDelayMinutes(
  activities: Activity[],
  pottyType: 'pee' | 'poop',
  fallbackMinutes: number,
  fallbackDeltaMinutes: number = pottyType === 'pee' ? 10 : 15
): { delayMins: number; deltaMins: number; sampleCount: number; isLearned: boolean } {
  const maxLogTime = activities.reduce((max, act) => Math.max(max, parseIsoDate(act.timestamp).getTime()), 0);
  const nowTime = maxLogTime > 0 ? maxLogTime : Date.now();
  const thirtyDaysAgo = new Date(nowTime - 30 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((a) => parseIsoDate(a.timestamp) >= thirtyDaysAgo);

  const sortedActivities = [...recentActivities].sort(
    (a, b) => parseIsoDate(a.timestamp).getTime() - parseIsoDate(b.timestamp).getTime()
  );

  const foodLogs = sortedActivities.filter((a) => a.type === 'food');
  const pottyLogs = sortedActivities.filter((a) => a.type === pottyType);

  const minDelay = pottyType === 'pee' ? 5 : 10;
  const maxDelay = pottyType === 'pee' ? 60 : 150;
  const defaultDelta = fallbackDeltaMinutes;

  const samples: { diffMinutes: number; weight: number }[] = [];

  for (const food of foodLogs) {
    const foodTime = parseIsoDate(food.timestamp).getTime();
    // Find earliest subsequent potty event within the plausible window
    const subsequentPotty = pottyLogs.find((p) => {
      const pTime = parseIsoDate(p.timestamp).getTime();
      return pTime > foodTime && (pTime - foodTime) <= maxDelay * 60 * 1000;
    });

    if (subsequentPotty) {
      const pTime = parseIsoDate(subsequentPotty.timestamp).getTime();
      const diffMins = Math.round((pTime - foodTime) / 60000);
      if (diffMins >= minDelay && diffMins <= maxDelay) {
        const daysAgo = Math.max(0, (nowTime - foodTime) / (1000 * 60 * 60 * 24));
        const weight = Math.exp(-daysAgo / 7);
        samples.push({ diffMinutes: diffMins, weight });
      }
    }
  }

  if (samples.length < 3) {
    return { delayMins: fallbackMinutes, deltaMins: defaultDelta, sampleCount: samples.length, isLearned: false };
  }

  const delayMins = Math.round(
    calculateWeightedMedian(
      samples.map((s) => ({ mins: s.diffMinutes, weight: s.weight })),
      fallbackMinutes
    )
  );

  // Semi-IQR for dynamic tolerance
  const values = samples.map((s) => s.diffMinutes).sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const semiIqr = Math.round(Math.max(5, Math.min(25, (q3 - q1) / 2 || defaultDelta)));

  return { delayMins, deltaMins: semiIqr, sampleCount: samples.length, isLearned: true };
}

/**
 * Predicts the next expected Pee event using the decoupled Pee Pipeline.
 */
export function predictNextPee(
  activities: Activity[],
  profile: PuppyProfile,
  now: Date = new Date(),
  options?: PredictorOptions
): SinglePredictionResult {
  const tz = options?.timeZone || getUserTimezone();
  const currentHour = getLocalHour(now, tz);
  const sleepSchedule = options?.sleepSchedule || detectSleepSchedule(activities, tz);

  const past = activities.filter((a) => parseIsoDate(a.timestamp).getTime() <= now.getTime());
  const sorted = [...past].sort((a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime());

  const lastPee = sorted.find((a) => a.type === 'pee');
  const lastFood = sorted.find((a) => a.type === 'food');

  const { months } = getPuppyAge(profile.birthDate, now);
  const baseBladderHours = Math.max(1, Math.min(months, 4));
  const fallbackPeeIntervalMins = baseBladderHours * 60;
  const learnedPee = calculateLearnedIntervalMinutes(past, 'pee', fallbackPeeIntervalMins, sleepSchedule, tz);

  const ageFallbackPeeDelay = months < 3 ? 15 : months < 6 ? 20 : 30;
  const ageFallbackPeeDelta = months < 3 ? 8 : months < 6 ? 10 : 15;
  const learnedPostMealPee = calculateLearnedPostMealDelayMinutes(past, 'pee', ageFallbackPeeDelay, ageFallbackPeeDelta);
  const postMealPeeDelay = learnedPostMealPee.delayMins;

  if (!lastPee) {
    return {
      nextExpectedAt: null,
      standardExpectedAt: null,
      deltaMins: learnedPee.deltaMins,
      mode: 'daytime_baseline',
      urgency: 'safe',
      reason: 'No pee recorded yet',
    };
  }

  const lastPeeDate = parseIsoDate(lastPee.timestamp);
  const lastPeeTime = lastPeeDate.getTime();
  const standardExpectedAt = new Date(lastPeeTime + learnedPee.intervalMins * 60 * 1000);

  // Dynamic morning awakening window: relative to learned wakeup hour
  const isMorningWindow = currentHour >= (sleepSchedule.wakeupHour - 2) && currentHour < (sleepSchedule.wakeupHour + 3);
  const hasAwokenToday = sorted.some((a) => {
    const d = parseIsoDate(a.timestamp);
    return isSameLocalDate(d, now, tz) && getLocalHour(d, tz) >= (sleepSchedule.wakeupHour - 2);
  });

  const isApproaching = isApproachingBedtime(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
  const isCurrentlyNight = isNighttimeHour(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
  const isNightTime = (isMorningWindow ? !hasAwokenToday : true) && (isCurrentlyNight || isApproaching);

  let nextExpectedAt: Date = standardExpectedAt;
  let mode: ScheduleMode = 'daytime_baseline';
  let reason = '';
  const wakeH = Math.floor(sleepSchedule.wakeupHour);
  const wakeM = Math.round((sleepSchedule.wakeupHour - wakeH) * 60);
  const wakeupStr = sleepSchedule.wakeupStr || `${String(wakeH).padStart(2, '0')}:${String(wakeM).padStart(2, '0')}`;

  if (isNightTime) {
    mode = 'night_sleep';
    const targetWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);

    if (months < 2.5) {
      const midNightPee = new Date(lastPeeTime + 4 * 60 * 60 * 1000);
      if (midNightPee > now) {
        nextExpectedAt = midNightPee;
        reason = 'Night mode: Young puppy mid-night potty break';
      } else {
        nextExpectedAt = targetWakeup;
        reason = `Night mode: Sleeping until morning wakeup (~${wakeupStr})`;
      }
    } else {
      nextExpectedAt = targetWakeup;
      reason = `Night mode: Sleeping until morning wakeup (~${wakeupStr})`;
    }
  } else if (months < 8 && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPeeTime) {
    const foodTime = parseIsoDate(lastFood.timestamp).getTime();
    const minsBetweenPeeAndMeal = Math.round((foodTime - lastPeeTime) / 60000);
    const minsSinceMeal = Math.round((now.getTime() - foodTime) / 60000);

    // If puppy emptied bladder shortly before meal (<= 30m before eating on a walk)
    const peedRightBeforeMeal = minsBetweenPeeAndMeal <= 30;

    if (peedRightBeforeMeal) {
      mode = 'daytime_baseline';
      nextExpectedAt = standardExpectedAt;
      reason = `Bladder emptied before meal (${formatMinutesToXhXX(minsBetweenPeeAndMeal)} ago). Next break during daytime cycle.`;
    } else if (minsSinceMeal <= postMealPeeDelay + 40) {
      mode = 'post_meal_override';
      nextExpectedAt = new Date(foodTime + postMealPeeDelay * 60 * 1000);
      reason = `Pup fed recently (${formatMinutesToXhXX(minsSinceMeal)} ago). Potty break expected ~${postMealPeeDelay}m post-meal.`;
    } else {
      mode = 'daytime_baseline';
      nextExpectedAt = standardExpectedAt;
      reason = learnedPee.isLearned
        ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval (30-day history)`
        : `Based on ~${formatMinutesToXhXX(learnedPee.intervalMins)} age bladder capacity`;
    }
  } else {
    mode = 'daytime_baseline';
    nextExpectedAt = standardExpectedAt;
    reason = learnedPee.isLearned
      ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval (30-day history)`
      : `Based on ~${formatMinutesToXhXX(learnedPee.intervalMins)} age bladder capacity`;
  }

  const diffMins = (nextExpectedAt.getTime() - now.getTime()) / 60000;
  let urgency: 'safe' | 'soon' | 'overdue' = 'safe';
  if (mode !== 'night_sleep') {
    if (diffMins <= 0) urgency = 'overdue';
    else if (diffMins <= 20) urgency = 'soon';
  }

  const deltaMins = mode === 'post_meal_override' ? learnedPostMealPee.deltaMins : learnedPee.deltaMins;

  return {
    nextExpectedAt,
    standardExpectedAt,
    deltaMins,
    mode,
    urgency,
    reason,
  };
}

/**
 * Predicts the next expected Poop event using the decoupled Poop Pipeline.
 */
export function predictNextPoop(
  activities: Activity[],
  profile: PuppyProfile,
  now: Date = new Date(),
  options?: PredictorOptions
): SinglePredictionResult {
  const tz = options?.timeZone || getUserTimezone();
  const currentHour = getLocalHour(now, tz);
  const sleepSchedule = options?.sleepSchedule || detectSleepSchedule(activities, tz);
  const offsets = calculateMorningSequenceOffsets(activities, tz);

  const past = activities.filter((a) => parseIsoDate(a.timestamp).getTime() <= now.getTime());
  const sorted = [...past].sort((a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime());

  const lastPoop = sorted.find((a) => a.type === 'poop');
  const lastFood = sorted.find((a) => a.type === 'food');

  const { months } = getPuppyAge(profile.birthDate, now);
  const learnedPoop = calculateLearnedIntervalMinutes(past, 'poop', 360, sleepSchedule, tz);

  const ageFallbackPoopDelay = months < 3 ? 20 : months < 6 ? 35 : 50;
  const ageFallbackPoopDelta = months < 3 ? 10 : months < 6 ? 15 : 20;
  const learnedPostMealPoop = calculateLearnedPostMealDelayMinutes(past, 'poop', ageFallbackPoopDelay, ageFallbackPoopDelta);
  const postMealPoopDelay = learnedPostMealPoop.delayMins;

  if (!lastPoop) {
    return {
      nextExpectedAt: null,
      standardExpectedAt: null,
      deltaMins: learnedPoop.deltaMins,
      mode: 'daytime_baseline',
      urgency: 'safe',
      reason: 'No poop recorded yet',
    };
  }

  const lastPoopDate = parseIsoDate(lastPoop.timestamp);
  const lastPoopTime = lastPoopDate.getTime();
  const standardExpectedAt = new Date(lastPoopTime + learnedPoop.intervalMins * 60 * 1000);

  const isMorningWindow = currentHour >= (sleepSchedule.wakeupHour - 2) && currentHour < (sleepSchedule.wakeupHour + 3);
  const hasAwokenToday = sorted.some((a) => {
    const d = parseIsoDate(a.timestamp);
    return isSameLocalDate(d, now, tz) && getLocalHour(d, tz) >= (sleepSchedule.wakeupHour - 2);
  });

  const isApproaching = isApproachingBedtime(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
  const isCurrentlyNight = isNighttimeHour(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
  const isNightTime = (isMorningWindow ? !hasAwokenToday : true) && (isCurrentlyNight || isApproaching);

  const isLastPoopConstipated =
    lastPoop.stoolConsistency === 'hard' ||
    (lastPoop.notes || '').toLowerCase().match(/huge|gros|big|grand|constipat/) !== null;

  const isLastPoopDiarrhea =
    lastPoop.stoolConsistency === 'diarrhea' ||
    lastPoop.stoolConsistency === 'soft' ||
    lastPoop.stoolConsistency === 'runny' ||
    (lastPoop.notes || '').toLowerCase().match(/liquid|liquide|diarrhea|diarrhee|loose/) !== null;

  const hoursSinceLastPoop = (now.getTime() - lastPoopTime) / (1000 * 60 * 60);

  let nextExpectedAt: Date = standardExpectedAt;
  let mode: ScheduleMode = 'daytime_baseline';
  let reason = '';

  if (isLastPoopDiarrhea && hoursSinceLastPoop < 12) {
    mode = 'daytime_baseline';
    const elapsedHours = Math.floor((now.getTime() - lastPoopTime) / (60 * 60 * 1000));
    nextExpectedAt = new Date(lastPoopTime + (elapsedHours + 1) * 60 * 60 * 1000);
    reason = 'GI Upset Alert: Liquid/diarrhea stool recorded. Frequent potty checks recommended (60m window).';
  } else if (isNightTime) {
    mode = 'night_sleep';
    const targetWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
    nextExpectedAt = new Date(targetWakeup.getTime() + offsets.morningPoopOffsetMins * 60 * 1000);
    const targetTimeStr = formatLocalTime(nextExpectedAt, tz);
    reason = `Night mode: Sleeping until morning outing (~${targetTimeStr})`;
  } else if (isLastPoopConstipated && hoursSinceLastPoop < 16) {
    mode = 'daytime_baseline';
    const refractoryMinutes = Math.max(learnedPoop.intervalMins * 1.4, 480);
    nextExpectedAt = new Date(lastPoopTime + refractoryMinutes * 60 * 1000);
    reason = 'Digestive system recovering from recent hard stool. Colon refilling after meals.';
  } else {
    let postMealOverride = false;
    if (months < 8 && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPoopTime) {
      const foodTime = parseIsoDate(lastFood.timestamp).getTime();
      const minsBetweenPoopAndMeal = Math.round((foodTime - lastPoopTime) / 60000);
      const minsSinceMeal = Math.round((now.getTime() - foodTime) / 60000);

      // If puppy emptied bowels right before eating (<= 30m before meal on a walk)
      const poopedRightBeforeMeal = minsBetweenPoopAndMeal <= 30;

      if (!poopedRightBeforeMeal && minsSinceMeal <= postMealPoopDelay + 45) {
        postMealOverride = true;
        mode = 'post_meal_override';
        nextExpectedAt = new Date(foodTime + postMealPoopDelay * 60 * 1000);
        reason = `Pup fed recently (${formatMinutesToXhXX(minsSinceMeal)} ago). Poop break expected ~${postMealPoopDelay}m post-meal.`;
      }
    }

    if (!postMealOverride) {
      const todayDateStr = formatLocalDate(now, tz);
      const todayMealsSorted = past
        .filter((a) => a.type === 'food' && formatLocalDate(parseIsoDate(a.timestamp), tz) === todayDateStr)
        .sort((a, b) => parseIsoDate(a.timestamp).getTime() - parseIsoDate(b.timestamp).getTime());

      const todayPoops = past.filter(
        (a) => a.type === 'poop' && formatLocalDate(parseIsoDate(a.timestamp), tz) === todayDateStr
      );

      if (todayMealsSorted.length > 0 && todayPoops.length === 0) {
        mode = 'daytime_baseline';
        const latestMealTime = parseIsoDate(todayMealsSorted[todayMealsSorted.length - 1].timestamp).getTime();
        const digestiveTransitMins = Math.max(240, learnedPoop.intervalMins);
        nextExpectedAt = new Date(latestMealTime + digestiveTransitMins * 60 * 1000);
        reason = learnedPoop.isLearned
          ? `Learned average: ~${formatMinutesToXhXX(digestiveTransitMins)} digestive interval (30-day history)`
          : `Standard digestive interval (~${formatMinutesToXhXX(digestiveTransitMins)})`;
      } else {
        mode = 'daytime_baseline';
        nextExpectedAt = standardExpectedAt;
        reason = learnedPoop.isLearned
          ? `Learned average: ~${formatMinutesToXhXX(learnedPoop.intervalMins)} digestive interval (30-day history)`
          : 'Standard digestive interval (~6h)';
      }
    }
  }

  const diffMins = (nextExpectedAt.getTime() - now.getTime()) / 60000;
  let urgency: 'safe' | 'soon' | 'overdue' = 'safe';
  if (mode !== 'night_sleep' && !isLastPoopConstipated) {
    if (diffMins <= 0) urgency = 'overdue';
    else if (diffMins <= 30) urgency = 'soon';
  }

  const deltaMins = mode === 'post_meal_override' ? learnedPostMealPoop.deltaMins : learnedPoop.deltaMins;

  return {
    nextExpectedAt,
    standardExpectedAt,
    deltaMins,
    mode,
    urgency,
    reason,
  };
}

/**
 * Predicts the next expected Food event using the decoupled Feeding Schedule Pipeline.
 */
export function predictNextFood(
  activities: Activity[],
  profile: PuppyProfile,
  now: Date = new Date(),
  options?: PredictorOptions
): FoodPredictionResult {
  const tz = options?.timeZone || getUserTimezone();
  const currentHour = getLocalHour(now, tz);
  const sleepSchedule = options?.sleepSchedule || detectSleepSchedule(activities, tz);
  const offsets = calculateMorningSequenceOffsets(activities, tz);

  const past = activities.filter((a) => parseIsoDate(a.timestamp).getTime() <= now.getTime());
  const sorted = [...past].sort((a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime());

  const { months } = getPuppyAge(profile.birthDate, now);
  const vetRecommendedMeals = months < 3 ? 4 : months < 6 ? 3 : 2;
  const targetMeals = Math.max(1, profile.targetMealsPerDay || vetRecommendedMeals);

  const todayDateStr = formatLocalDate(now, tz);
  const todayMeals = past.filter(
    (a) => a.type === 'food' && formatLocalDate(parseIsoDate(a.timestamp), tz) === todayDateStr
  );
  const todayGramTotal = todayMeals.reduce((sum, a) => sum + (a.quantityGrams || 0), 0);
  const isGramGoalMet = profile.dailyFoodGramGoal > 0 && todayGramTotal >= profile.dailyFoodGramGoal * 0.90;
  const isGoalReached = isGramGoalMet || (profile.dailyFoodGramGoal === 0 && todayMeals.length >= targetMeals);

  // Dynamic morning awakening window
  const isMorningWindow = currentHour >= (sleepSchedule.wakeupHour - 2) && currentHour < (sleepSchedule.wakeupHour + 3);
  const hasAwokenToday = sorted.some((a) => {
    const d = parseIsoDate(a.timestamp);
    return isSameLocalDate(d, now, tz) && getLocalHour(d, tz) >= (sleepSchedule.wakeupHour - 2);
  });

  const isApproaching = isApproachingBedtime(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
  const isCurrentlyNight = isNighttimeHour(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
  const isNightTime = (isMorningWindow ? !hasAwokenToday : true) && (isCurrentlyNight || isApproaching);

  // Today's scheduled breakfast time (for daytime schedule)
  const todayWakeup = getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.wakeupHour, tz, 0);
  const todayBreakfast = new Date(todayWakeup.getTime() + offsets.morningFoodOffsetMins * 60 * 1000);
  const todayBfastStr = formatLocalTime(todayBreakfast, tz);

  // Next upcoming morning breakfast (strictly in the future, for night sleep or goal reached)
  const nextWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
  const nextBreakfast = new Date(nextWakeup.getTime() + offsets.morningFoodOffsetMins * 60 * 1000);
  const nextBfastStr = formatLocalTime(nextBreakfast, tz);

  const effectiveBedtimeHour = sleepSchedule.bedtimeHour < sleepSchedule.wakeupHour
    ? sleepSchedule.bedtimeHour + 24
    : sleepSchedule.bedtimeHour;
  const lateEveningThresholdHour = Math.max(20, Math.floor(effectiveBedtimeHour - 1));
  const effectiveCurrentHour = (sleepSchedule.bedtimeHour < sleepSchedule.wakeupHour && currentHour < sleepSchedule.wakeupHour)
    ? currentHour + 24
    : currentHour;
  const isLateEveningCutoff = effectiveCurrentHour >= lateEveningThresholdHour;

  let nextExpectedAt: Date = todayBreakfast;
  let mode: FoodScheduleMode = 'daytime_schedule';
  let urgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let reason = '';

  if (isNightTime) {
    mode = 'night_sleep';
    nextExpectedAt = nextBreakfast;
    reason = `Night mode: Sleeping until morning breakfast (~${nextBfastStr})`;
  } else if (isGoalReached || isLateEveningCutoff) {
    mode = 'goal_reached';
    nextExpectedAt = nextBreakfast;
    reason = isGoalReached
      ? `Today's food goal reached (${todayGramTotal}g logged). Next: Breakfast tomorrow ~${nextBfastStr}`
      : `Evening mode: Next meal is breakfast tomorrow ~${nextBfastStr}`;
  } else if (todayMeals.length === 0) {
    nextExpectedAt = todayBreakfast;
    const minsUntilBreakfast = (todayBreakfast.getTime() - now.getTime()) / 60000;
    if (minsUntilBreakfast > 30) {
      reason = `Breakfast scheduled at ~${todayBfastStr} (Meal 1 of ${targetMeals})`;
    } else if (minsUntilBreakfast >= -60) {
      urgency = minsUntilBreakfast <= 15 ? 'soon' : 'safe';
      reason = `Morning breakfast due (~${todayBfastStr}, Meal 1 of ${targetMeals})`;
    } else {
      urgency = 'overdue';
      reason = `Breakfast overdue (expected ~${todayBfastStr}, Meal 1 of ${targetMeals})`;
    }
  } else {
    // Spaced daytime schedule for remaining meals
    const lastMealToday = todayMeals.reduce((latest, curr) =>
      parseIsoDate(curr.timestamp).getTime() > parseIsoDate(latest.timestamp).getTime() ? curr : latest
    , todayMeals[0]);
    const lastMealTime = parseIsoDate(lastMealToday.timestamp).getTime();

    const remainingMealsCount = Math.max(1, targetMeals - todayMeals.length);
    const effectiveBedtime = sleepSchedule.bedtimeHour < sleepSchedule.wakeupHour
      ? sleepSchedule.bedtimeHour + 24
      : sleepSchedule.bedtimeHour;
    const lastMealHour = getLocalHour(new Date(lastMealTime), tz);
    const wakingHoursLeft = Math.max(1, effectiveBedtime - lastMealHour);
    const idealIntervalHours = Math.max(2.5, Math.min(5.5, wakingHoursLeft / (remainingMealsCount + 1)));

    nextExpectedAt = new Date(lastMealTime + idealIntervalHours * 60 * 60 * 1000);
    const minsUntil = (nextExpectedAt.getTime() - now.getTime()) / 60000;

    if (minsUntil <= 0) urgency = 'overdue';
    else if (minsUntil <= 30) urgency = 'soon';

    reason = `Daytime meal schedule: Meal ${todayMeals.length + 1} of ${targetMeals} (spaced ~${idealIntervalHours.toFixed(1)}h)`;
  }

  const portionGrams = calculateNextMealPortion(
    profile.dailyFoodGramGoal,
    targetMeals,
    todayGramTotal,
    todayMeals.length
  );

  return {
    nextExpectedAt,
    deltaMins: 30,
    mode,
    urgency,
    reason,
    portionGrams,
  };
}

/**
 * Composite Facade: Advanced Predictive Potty & Feeding Schedules with Night Sleep Detection & Timezone Awareness.
 * Wraps predictNextPee, predictNextPoop, and predictNextFood for complete backwards compatibility.
 */
export function calculatePredictions(
  activities: Activity[],
  profile: PuppyProfile,
  referenceTime?: Date,
  timeZone?: string,
  customSleepSchedule?: SleepSchedule
): PredictionResult {
  const now = referenceTime || new Date();
  const tz = timeZone || getUserTimezone();
  const sleepSchedule = customSleepSchedule || detectSleepSchedule(activities, tz);
  const options: PredictorOptions = {
    timeZone: tz,
    sleepSchedule,
  };

  const peeResult = predictNextPee(activities, profile, now, options);
  const poopResult = predictNextPoop(activities, profile, now, options);
  const foodResult = predictNextFood(activities, profile, now, options);

  return {
    nextPeeExpectedAt: peeResult.nextExpectedAt,
    standardPeeExpectedAt: peeResult.standardExpectedAt,
    peeDeltaMins: peeResult.deltaMins,
    peeMode: peeResult.mode,
    peeUrgency: peeResult.urgency,
    peeReason: peeResult.reason,

    nextPoopExpectedAt: poopResult.nextExpectedAt,
    standardPoopExpectedAt: poopResult.standardExpectedAt,
    poopDeltaMins: poopResult.deltaMins,
    poopMode: poopResult.mode,
    poopUrgency: poopResult.urgency,
    poopReason: poopResult.reason,

    nextFoodExpectedAt: foodResult.nextExpectedAt,
    foodDeltaMins: foodResult.deltaMins,
    foodMode: foodResult.mode,
    foodUrgency: foodResult.urgency,
    foodReason: foodResult.reason,

    sleepSchedule,
    mealSchedule: detectMealSchedule(activities, tz),
    portionGrams: foodResult.portionGrams,
  };
}
