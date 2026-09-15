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
  isSameLogicalDate,
  getOccurrenceOfClockTimeInTimezone,
} from './date';

/**
 * Wrap-aware check: is the given hour within daytime (between wakeup and bedtime)?
 * Correctly handles schedules where bedtime wraps past midnight (e.g., bedtime=1, wakeup=7).
 */
function isDaytimeHour(hour: number, wakeupHour: number, bedtimeHour: number): boolean {
  if (bedtimeHour > wakeupHour) {
    return hour >= wakeupHour && hour < bedtimeHour;
  }
  // Wrapped schedule (e.g., wakeup=7, bedtime=1): daytime = 7..23, 0
  return hour >= wakeupHour || hour < bedtimeHour;
}

function isNighttimeHour(hour: number, wakeupHour: number, bedtimeHour: number): boolean {
  return !isDaytimeHour(hour, wakeupHour, bedtimeHour);
}

function isNightTimeMode(
  now: Date,
  activities: Activity[],
  sleepSchedule: SleepSchedule,
  timeZone?: string
): boolean {
  const tz = timeZone || getUserTimezone();
  const currentHour = getLocalDecimalHour(now, tz);
  const isCurrentlyNight = isNighttimeHour(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);

  if (!isCurrentlyNight) {
    return false;
  }

  // Find when the current sleep period began
  let lastBedtime = getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.bedtimeHour, tz, 0);
  if (lastBedtime.getTime() > now.getTime()) {
    lastBedtime = getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.bedtimeHour, tz, -1);
  }

  // During sleep hours: check if puppy already woke up early (a log that occurred after bedtime in the waking window)
  const hasAwokenToday = activities.some((activity) => {
    const activityDate = parseIsoDate(activity.timestamp);
    const logTime = activityDate.getTime();
    if (logTime <= lastBedtime.getTime()) return false;
    const logHour = getLocalDecimalHour(activityDate, tz);
    return isDaytimeHour(logHour, Math.max(4.0, sleepSchedule.wakeupHour - 3), sleepSchedule.bedtimeHour);
  });

  return !hasAwokenToday;
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
function getNextOccurrenceOfClockTime(referenceDate: Date, targetHourDecimal: number, timeZone?: string): Date {
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

      const firstM = Math.round(getLocalDecimalHour(firstMorning, tz) * 60);
      const lastHour = getLocalDecimalHour(last, tz);

      // Exponential time decay (7-day half-life so full week sets the schedule smoothly)
      const daysAgo = Math.max(0, (nowTime - last.getTime()) / (1000 * 60 * 60 * 24));
      const weight = Math.exp(-daysAgo / 7);

      morningData.push({ mins: firstM, weight });

      // Only consider last activity as bedtime candidate if it occurred in the evening/night
      if (lastHour >= 18 || lastHour < 5) {
        let lastM = Math.round(lastHour * 60);
        if (lastM < 12 * 60) {
          lastM += 24 * 60;
        }
        eveningData.push({ mins: lastM, weight });
      }
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
    const dateStr = formatLogicalDate(d, tz);
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
 * using exponential time-decay weighted medians (consistent with all other schedule detectors).
 */
export function detectMealSchedule(
  activities: Activity[],
  timeZone?: string
): { breakfastMins: number; lunchMins: number; dinnerMins: number } {
  const defaultMeals = { breakfastMins: 7 * 60 + 30, lunchMins: 12 * 60 + 30, dinnerMins: 19 * 60 + 30 };

  const maxLogTime = activities.reduce((max, act) => Math.max(max, parseIsoDate(act.timestamp).getTime()), 0);
  const nowTime = maxLogTime > 0 ? maxLogTime : Date.now();
  const thirtyDaysAgo = new Date(nowTime - 30 * 24 * 60 * 60 * 1000);
  const foodLogs = activities.filter(
    (activity) => activity.type === 'food' && parseIsoDate(activity.timestamp) >= thirtyDaysAgo
  );

  if (foodLogs.length < 3) return defaultMeals;

  const tz = timeZone || getUserTimezone();
  const bfasts: { mins: number; weight: number }[] = [];
  const lunches: { mins: number; weight: number }[] = [];
  const dinners: { mins: number; weight: number }[] = [];

  foodLogs.forEach((f) => {
    const d = parseIsoDate(f.timestamp);
    const m = Math.round(getLocalDecimalHour(d, tz) * 60);
    const daysAgo = Math.max(0, (nowTime - d.getTime()) / (1000 * 60 * 60 * 24));
    const weight = Math.exp(-daysAgo / 7);
    if (m >= 5 * 60 && m < 11 * 60) bfasts.push({ mins: m, weight });
    else if (m >= 11 * 60 && m < 16 * 60) lunches.push({ mins: m, weight });
    else if (m >= 16 * 60 && m <= 23 * 60 + 59) dinners.push({ mins: m, weight });
  });

  const breakfastMins = Math.round(calculateWeightedMedian(bfasts, defaultMeals.breakfastMins));
  const lunchMins = Math.round(calculateWeightedMedian(lunches, defaultMeals.lunchMins));
  const dinnerMins = Math.round(calculateWeightedMedian(dinners, defaultMeals.dinnerMins));

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
        const weight = Math.exp(-daysAgo / 10);
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
          // Exponential time decay: 10-day half-life tracks growth without getting hijacked by short vacations
          const daysAgo = Math.max(0, (nowTime - currTime.getTime()) / (1000 * 60 * 60 * 24));
          const weight = Math.exp(-daysAgo / 10);
          intervals.push({ diffMinutes, weight });
        }
      }
    }
  }

  if (intervals.length === 0) {
    return { intervalMins: fallbackMinutes, deltaMins: defaultDelta, sampleCount: 0, isLearned: false };
  }

  intervals.sort((itemA, itemB) => itemA.diffMinutes - itemB.diffMinutes);
  const totalWeight = intervals.reduce((sum, item) => sum + item.weight, 0);

  const getWeightedPercentile = (percentile: number): number => {
    const targetWeight = totalWeight * percentile;
    let accumulated = 0;
    for (const item of intervals) {
      accumulated += item.weight;
      if (accumulated >= targetWeight) return item.diffMinutes;
    }
    return intervals[intervals.length - 1].diffMinutes;
  };

  const p25 = getWeightedPercentile(0.25);
  // For pee, 70th percentile captures true biological bladder capacity by filtering out short opportunistic walks.
  // For poop, 50th percentile (median) tracks continuous 24/7 gastrointestinal transit.
  const targetPercentile = type === 'pee' ? 0.70 : 0.50;
  const learnedMinutes = Math.round(getWeightedPercentile(targetPercentile));
  const p75 = getWeightedPercentile(0.75);

  // Semi-IQR for dynamic ± delta margin
  const rawDelta = Math.round((p75 - p25) / 2);
  const minDelta = type === 'pee' ? 15 : 30;
  const maxDelta = type === 'pee' ? 45 : 90;
  const deltaMins = Math.max(minDelta, Math.min(rawDelta, maxDelta));

  const minInterval = type === 'pee' ? 30 : 180;
  const maxInterval = type === 'pee' ? 360 : 1440;

  return {
    intervalMins: Math.max(minInterval, Math.min(learnedMinutes, maxInterval)),
    deltaMins,
    sampleCount: intervals.length,
    isLearned: true,
  };
}

/**
 * Evaluates whether a puppy is eligible for post-meal potty override
 * based on canine neurological maturity (pudendal nerve myelination) and empirical data.
 */
export function shouldApplyPostMealOverride(
  ageMonths: number,
  learnedPostMeal: { isLearned: boolean; postMealRatio: number; foodCount?: number }
): boolean {
  if (ageMonths < 3.5) return true;
  const foodCount = learnedPostMeal.foodCount ?? (learnedPostMeal.isLearned ? 3 : 0);
  const threshold = ageMonths < 5.0 ? 0.40 : 0.50;
  if (foodCount >= 3) {
    return learnedPostMeal.postMealRatio >= threshold;
  }
  return ageMonths < 5.0;
}

/**
 * Learns puppy's post-meal potty interval (minutes between a food log and subsequent pee/poop).
 * Uses exponential recency weighting and semi-IQR tolerance, falling back to age baselines when < 3 samples exist.
 */
export function calculateLearnedPostMealDelayMinutes(
  activities: Activity[],
  pottyType: 'pee' | 'poop',
  fallbackMinutes: number,
  fallbackDeltaMinutes: number = pottyType === 'pee' ? 10 : 15
): { delayMins: number; deltaMins: number; sampleCount: number; foodCount: number; postMealRatio: number; isLearned: boolean } {
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

  const postMealRatio = foodLogs.length > 0 ? samples.length / foodLogs.length : 0;

  if (samples.length < 3) {
    return { delayMins: fallbackMinutes, deltaMins: defaultDelta, sampleCount: samples.length, foodCount: foodLogs.length, postMealRatio, isLearned: false };
  }

  const delayMins = Math.round(
    calculateWeightedMedian(
      samples.map((s) => ({ mins: s.diffMinutes, weight: s.weight })),
      fallbackMinutes
    )
  );

  // Semi-IQR for dynamic tolerance (weighted percentiles, consistent with weighted median)
  const sortedSamples = [...samples].sort((a, b) => a.diffMinutes - b.diffMinutes);
  const totalSampleWeight = sortedSamples.reduce((sum, item) => sum + item.weight, 0);
  const getWeightedPctl = (p: number): number => {
    const target = totalSampleWeight * p;
    let acc = 0;
    for (const item of sortedSamples) {
      acc += item.weight;
      if (acc >= target) return item.diffMinutes;
    }
    return sortedSamples[sortedSamples.length - 1].diffMinutes;
  };
  const q1 = getWeightedPctl(0.25);
  const q3 = getWeightedPctl(0.75);
  const semiIqr = Math.round(Math.max(5, Math.min(25, (q3 - q1) / 2 || defaultDelta)));

  return { delayMins, deltaMins: semiIqr, sampleCount: samples.length, foodCount: foodLogs.length, postMealRatio, isLearned: true };
}

/**
 * Resolves the relevant bedtime anchor for the current day/night cycle.
 * Correctly handles standard (bedtime > wakeup) and midnight-wrapping (bedtime < wakeup) schedules.
 */
function getRelevantBedtime(now: Date, sleepSchedule: SleepSchedule, timeZone: string): Date {
  const currentHour = getLocalDecimalHour(now, timeZone);
  const isWrapped = sleepSchedule.bedtimeHour < sleepSchedule.wakeupHour;

  if (isWrapped) {
    // Wrapping schedule (e.g. bedtime 00:30, wakeup 07:30)
    // During waking day (>= 07:30): bedtime is tonight past midnight (+1 calendar day)
    // During night (< 07:30): bedtime was tonight at 00:30 (0 calendar day)
    return getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.bedtimeHour, timeZone, currentHour >= sleepSchedule.wakeupHour ? 1 : 0);
  }

  // Standard schedule (e.g. bedtime 22:49, wakeup 08:38)
  // During night before wakeup (< 08:38): bedtime started yesterday (-1 calendar day)
  // During waking day / evening (>= 08:38): bedtime is tonight (0 calendar day)
  return getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.bedtimeHour, timeZone, currentHour < sleepSchedule.wakeupHour ? -1 : 0);
}

/**
 * Determines whether tonight's pre-bed potty outing must be preserved based on the puppy's learned interval.
 * Returns true if the puppy's voiding urge is at least 50% mature at bedtime (T_exp <= bedtime + interval / 2).
 */
function shouldPreservePreBedPotty(
  lastLogTime: number,
  intervalMins: number,
  now: Date,
  sleepSchedule: SleepSchedule,
  timeZone: string
): boolean {
  const bedtime = getRelevantBedtime(now, sleepSchedule, timeZone);
  const bufferMs = (intervalMins / 2) * 60 * 1000;

  // Pre-bed preservation only applies during waking evening or the immediate bedtime transition window
  if (now.getTime() > bedtime.getTime() + bufferMs) return false;

  const standardExpectedTime = lastLogTime + intervalMins * 60 * 1000;
  const isFromToday = lastLogTime >= bedtime.getTime() - 18 * 60 * 60 * 1000;
  const expiresBeforeSleep = standardExpectedTime <= bedtime.getTime() + bufferMs;

  return isFromToday && expiresBeforeSleep;
}

/**
 * Checks if a target time falls into deep sleep hours (past bedtime + interval/2 and before wakeup).
 */
function isDeepNightTime(
  targetTime: Date,
  intervalMins: number,
  sleepSchedule: SleepSchedule,
  timeZone: string,
  now?: Date
): boolean {
  if (now && targetTime.getTime() <= now.getTime()) return false;
  const targetHour = getLocalDecimalHour(targetTime, timeZone);
  if (!isNighttimeHour(targetHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour)) return false;
  const bedtime = getRelevantBedtime(targetTime, sleepSchedule, timeZone);
  return targetTime.getTime() > bedtime.getTime() + (intervalMins / 2) * 60 * 1000;
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
  const sleepSchedule = options?.sleepSchedule || detectSleepSchedule(activities, tz);

  const maxAllowedTime = now.getTime() + 60 * 1000;
  const past = activities.filter((a) => parseIsoDate(a.timestamp).getTime() <= maxAllowedTime);
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

  const isNightTime = isNightTimeMode(now, sorted, sleepSchedule, tz);
  const isDeepNight = isDeepNightTime(standardExpectedAt, learnedPee.intervalMins, sleepSchedule, tz, now);
  const preservePreBed = shouldPreservePreBedPotty(lastPeeTime, learnedPee.intervalMins, now, sleepSchedule, tz);

  let nextExpectedAt: Date = standardExpectedAt;
  let mode: ScheduleMode = 'daytime_baseline';
  let reason = '';
  const wakeH = Math.floor(sleepSchedule.wakeupHour);
  const wakeM = Math.round((sleepSchedule.wakeupHour - wakeH) * 60);
  const wakeupStr = sleepSchedule.wakeupStr || `${String(wakeH).padStart(2, '0')}:${String(wakeM).padStart(2, '0')}`;

  const todayPees = past.filter((a) => a.type === 'pee' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz));

  if (isNightTime && !preservePreBed) {
    mode = 'night_sleep';
    const targetWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);

    if (months < 2.5) {
      const midNightPee = new Date(lastPeeTime + 4 * 60 * 60 * 1000);
      if (midNightPee > now && midNightPee.getTime() < targetWakeup.getTime() - 45 * 60 * 1000) {
        nextExpectedAt = midNightPee;
        reason = 'Night mode: Young puppy mid-night potty break';
      } else {
        nextExpectedAt = targetWakeup;
        reason = `Morning outing (~${wakeupStr})`;
      }
    } else {
      nextExpectedAt = targetWakeup;
      reason = `Morning outing (~${wakeupStr})`;
    }
  } else if (todayPees.length === 0 && !isSameLogicalDate(lastPeeDate, now, tz) && !isNightTime) {
    // New day has started, puppy woke up after overnight sleep and hasn't peed yet today
    mode = 'daytime_baseline';
    const todayWakeup = getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.wakeupHour, tz, 0);
    nextExpectedAt = todayWakeup;
    reason = `Morning outing (~${wakeupStr})`;
  } else if (shouldApplyPostMealOverride(months, learnedPostMealPee) && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPeeTime) {
    const foodTime = parseIsoDate(lastFood.timestamp).getTime();
    const minsBetweenPeeAndMeal = Math.round((foodTime - lastPeeTime) / 60000);
    const minsSinceMeal = Math.round((now.getTime() - foodTime) / 60000);

    // If puppy emptied bladder shortly before meal (<= 30m before eating on a walk)
    const peedRightBeforeMeal = minsBetweenPeeAndMeal <= 30;

    if (peedRightBeforeMeal) {
      mode = 'daytime_baseline';
      nextExpectedAt = standardExpectedAt;
      reason = learnedPee.isLearned
        ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval`
        : `Standard bladder interval (~${formatMinutesToXhXX(learnedPee.intervalMins)})`;
    } else if (minsSinceMeal <= postMealPeeDelay + 40) {
      mode = 'post_meal_override';
      nextExpectedAt = new Date(foodTime + postMealPeeDelay * 60 * 1000);
      reason = `Post-meal potty break (~${postMealPeeDelay}m after food)`;
    } else {
      mode = 'daytime_baseline';
      nextExpectedAt = standardExpectedAt;
      reason = learnedPee.isLearned
        ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval`
        : `Standard bladder interval (~${formatMinutesToXhXX(learnedPee.intervalMins)})`;
    }
  } else {
    mode = (isNightTime && !preservePreBed) ? 'night_sleep' : 'daytime_baseline';
    if ((isNightTime || isDeepNight) && !preservePreBed) {
      const nextWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
      nextExpectedAt = nextWakeup;
      reason = `Morning outing (~${wakeupStr})`;
    } else {
      nextExpectedAt = standardExpectedAt;
      reason = learnedPee.isLearned
        ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval`
        : `Standard bladder interval (~${formatMinutesToXhXX(learnedPee.intervalMins)})`;
    }
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
  const sleepSchedule = options?.sleepSchedule || detectSleepSchedule(activities, tz);
  const offsets = calculateMorningSequenceOffsets(activities, tz);

  const maxAllowedTime = now.getTime() + 60 * 1000;
  const past = activities.filter((a) => parseIsoDate(a.timestamp).getTime() <= maxAllowedTime);
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

  const todayPoops = past.filter((a) => a.type === 'poop' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz));

  const isNightTime = isNightTimeMode(now, sorted, sleepSchedule, tz);
  const isDeepNight = isDeepNightTime(standardExpectedAt, learnedPoop.intervalMins, sleepSchedule, tz, now);
  const preservePreBed = shouldPreservePreBedPotty(lastPoopTime, learnedPoop.intervalMins, now, sleepSchedule, tz);

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
    // Smooth 60-minute rolling window: always target lastPoop + next 60m boundary
    const elapsedMins = (now.getTime() - lastPoopTime) / (60 * 1000);
    const nextBoundaryMins = Math.ceil(Math.max(elapsedMins, 1) / 60) * 60;
    nextExpectedAt = new Date(lastPoopTime + nextBoundaryMins * 60 * 1000);
    reason = 'Digestive alert: frequent checks recommended';
  } else if (isLastPoopConstipated && hoursSinceLastPoop < 16) {
    mode = 'daytime_baseline';
    const refractoryMinutes = Math.max(learnedPoop.intervalMins * 1.4, 480);
    nextExpectedAt = new Date(lastPoopTime + refractoryMinutes * 60 * 1000);
    reason = 'Digestive recovery: pause after hard stool';
  } else if (isNightTime && !preservePreBed) {
    mode = 'night_sleep';
    const targetWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
    nextExpectedAt = new Date(targetWakeup.getTime() + offsets.morningPoopOffsetMins * 60 * 1000);
    const targetTimeStr = formatLocalTime(nextExpectedAt, tz);
    reason = `Morning outing (~${targetTimeStr})`;
  } else if (todayPoops.length === 0 && !isSameLogicalDate(lastPoopDate, now, tz) && !isNightTime) {
    // New day has started, puppy woke up after overnight sleep and has not pooped yet today
    const todayMealsSorted = past
      .filter((a) => a.type === 'food' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz))
      .sort((a, b) => parseIsoDate(a.timestamp).getTime() - parseIsoDate(b.timestamp).getTime());

    const firstMorningPee = past.find(
      (a) => a.type === 'pee' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz)
    );
    const morningAnchor = firstMorningPee
      ? parseIsoDate(firstMorningPee.timestamp)
      : getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.wakeupHour, tz, 0);

    const todayMorningPoop = new Date(morningAnchor.getTime() + offsets.morningPoopOffsetMins * 60 * 1000);
    const targetTimeStr = formatLocalTime(todayMorningPoop, tz);

    let postMealOverride = false;
    if (todayMealsSorted.length > 0) {
      const latestMeal = todayMealsSorted[todayMealsSorted.length - 1];
      const foodTime = parseIsoDate(latestMeal.timestamp).getTime();
      const minsSinceMeal = Math.round((now.getTime() - foodTime) / 60000);

      if (shouldApplyPostMealOverride(months, learnedPostMealPoop) && minsSinceMeal <= postMealPoopDelay + 45) {
        postMealOverride = true;
        mode = 'post_meal_override';
        nextExpectedAt = new Date(foodTime + postMealPoopDelay * 60 * 1000);
        reason = `Post-meal poop break (~${postMealPoopDelay}m after food)`;
      }
    }

    if (!postMealOverride) {
      mode = 'daytime_baseline';
      nextExpectedAt = todayMorningPoop;
      reason = `Morning outing (~${targetTimeStr})`;
    }
  } else {
    let postMealOverride = false;
    if (shouldApplyPostMealOverride(months, learnedPostMealPoop) && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPoopTime) {
      const foodTime = parseIsoDate(lastFood.timestamp).getTime();
      const minsBetweenPoopAndMeal = Math.round((foodTime - lastPoopTime) / 60000);
      const minsSinceMeal = Math.round((now.getTime() - foodTime) / 60000);

      // If puppy emptied bowels right before eating (<= 30m before meal on a walk)
      const poopedRightBeforeMeal = minsBetweenPoopAndMeal <= 30;

      if (!poopedRightBeforeMeal && minsSinceMeal <= postMealPoopDelay + 45) {
        postMealOverride = true;
        mode = 'post_meal_override';
        nextExpectedAt = new Date(foodTime + postMealPoopDelay * 60 * 1000);
        reason = `Post-meal poop break (~${postMealPoopDelay}m after food)`;
      }
    }

    if (!postMealOverride) {
      mode = (isNightTime && !preservePreBed) ? 'night_sleep' : 'daytime_baseline';
      if ((isNightTime || isDeepNight) && !preservePreBed) {
        const nextWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
        nextExpectedAt = new Date(nextWakeup.getTime() + offsets.morningPoopOffsetMins * 60 * 1000);
        const targetTimeStr = formatLocalTime(nextExpectedAt, tz);
        reason = `Morning outing (~${targetTimeStr})`;
      } else {
        nextExpectedAt = standardExpectedAt;
        reason = learnedPoop.isLearned
          ? `Learned average: ~${formatMinutesToXhXX(learnedPoop.intervalMins)} digestive interval`
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
  const sleepSchedule = options?.sleepSchedule || detectSleepSchedule(activities, tz);

  const maxAllowedTime = now.getTime() + 60 * 1000;
  const past = activities.filter((a) => parseIsoDate(a.timestamp).getTime() <= maxAllowedTime);
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

  const isNightTime = isNightTimeMode(now, sorted, sleepSchedule, tz);
  const mealSchedule = options?.mealSchedule || detectMealSchedule(activities, tz);

  // Today's scheduled breakfast time (for daytime schedule)
  const scheduledBfastToday = getOccurrenceOfClockTimeInTimezone(now, mealSchedule.breakfastMins / 60, tz, 0);

  const firstMorningPee = past.find(
    (a) => a.type === 'pee' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz)
  );
  const minBfastAfterWalk = firstMorningPee
    ? new Date(parseIsoDate(firstMorningPee.timestamp).getTime() + 15 * 60 * 1000)
    : scheduledBfastToday;

  const todayBreakfast = scheduledBfastToday.getTime() >= minBfastAfterWalk.getTime()
    ? scheduledBfastToday
    : minBfastAfterWalk;
  const todayBfastStr = formatLocalTime(todayBreakfast, tz);

  // Next upcoming morning breakfast (strictly in the future, for night sleep or goal reached)
  const nextBreakfast = getNextOccurrenceOfClockTime(now, mealSchedule.breakfastMins / 60, tz);
  const nextBfastStr = formatLocalTime(nextBreakfast, tz);
  let nextExpectedAt: Date = todayBreakfast;
  let mode: FoodScheduleMode = 'daytime_schedule';
  let urgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let reason = '';

  if (isNightTime && !isGoalReached && todayMeals.length > 0 && todayMeals.length < targetMeals) {
    // Pre-bedtime meal preservation: daily goal not yet met, keep tonight's overdue meal
    mode = 'daytime_schedule';
    const lastMealToday = todayMeals.reduce((latest, curr) =>
      parseIsoDate(curr.timestamp).getTime() > parseIsoDate(latest.timestamp).getTime() ? curr : latest
    , todayMeals[0]);
    const lastMealTime = parseIsoDate(lastMealToday.timestamp).getTime();
    const remainingMealsCount = Math.max(1, targetMeals - todayMeals.length);
    const effectiveBedtime = sleepSchedule.bedtimeHour < sleepSchedule.wakeupHour
      ? sleepSchedule.bedtimeHour + 24
      : sleepSchedule.bedtimeHour;
    const lastMealHour = getLocalDecimalHour(new Date(lastMealTime), tz);
    const wakingHoursLeft = Math.max(1, effectiveBedtime - lastMealHour);
    const idealIntervalHours = Math.max(2.5, Math.min(5.5, wakingHoursLeft / (remainingMealsCount + 1)));
    nextExpectedAt = new Date(lastMealTime + idealIntervalHours * 60 * 60 * 1000);
    urgency = 'overdue';
    reason = todayMeals.length >= targetMeals
      ? `Remaining portion (spaced ~${idealIntervalHours.toFixed(1)}h)`
      : `Meal ${todayMeals.length + 1} of ${targetMeals} (spaced ~${idealIntervalHours.toFixed(1)}h)`;
  } else if (isNightTime) {
    mode = 'night_sleep';
    nextExpectedAt = nextBreakfast;
    reason = `Breakfast (~${nextBfastStr}, Meal 1 of ${targetMeals})`;
  } else if (isGoalReached) {
    mode = 'goal_reached';
    nextExpectedAt = nextBreakfast;
    reason = `Daily goal reached (${todayGramTotal}g)`;
  } else if (todayMeals.length === 0) {
    nextExpectedAt = todayBreakfast;
    const minsUntilBreakfast = (todayBreakfast.getTime() - now.getTime()) / 60000;
    if (minsUntilBreakfast <= 0) {
      urgency = 'overdue';
    } else if (minsUntilBreakfast <= 15) {
      urgency = 'soon';
    } else {
      urgency = 'safe';
    }
    reason = `Breakfast (~${todayBfastStr}, Meal 1 of ${targetMeals})`;
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
    const lastMealHour = getLocalDecimalHour(new Date(lastMealTime), tz);
    const wakingHoursLeft = Math.max(1, effectiveBedtime - lastMealHour);
    const idealIntervalHours = Math.max(2.5, Math.min(5.5, wakingHoursLeft / (remainingMealsCount + 1)));

    nextExpectedAt = new Date(lastMealTime + idealIntervalHours * 60 * 60 * 1000);
    const minsUntil = (nextExpectedAt.getTime() - now.getTime()) / 60000;

    if (minsUntil <= 0) urgency = 'overdue';
    else if (minsUntil <= 30) urgency = 'soon';

    reason = todayMeals.length >= targetMeals
      ? `Remaining portion (spaced ~${idealIntervalHours.toFixed(1)}h)`
      : `Meal ${todayMeals.length + 1} of ${targetMeals} (spaced ~${idealIntervalHours.toFixed(1)}h)`;
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
  const mealSchedule = detectMealSchedule(activities, tz);
  const options: PredictorOptions = {
    timeZone: tz,
    sleepSchedule,
    mealSchedule,
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
    mealSchedule,
    portionGrams: foodResult.portionGrams,
  };
}
