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
    // Night ends with a log after 05:00 (or wake-up - 3 h if later): a 04:xx night potty does not wake the household
    return isDaytimeHour(logHour, Math.max(5.0, sleepSchedule.wakeupHour - 3), sleepSchedule.bedtimeHour);
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
 * Meals per day for the dog's age: 4 under 3 months, 3 under 6 months, then 2.
 * The engine's fallback when a profile has none, and the meals box default for a new dog.
 */
export function getRecommendedMealsPerDay(birthDateIso: string, targetDate: Date = new Date()): number {
  const { months } = getPuppyAge(birthDateIso, targetDate);
  return months < 3 ? 4 : months < 6 ? 3 : 2;
}

/**
 * Calculates remaining portion grams for the next meal given daily goal and meals logged today.
 * Undefined for a dog with no gram goal (0): its meals are only counted.
 */
export function calculateNextMealPortion(
  dailyGramGoal: number = 200,
  targetMealsPerDay: number = 3,
  loggedGramsToday: number = 0,
  loggedMealsCountToday: number = 0
): number | undefined {
  if (!(dailyGramGoal > 0)) return undefined;
  const goal = dailyGramGoal;
  const targetMeals = targetMealsPerDay || 3;
  const remainingGrams = Math.max(0, goal - loggedGramsToday);
  const remainingMeals = Math.max(1, targetMeals - loggedMealsCountToday);
  const portion = Math.round(remainingGrams / remainingMeals);
  return Number.isNaN(portion) ? Math.round(goal / targetMeals) : portion;
}

/**
 * Today's gram goal counts as reached at 90 % (the meal card's 'Daily goal reached').
 */
export function isDailyGramGoalMet(dailyGramGoal: number, loggedGramsToday: number): boolean {
  return dailyGramGoal > 0 && loggedGramsToday >= dailyGramGoal * 0.9;
}

/**
 * Grams to suggest for the next meal (feed button label and meal box), or undefined once today's goal is reached.
 */
export function suggestNextMealGrams(
  dailyGramGoal: number,
  targetMealsPerDay: number,
  loggedGramsToday: number,
  loggedMealsCountToday: number
): number | undefined {
  if (isDailyGramGoalMet(dailyGramGoal, loggedGramsToday)) return undefined;
  return calculateNextMealPortion(dailyGramGoal, targetMealsPerDay, loggedGramsToday, loggedMealsCountToday);
}

/**
 * Converts kibble grams to cups (110 g per cup), rounded to 2 decimals.
 */
export function gramsToCups(grams: number): number {
  return Math.round((grams / 110) * 100) / 100;
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

  // One evening of logs would set the whole schedule (wake-up at 19:00): keep the default until 3 days have 2+ logs
  if (Object.values(byDate).filter((logs) => logs.length >= 2).length < 3) return defaultSchedule;

  const morningData: { mins: number; weight: number }[] = [];
  const eveningData: { mins: number; weight: number }[] = [];

  Object.values(byDate).forEach((logs) => {
    if (logs.length >= 2) {
      const sortedLogs = [...logs].sort((a, b) => a.getTime() - b.getTime());
      // First activity of the day after 05:00 AM (filters out mid-night potty breaks)
      const firstMorning = sortedLogs.find((a) => getLocalHour(a, tz) >= 5) || sortedLogs[0];
      // A log between 02:00 and 05:00 is a night potty, not the day's bedtime.
      // ponytail: a night potty logged before 02:00 still reads as the bedtime; telling them apart needs the gap before it
      const last = sortedLogs.findLast((log) => { const hour = getLocalHour(log, tz); return hour < 2 || hour >= 5; }) ?? sortedLogs[sortedLogs.length - 1];

      const firstM = Math.round(getLocalDecimalHour(firstMorning, tz) * 60);
      const lastHour = getLocalDecimalHour(last, tz);

      // Exponential time decay (7-day time constant, half-life about 5 days, so a full week sets the schedule smoothly)
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
 * Calculates the empirical morning poop offset (minutes from the first morning pee to the first poop),
 * learned from the household's morning logs; 10 min until there is one.
 */
export function calculateMorningSequenceOffsets(
  activities: Activity[],
  timeZone?: string
): { morningPoopOffsetMins: number } {
  const defaultOffsets = { morningPoopOffsetMins: 10 };
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

  Object.values(byDate).forEach((dayLogs) => {
    const sorted = [...dayLogs].sort(
      (a, b) => parseIsoDate(a.timestamp).getTime() - parseIsoDate(b.timestamp).getTime()
    );

    const firstPee = sorted.find((a) => a.type === 'pee' && getLocalHour(parseIsoDate(a.timestamp), tz) >= 5);
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
  });

  const morningPoopOffsetMins = Math.round(calculateWeightedMedian(poopOffsets, defaultOffsets.morningPoopOffsetMins));

  return { morningPoopOffsetMins };
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
 * Highest learned daytime pee interval: a healthy adult dog holds 6-8 h in the day, and a puppy
 * (age in months + 1) h below that. Overnight holding is handled by night mode, which has no such cap.
 */
const PEE_INTERVAL_CEILING_HOURS = 8;

/**
 * Calculates adaptive average daytime interval between activities using exponential time decay
 * (prioritizing recent days as puppy grows) and computes dynamic ± delta tolerances via semi-IQR.
 * `ageMonths` (the dog's age now) sets the pee ceiling; without it, the adult PEE_INTERVAL_CEILING_HOURS.
 */
export function calculateLearnedIntervalMinutes(
  activities: Activity[],
  type: 'pee' | 'poop' | 'food',
  fallbackMinutes: number,
  sleepSchedule: SleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' },
  timeZone?: string,
  ageMonths?: number
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

        // An interval spans overnight sleep if it ends on a later logical day (04:00 cutoff) than it starts
        const crossesNight = !isSameLogicalDate(prevTime, currTime, timeZone);

        // Allow valid waking retention intervals (including pre-bedtime outings around midnight)
        if (isPrevDay && isCurrDay && !crossesNight) {
          // Exponential time decay: 10-day time constant (half-life about 7 days) tracks growth without getting hijacked by short vacations
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
  const maxInterval = type === 'pee' ? Math.min((ageMonths ?? Infinity) + 1, PEE_INTERVAL_CEILING_HOURS) * 60 : 1440;

  return {
    intervalMins: Math.max(minInterval, Math.min(learnedMinutes, maxInterval)),
    deltaMins,
    sampleCount: intervals.length,
    isLearned: true,
  };
}

/**
 * Evaluates whether a puppy is eligible for post-meal potty override
 * based on its age and its own post-meal logs.
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
 * Returns true until bedtime + windowMins if the voiding urge is at least 50% mature at bedtime (T_exp <= bedtime + interval / 2).
 */
function shouldPreservePreBedPotty(
  lastLogTime: number,
  intervalMins: number,
  windowMins: number,
  now: Date,
  sleepSchedule: SleepSchedule,
  timeZone: string
): boolean {
  const bedtime = getRelevantBedtime(now, sleepSchedule, timeZone);

  // Pre-bed preservation only applies during waking evening or the immediate bedtime transition window
  if (now.getTime() > bedtime.getTime() + windowMins * 60 * 1000) return false;

  const standardExpectedTime = lastLogTime + intervalMins * 60 * 1000;
  const isFromToday = lastLogTime >= bedtime.getTime() - 18 * 60 * 60 * 1000;
  const expiresBeforeSleep = standardExpectedTime <= bedtime.getTime() + (intervalMins / 2) * 60 * 1000;

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
 * Wake-up pee of `now`'s logical day: the earliest pee at or after 05:00, if any.
 * Same rule as calculateMorningSequenceOffsets, so a night potty does not anchor the morning.
 * `newestFirst` must be sorted newest first.
 */
function findFirstMorningPee(newestFirst: Activity[], now: Date, timeZone: string): Activity | undefined {
  const peesToday = newestFirst.filter(
    (activity) => activity.type === 'pee' && isSameLogicalDate(parseIsoDate(activity.timestamp), now, timeZone)
  );
  return peesToday.findLast((activity) => getLocalHour(parseIsoDate(activity.timestamp), timeZone) >= 5);
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
  const learnedPee = calculateLearnedIntervalMinutes(past, 'pee', fallbackPeeIntervalMins, sleepSchedule, tz, months);

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

  const foodTime = lastFood ? parseIsoDate(lastFood.timestamp).getTime() : 0;
  const isAfterMeal = shouldApplyPostMealOverride(months, learnedPostMealPee) && lastFood !== undefined && foodTime > lastPeeTime;
  const minsBetweenPeeAndMeal = Math.round((foodTime - lastPeeTime) / 60000);
  const minsSinceMeal = Math.round((now.getTime() - foodTime) / 60000);
  // If puppy emptied bladder shortly before meal (<= 30m before eating on a walk)
  const peedRightBeforeMeal = minsBetweenPeeAndMeal <= 30;
  const isPostMealReminder = isAfterMeal && !peedRightBeforeMeal && minsSinceMeal <= postMealPeeDelay + 40;

  const isNightTime = isNightTimeMode(now, sorted, sleepSchedule, tz);
  const isDeepNight = isDeepNightTime(standardExpectedAt, learnedPee.intervalMins, sleepSchedule, tz, now);
  // The pee pre-bed outing ends at bedtime + half the interval, at most 90 min: half a long interval would keep an overdue card until about bedtime + 4 h.
  // A post-meal reminder keeps the uncapped bedtime + half the interval.
  const preBedWindowMins = isPostMealReminder ? learnedPee.intervalMins / 2 : Math.min(learnedPee.intervalMins / 2, 90);
  const preservePreBed = shouldPreservePreBedPotty(lastPeeTime, learnedPee.intervalMins, preBedWindowMins, now, sleepSchedule, tz);

  let nextExpectedAt: Date = standardExpectedAt;
  let mode: ScheduleMode = 'daytime_baseline';
  let reason = '';
  const wakeH = Math.floor(sleepSchedule.wakeupHour);
  const wakeM = Math.round((sleepSchedule.wakeupHour - wakeH) * 60);
  const wakeupStr = sleepSchedule.wakeupStr || `${String(wakeH).padStart(2, '0')}:${String(wakeM).padStart(2, '0')}`;

  const todayPees = past.filter((a) => a.type === 'pee' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz));

  // Night target, at night and for an evening pee due in the deep night: a puppy under 2.5 months gets a break 4 h after
  // its last pee while that is 45 min or more before wake-up, kept 30 min as 'due now'; otherwise the next wake-up.
  // ponytail: 2.5 months, not 4 (owner's P5, on hold): a logged break before 02:00 reads as bedtime, a 2nd break can fall
  // after 05:00 and end the night, and from 2.5 months a held break can show red in the daytime branch; fix those first
  const nextWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
  const midNightPeeTime = lastPeeTime + 4 * 60 * 60 * 1000;
  const isMidNightBreak = months < 2.5
    && midNightPeeTime > now.getTime() - 30 * 60 * 1000
    && midNightPeeTime < nextWakeup.getTime() - 45 * 60 * 1000;
  const nightTarget = isMidNightBreak ? new Date(Math.max(midNightPeeTime, now.getTime())) : nextWakeup;
  const nightReason = isMidNightBreak ? 'Night mode: Young puppy mid-night potty break' : `Morning outing (~${wakeupStr})`;

  if (isNightTime && !preservePreBed) {
    mode = 'night_sleep';
    nextExpectedAt = nightTarget;
    reason = nightReason;
  } else if (todayPees.length === 0 && !isNightTime) {
    // New day has started, puppy woke up after overnight sleep and hasn't peed yet today
    mode = 'daytime_baseline';
    const todayWakeup = getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.wakeupHour, tz, 0);
    nextExpectedAt = todayWakeup;
    reason = `First pee of the day (~${wakeupStr})`;
  } else if (isPostMealReminder) {
    mode = 'post_meal_override';
    nextExpectedAt = new Date(foodTime + postMealPeeDelay * 60 * 1000);
    reason = `Post-meal potty break (~${postMealPeeDelay}m after food)`;
  } else {
    mode = 'daytime_baseline';
    if (isDeepNight && !preservePreBed) {
      nextExpectedAt = nightTarget;
      reason = nightReason;
    } else {
      nextExpectedAt = standardExpectedAt;
      reason = learnedPee.isLearned
        ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval`
        : `Standard bladder interval (~${formatMinutesToXhXX(learnedPee.intervalMins)})`;
    }
  }

  const diffMins = (nextExpectedAt.getTime() - now.getTime()) / 60000;
  let urgency: 'safe' | 'soon' | 'overdue' = 'safe';
  // Night targets (morning outing, young-puppy mid-night break) show soon in their last 20 min, never overdue
  if (diffMins <= 0 && mode !== 'night_sleep') urgency = 'overdue';
  else if (diffMins <= 20) urgency = 'soon';

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

  const maxAllowedTime = now.getTime() + 60 * 1000;
  const past = activities.filter((a) => parseIsoDate(a.timestamp).getTime() <= maxAllowedTime);
  const sorted = [...past].sort((a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime());
  const offsets = calculateMorningSequenceOffsets(past, tz);

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
  // Hard stool: pause for max(1.4 x the interval, 8 h); the badge stays safe until the pause ends,
  // and the standard time never lands before it (no "overdue by hours" when the pause ends)
  const isHardStool = lastPoop.stoolConsistency === 'hard';
  const recoveryEnd = lastPoopTime + Math.max(learnedPoop.intervalMins * 1.4, 480) * 60 * 1000;
  const isInRecovery = isHardStool && now.getTime() < recoveryEnd;
  const standardExpectedAt = new Date(isHardStool ? recoveryEnd : lastPoopTime + learnedPoop.intervalMins * 60 * 1000);

  const todayPoops = past.filter((a) => a.type === 'poop' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz));

  const isNightTime = isNightTimeMode(now, sorted, sleepSchedule, tz);
  const isDeepNight = isDeepNightTime(standardExpectedAt, learnedPoop.intervalMins, sleepSchedule, tz, now);
  // Unlike pee, the poop pre-bed outing ends at bedtime + 1 h: half its long interval would run until about 04:00
  const preservePreBed = shouldPreservePreBedPotty(lastPoopTime, learnedPoop.intervalMins, 60, now, sleepSchedule, tz);

  // Diarrhoea alert from the stool choice only (legacy 'runny' shows as Diarrhoea): notes and legacy 'soft' do not start it
  const hoursSinceLastPoop = (now.getTime() - lastPoopTime) / (1000 * 60 * 60);
  const isDigestiveAlert = (lastPoop.stoolConsistency === 'diarrhea' || lastPoop.stoolConsistency === 'runny') && hoursSinceLastPoop < 12;

  let nextExpectedAt: Date = standardExpectedAt;
  let mode: ScheduleMode = 'daytime_baseline';
  let reason = '';

  if (isDigestiveAlert) {
    mode = 'daytime_baseline';
    // Smooth 60-minute rolling window: always target lastPoop + next 60m boundary
    const elapsedMins = (now.getTime() - lastPoopTime) / (60 * 1000);
    const nextBoundaryMins = Math.ceil(Math.max(elapsedMins, 1) / 60) * 60;
    nextExpectedAt = new Date(lastPoopTime + nextBoundaryMins * 60 * 1000);
    reason = 'Digestive alert: frequent checks recommended';
  } else if (isInRecovery) {
    mode = 'daytime_baseline';
    nextExpectedAt = new Date(recoveryEnd);
    reason = 'Digestive recovery: pause after hard stool';
  } else if (isNightTime && !preservePreBed) {
    mode = 'night_sleep';
    const targetWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
    nextExpectedAt = new Date(targetWakeup.getTime() + offsets.morningPoopOffsetMins * 60 * 1000);
    const targetTimeStr = formatLocalTime(nextExpectedAt, tz);
    reason = `Morning outing (~${targetTimeStr})`;
  } else if (todayPoops.length === 0 && !isNightTime) {
    // New day has started, puppy woke up after overnight sleep and has not pooped yet today
    const todayMealsSorted = past
      .filter((a) => a.type === 'food' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz))
      .sort((a, b) => parseIsoDate(a.timestamp).getTime() - parseIsoDate(b.timestamp).getTime());

    const firstMorningPee = findFirstMorningPee(sorted, now, tz);
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
      reason = `First poop of the day (~${targetTimeStr})`;
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
      mode = 'daytime_baseline';
      if (isDeepNight && !preservePreBed) {
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

  // After a hard stool no card points before the pause end: the morning or post-meal times would read "overdue by hours"
  if (isHardStool && nextExpectedAt.getTime() < recoveryEnd) {
    mode = 'daytime_baseline';
    nextExpectedAt = new Date(recoveryEnd);
    reason = 'Digestive recovery: pause after hard stool';
  }

  const diffMins = (nextExpectedAt.getTime() - now.getTime()) / 60000;
  let urgency: 'safe' | 'soon' | 'overdue' = 'safe';
  if (mode !== 'night_sleep' && !isInRecovery) {
    if (diffMins <= 0) urgency = 'overdue';
    else if (diffMins <= 30) urgency = 'soon';
  }
  // Hourly checks after diarrhoea: a steady amber badge for the 12 h, night included, never red on the hour
  if (isDigestiveAlert) urgency = 'soon';

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

  const vetRecommendedMeals = getRecommendedMealsPerDay(profile.birthDate, now);
  const targetMeals = Math.max(1, profile.targetMealsPerDay || vetRecommendedMeals);

  const todayMeals = past.filter(
    (a) => a.type === 'food' && isSameLogicalDate(parseIsoDate(a.timestamp), now, tz)
  );
  const todayGramTotal = Math.round(todayMeals.reduce((sum, a) => sum + (a.quantityGrams || 0), 0));
  const isGramGoalMet = isDailyGramGoalMet(profile.dailyFoodGramGoal, todayGramTotal);
  const isGoalReached = isGramGoalMet || (profile.dailyFoodGramGoal === 0 && todayMeals.length >= targetMeals);

  const isNightTime = isNightTimeMode(now, sorted, sleepSchedule, tz);
  const mealSchedule = options?.mealSchedule || detectMealSchedule(activities, tz);

  // Today's scheduled breakfast time (for daytime schedule)
  const scheduledBfastToday = getOccurrenceOfClockTimeInTimezone(now, mealSchedule.breakfastMins / 60, tz, 0);

  const firstMorningPee = findFirstMorningPee(sorted, now, tz);
  // Breakfast comes after the morning pee, or after wake-up while no morning pee is logged
  const minBfastAfterWalk = firstMorningPee
    ? new Date(parseIsoDate(firstMorningPee.timestamp).getTime() + 15 * 60 * 1000)
    : getOccurrenceOfClockTimeInTimezone(now, sleepSchedule.wakeupHour, tz, 0);

  const todayBreakfast = scheduledBfastToday.getTime() >= minBfastAfterWalk.getTime()
    ? scheduledBfastToday
    : minBfastAfterWalk;
  const todayBfastStr = formatLocalTime(todayBreakfast, tz);

  // Next breakfast (night sleep or goal reached): the breakfast time on the next wake-up's day, never before that wake-up
  const nextWakeup = getNextOccurrenceOfClockTime(now, sleepSchedule.wakeupHour, tz);
  const nextBreakfast = new Date(Math.max(
    nextWakeup.getTime(),
    getOccurrenceOfClockTimeInTimezone(nextWakeup, mealSchedule.breakfastMins / 60, tz, 0).getTime()
  ));
  const nextBfastStr = formatLocalTime(nextBreakfast, tz);
  let nextExpectedAt: Date = todayBreakfast;
  let mode: FoodScheduleMode = 'daytime_schedule';
  let urgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let reason = '';

  // A missed meal stops at bedtime: night mode shows tomorrow's breakfast
  if (isNightTime) {
    mode = 'night_sleep';
    nextExpectedAt = nextBreakfast;
    reason = `Breakfast (~${nextBfastStr}, Meal 1 of ${targetMeals})`;
  } else if (isGoalReached) {
    mode = 'goal_reached';
    nextExpectedAt = nextBreakfast;
    reason = profile.dailyFoodGramGoal > 0
      ? `Daily goal reached (${todayGramTotal}g)`
      : `Daily goal reached (${todayMeals.length} meal${todayMeals.length === 1 ? '' : 's'})`;
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
    // A meal after midnight belongs to the evening before (04:00 day): 00:10 is hour 24.17, not 0.17
    const lastMealClockHour = getLocalDecimalHour(new Date(lastMealTime), tz);
    const lastMealHour = lastMealClockHour < 4 ? lastMealClockHour + 24 : lastMealClockHour;
    const wakingHoursLeft = Math.max(1, effectiveBedtime - lastMealHour);
    const idealIntervalHours = Math.max(2.5, wakingHoursLeft / (remainingMealsCount + 1));

    // An extra 'Remaining portion' meal is a reminder: due now at the latest, never overdue
    const isExtraPortion = todayMeals.length >= targetMeals;
    nextExpectedAt = new Date(Math.max(lastMealTime + idealIntervalHours * 60 * 60 * 1000, isExtraPortion ? now.getTime() : 0));
    const minsUntil = (nextExpectedAt.getTime() - now.getTime()) / 60000;

    if (minsUntil <= 0 && !isExtraPortion) urgency = 'overdue';
    else if (minsUntil <= 30) urgency = 'soon';

    reason = isExtraPortion
      ? `Remaining portion (spaced ~${idealIntervalHours.toFixed(1)}h)`
      : `Meal ${todayMeals.length + 1} of ${targetMeals} (spaced ~${idealIntervalHours.toFixed(1)}h)`;
  }

  // ponytail: no UI reads portionGrams (App and PredictorWidget call calculateNextMealPortion themselves); kept only
  // because tests pin it on the engine's logical-day meal count (0 g after midnight once the day's goal is eaten).
  // Remove it from FoodPredictionResult/PredictionResult and its tests in the Phase 8 refactor.
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
 * R10: the logs at most 1 minute after `now`. A future-dated log (typo) would become the schedules' "now"
 * and empty their learning windows; the dashboard's today totals use the same rule.
 */
export function excludeFutureLogs(activities: Activity[], now: Date): Activity[] {
  const maxAllowedTime = now.getTime() + 60 * 1000;
  return activities.filter((activity) => parseIsoDate(activity.timestamp).getTime() <= maxAllowedTime);
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
  // The last 14 days only, what the app loads at start: "Load more" in the history must not change the cards
  const past = excludeFutureLogs(activities, now).filter(
    (activity) => parseIsoDate(activity.timestamp).getTime() >= now.getTime() - 14 * 24 * 60 * 60 * 1000
  );
  const sleepSchedule = customSleepSchedule || detectSleepSchedule(past, tz);
  const mealSchedule = detectMealSchedule(past, tz);
  const options: PredictorOptions = {
    timeZone: tz,
    sleepSchedule,
    mealSchedule,
  };

  const peeResult = predictNextPee(past, profile, now, options);
  const poopResult = predictNextPoop(past, profile, now, options);
  const foodResult = predictNextFood(past, profile, now, options);

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
