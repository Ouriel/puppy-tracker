import type { Activity, PredictionResult, PuppyProfile, ScheduleMode, FoodScheduleMode } from '../types';
import { parseIsoDate, formatLocalDate, formatMinutesToXhXX, getLocalHour, getUserTimezone } from './date';

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

/**
 * Wrap-aware check: is the given hour within nighttime?
 */
function isNighttimeHour(hour: number, wakeupHour: number, bedtimeHour: number): boolean {
  return !isDaytimeHour(hour, wakeupHour, bedtimeHour);
}

/**
 * Wrap-aware waking hours calculation.
 * For wakeup=7.2, bedtime=22.2: returns 15.
 */
function getWakingHours(wakeupHour: number, bedtimeHour: number): number {
  return ((bedtimeHour - wakeupHour) + 24) % 24;
}

export function getPuppyAge(birthDateIso: string): { weeks: number; months: number; text: string } {
  const birth = parseIsoDate(birthDateIso);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - birth.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(diffDays / 7);
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
 * Calculates veterinary recommended daily food gram intake based on weight and growth stage (RER / MER)
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
 * Learns puppy's exact night sleep schedule (bedtime & morning wakeup) with minute precision from activity logs
 */
export function detectSleepSchedule(
  activities: Activity[],
  timeZone?: string
): { bedtimeHour: number; wakeupHour: number; bedtimeStr: string; wakeupStr: string } {
  const defaultSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((activity) => parseIsoDate(activity.timestamp) >= thirtyDaysAgo);
  const targetLogs = recentActivities.length >= 5 ? recentActivities : activities;

  if (targetLogs.length < 5) return defaultSchedule;

  const tz = timeZone || getUserTimezone();
  const byDate: Record<string, Date[]> = {};

  targetLogs.forEach((activity) => {
    const d = parseIsoDate(activity.timestamp);
    const dateStr = formatLocalDate(d, tz);
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(d);
  });

  const morningMins: number[] = [];
  const eveningMins: number[] = [];

  Object.values(byDate).forEach((logs) => {
    if (logs.length >= 2) {
      const sortedLogs = [...logs].sort((a, b) => a.getTime() - b.getTime());
      const first = sortedLogs[0];
      const last = sortedLogs[sortedLogs.length - 1];

      const firstM = getLocalHour(first, tz) * 60 + first.getMinutes();
      const lastM = getLocalHour(last, tz) * 60 + last.getMinutes();

      if (firstM >= 4 * 60 && firstM <= 10 * 60) morningMins.push(firstM);
      if (lastM >= 19 * 60 || lastM <= 3 * 60) eveningMins.push(lastM >= 19 * 60 ? lastM : lastM + 24 * 60);
    }
  });

  const avgWakeMins = morningMins.length ? Math.round(morningMins.reduce((a, b) => a + b, 0) / morningMins.length) : 7 * 60;
  const avgBedMins = eveningMins.length ? Math.round(eveningMins.reduce((a, b) => a + b, 0) / eveningMins.length) % (24 * 60) : 22 * 60;

  const wakeupHour = avgWakeMins / 60;
  const bedtimeHour = avgBedMins / 60;

  const wH = Math.floor(avgWakeMins / 60);
  const wM = avgWakeMins % 60;
  const bH = Math.floor(avgBedMins / 60);
  const bM = avgBedMins % 60;

  const wakeupStr = `${String(wH).padStart(2, '0')}:${String(wM).padStart(2, '0')}`;
  const bedtimeStr = `${String(bH).padStart(2, '0')}:${String(bM).padStart(2, '0')}`;

  return { bedtimeHour, wakeupHour, bedtimeStr, wakeupStr };
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
  sleepSchedule = { bedtimeHour: 22, wakeupHour: 7 },
  timeZone?: string
): { intervalMins: number; deltaMins: number; sampleCount: number; isLearned: boolean } {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((activity) => parseIsoDate(activity.timestamp) >= thirtyDaysAgo);
  const targetActivities = recentActivities.length >= 5 ? recentActivities : activities;

  const sortedLogs = [...targetActivities]
    .filter((activity) => activity.type === type)
    .sort((activityA, activityB) => parseIsoDate(activityA.timestamp).getTime() - parseIsoDate(activityB.timestamp).getTime());

  const defaultDelta = type === 'pee' ? 20 : type === 'poop' ? 25 : 30;

  if (sortedLogs.length < 2) {
    return { intervalMins: fallbackMinutes, deltaMins: defaultDelta, sampleCount: sortedLogs.length, isLearned: false };
  }

  // Filter daytime gaps occurring between morning wakeup and bedtime
  const minThresholdMins = type === 'pee' ? 45 : 90; // Exclude short double-void walk pees (<45m) and same-walk poops (<90m)
  const nowTime = Date.now();
  const intervals: { diffMinutes: number; weight: number }[] = [];

  for (let i = 1; i < sortedLogs.length; i++) {
    const prevTime = parseIsoDate(sortedLogs[i - 1].timestamp);
    const currTime = parseIsoDate(sortedLogs[i].timestamp);
    const diffMinutes = (currTime.getTime() - prevTime.getTime()) / (1000 * 60);

    if (diffMinutes >= minThresholdMins && diffMinutes <= 14 * 60) {
      const prevHour = getLocalHour(prevTime, timeZone);
      const currHour = getLocalHour(currTime, timeZone);

      const isPrevDay = isDaytimeHour(prevHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);
      const isCurrDay = isDaytimeHour(currHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);

      if (isPrevDay && isCurrDay) {
        // Exponential time decay: 7-day half-life so recent days count significantly more as puppy grows
        const daysAgo = Math.max(0, (nowTime - currTime.getTime()) / (1000 * 60 * 60 * 24));
        const weight = Math.exp(-daysAgo / 7);
        intervals.push({ diffMinutes, weight });
      }
    }
  }

  if (intervals.length === 0) {
    return { intervalMins: fallbackMinutes, deltaMins: defaultDelta, sampleCount: 0, isLearned: false };
  }

  // Sort by interval duration for percentile calculation
  const sorted = [...intervals].sort((a, b) => a.diffMinutes - b.diffMinutes);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);

  // Compute weighted percentiles (P25, P50/Median, P75)
  const getWeightedPercentile = (p: number): number => {
    const target = totalWeight * p;
    let acc = 0;
    for (let i = 0; i < sorted.length; i++) {
      acc += sorted[i].weight;
      if (acc >= target) return sorted[i].diffMinutes;
    }
    return sorted[sorted.length - 1].diffMinutes;
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
  const maxInterval = type === 'pee' ? 360 : 720;

  return {
    intervalMins: Math.max(minInterval, Math.min(medianMinutes, maxInterval)),
    deltaMins,
    sampleCount: intervals.length,
    isLearned: true,
  };
}

/**
 * Advanced Predictive Potty & Feeding Schedules with Night Sleep Detection & Timezone Awareness
 */
export function calculatePredictions(
  activities: Activity[],
  profile: PuppyProfile,
  referenceTime?: Date,
  timeZone?: string
): PredictionResult {
  const tz = timeZone || getUserTimezone();
  const now = referenceTime || new Date();
  const currentHour = getLocalHour(now, tz);

  const pastActivities = activities.filter((activity) => parseIsoDate(activity.timestamp).getTime() <= now.getTime());

  const sleepSchedule = detectSleepSchedule(pastActivities, tz);
  const mealSchedule = detectMealSchedule(pastActivities, tz);
  const isCurrentlyNight = isNighttimeHour(currentHour, sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour);

  const sorted = [...pastActivities].sort(
    (activityA, activityB) => parseIsoDate(activityB.timestamp).getTime() - parseIsoDate(activityA.timestamp).getTime()
  );

  const lastPee = sorted.find((activity) => activity.type === 'pee');
  const lastPoop = sorted.find((activity) => activity.type === 'poop');
  const lastFood = sorted.find((activity) => activity.type === 'food');

  const { months } = getPuppyAge(profile.birthDate);
  const baseBladderHours = Math.max(1, Math.min(months, 4));
  const fallbackPeeIntervalMins = baseBladderHours * 60;

  const learnedPee = calculateLearnedIntervalMinutes(pastActivities, 'pee', fallbackPeeIntervalMins, sleepSchedule, tz);
  const learnedPoop = calculateLearnedIntervalMinutes(pastActivities, 'poop', 360, sleepSchedule, tz);

  // 1. Pee Prediction
  let nextPeeExpectedAt: Date | null = null;
  let standardPeeExpectedAt: Date | null = null;
  let peeMode: ScheduleMode = 'daytime_baseline';
  let peeUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let peeReason = '';

  if (lastPee) {
    const lastPeeDate = parseIsoDate(lastPee.timestamp);
    const lastPeeTime = lastPeeDate.getTime();

    standardPeeExpectedAt = new Date(lastPeeTime + learnedPee.intervalMins * 60 * 1000);

    const isApproachingBedtime = currentHour >= Math.floor(sleepSchedule.bedtimeHour - 1);
    const isNightTime = isCurrentlyNight || isApproachingBedtime;

    if (isNightTime) {
      peeMode = 'night_sleep';
      const targetWakeup = new Date(now);
      if (currentHour >= Math.floor(sleepSchedule.bedtimeHour)) {
        targetWakeup.setDate(targetWakeup.getDate() + 1);
      }
      const wakeH = Math.floor(sleepSchedule.wakeupHour);
      const wakeM = Math.round((sleepSchedule.wakeupHour - wakeH) * 60);
      targetWakeup.setHours(wakeH, wakeM, 0, 0);

      if (months < 2.5) {
        const midNightPee = new Date(lastPeeTime + 4 * 60 * 60 * 1000);
        if (midNightPee > now) {
          nextPeeExpectedAt = midNightPee;
          peeReason = 'Night mode: Young puppy mid-night potty break';
        } else {
          nextPeeExpectedAt = targetWakeup;
          peeReason = `Night mode: Sleeping until ~${sleepSchedule.wakeupStr} morning wakeup`;
        }
      } else {
        nextPeeExpectedAt = targetWakeup;
        peeReason = `Night mode: Sleeping until ~${sleepSchedule.wakeupStr} morning wakeup`;
      }
    } else if (months < 8 && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPeeTime) {
      const foodTime = parseIsoDate(lastFood.timestamp).getTime();
      const minsSinceMeal = Math.round((now.getTime() - foodTime) / (1000 * 60));

      if (minsSinceMeal <= 60) {
        peeMode = 'post_meal_override';
        const postFoodPee = new Date(foodTime + 20 * 60 * 1000);
        nextPeeExpectedAt = postFoodPee;

        if (minsSinceMeal > 25) {
          peeReason = `Pup fed ${formatMinutesToXhXX(minsSinceMeal)} ago — post-meal potty break is overdue!`;
        } else {
          peeReason = `Pup fed recently (${formatMinutesToXhXX(minsSinceMeal)} ago). Pees ~15-20m post-meal.`;
        }
      } else {
        peeMode = 'daytime_baseline';
        nextPeeExpectedAt = standardPeeExpectedAt;
        peeReason = learnedPee.isLearned
          ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval (30-day history)`
          : `Based on ~${formatMinutesToXhXX(learnedPee.intervalMins)} age bladder capacity`;
      }
    } else {
      peeMode = 'daytime_baseline';
      nextPeeExpectedAt = standardPeeExpectedAt;
      peeReason = learnedPee.isLearned
        ? `Learned average: ~${formatMinutesToXhXX(learnedPee.intervalMins)} bladder interval (30-day history)`
        : `Based on ~${formatMinutesToXhXX(learnedPee.intervalMins)} age bladder capacity`;
    }

    if (nextPeeExpectedAt) {
      const minsUntilPee = (nextPeeExpectedAt.getTime() - now.getTime()) / (1000 * 60);
      if (isCurrentlyNight && minsUntilPee > -120) {
        peeUrgency = 'safe';
      } else if (minsUntilPee <= 0) {
        peeUrgency = 'overdue';
      } else if (minsUntilPee <= 20) {
        peeUrgency = 'soon';
      } else {
        peeUrgency = 'safe';
      }
    }
  } else {
    peeReason = 'No pee recorded yet';
  }

  // 2. Poop Prediction
  let nextPoopExpectedAt: Date | null = null;
  let standardPoopExpectedAt: Date | null = null;
  let poopMode: ScheduleMode = 'daytime_baseline';
  let poopUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let poopReason = '';

  if (lastPoop) {
    const lastPoopDate = parseIsoDate(lastPoop.timestamp);
    const lastPoopTime = lastPoopDate.getTime();

    standardPoopExpectedAt = new Date(lastPoopTime + learnedPoop.intervalMins * 60 * 1000);

    const isApproachingBedtime = currentHour >= Math.floor(sleepSchedule.bedtimeHour - 1);
    const isNightTime = isCurrentlyNight || isApproachingBedtime;

    // Constipation mode ONLY applies if the MOST RECENT poop was hard or noted huge/constipated
    const isLastPoopConstipated = lastPoop.stoolConsistency === 'hard' ||
      (lastPoop.notes || '').toLowerCase().match(/huge|gros|big|grand|constipat/) !== null;
    const hoursSinceLastPoop = (now.getTime() - lastPoopTime) / (1000 * 60 * 60);

    if (isNightTime) {
      poopMode = 'night_sleep';
      const targetMorningPoop = new Date(now);
      if (currentHour >= Math.floor(sleepSchedule.bedtimeHour - 2)) {
        targetMorningPoop.setDate(targetMorningPoop.getDate() + 1);
      }
      const wakeH = Math.min(23, Math.floor(sleepSchedule.wakeupHour) + 1);
      const wakeM = Math.round((sleepSchedule.wakeupHour - Math.floor(sleepSchedule.wakeupHour)) * 60);
      targetMorningPoop.setHours(wakeH, wakeM, 0, 0);
      nextPoopExpectedAt = targetMorningPoop;
      poopReason = `Night mode: Sleeping overnight. Expected post-breakfast (~${String(wakeH).padStart(2,'0')}:${String(wakeM).padStart(2,'0')})`;
    } else if (isLastPoopConstipated && hoursSinceLastPoop < 16) {
      poopMode = 'daytime_baseline';
      const refractoryMinutes = Math.max(learnedPoop.intervalMins * 1.4, 480);
      nextPoopExpectedAt = new Date(lastPoopTime + refractoryMinutes * 60 * 1000);
      poopReason = 'Digestive system recovering from recent hard stool. Colon refilling after meals.';
      poopUrgency = 'safe';
    } else if (months < 8 && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPoopTime) {
      const foodTime = parseIsoDate(lastFood.timestamp).getTime();
      const minsSinceMeal = Math.round((now.getTime() - foodTime) / (1000 * 60));

      if (minsSinceMeal <= 90) {
        poopMode = 'post_meal_override';
        const postFoodPoopTime = foodTime + 35 * 60 * 1000;
        nextPoopExpectedAt = new Date(postFoodPoopTime);

        if (minsSinceMeal > 45) {
          poopReason = `Pup fed ${formatMinutesToXhXX(minsSinceMeal)} ago — post-meal poop break (gastrocolic reflex) is overdue!`;
        } else {
          poopReason = `Pup fed recently (${formatMinutesToXhXX(minsSinceMeal)} ago). Gastrocolic reflex triggers poop ~30-45m post-meal.`;
        }
      } else {
        const todayDateStr = formatLocalDate(now, tz);
        const todayMealsSorted = pastActivities
          .filter((activity) => activity.type === 'food' && formatLocalDate(parseIsoDate(activity.timestamp), tz) === todayDateStr)
          .sort((actA, actB) => parseIsoDate(actA.timestamp).getTime() - parseIsoDate(actB.timestamp).getTime());

        const todayPoops = pastActivities.filter(
          (activity) => activity.type === 'poop' && formatLocalDate(parseIsoDate(activity.timestamp), tz) === todayDateStr
        );

        if (todayMealsSorted.length > 0 && todayPoops.length === 0) {
          poopMode = 'daytime_baseline';
          const latestMealTime = parseIsoDate(todayMealsSorted[todayMealsSorted.length - 1].timestamp).getTime();
          const digestiveTransitMins = Math.max(240, learnedPoop.intervalMins);
          nextPoopExpectedAt = new Date(latestMealTime + digestiveTransitMins * 60 * 1000);
          poopReason = `Fed ${todayMealsSorted.length}× today, no poop yet. Expected ~${formatMinutesToXhXX(digestiveTransitMins)} after last meal.`;
        } else {
          poopMode = 'daytime_baseline';
          nextPoopExpectedAt = standardPoopExpectedAt;
          poopReason = learnedPoop.isLearned
            ? `Learned average: ~${formatMinutesToXhXX(learnedPoop.intervalMins)} digestive interval (30-day history)`
            : 'Standard digestive interval (~6h)';
        }
      }
    } else {
      const todayDateStr = formatLocalDate(now, tz);
      const todayMealsSorted = pastActivities
        .filter((activity) => activity.type === 'food' && formatLocalDate(parseIsoDate(activity.timestamp), tz) === todayDateStr)
        .sort((actA, actB) => parseIsoDate(actA.timestamp).getTime() - parseIsoDate(actB.timestamp).getTime());

      const todayPoops = pastActivities.filter(
        (activity) => activity.type === 'poop' && formatLocalDate(parseIsoDate(activity.timestamp), tz) === todayDateStr
      );

      if (todayMealsSorted.length > 0 && todayPoops.length === 0 && months < 10) {
        poopMode = 'daytime_baseline';
        const latestMealTime = parseIsoDate(todayMealsSorted[todayMealsSorted.length - 1].timestamp).getTime();
        const digestiveTransitMins = Math.max(240, learnedPoop.intervalMins);
        nextPoopExpectedAt = new Date(latestMealTime + digestiveTransitMins * 60 * 1000);
        poopReason = `Fed ${todayMealsSorted.length}× today, no poop yet. Expected ~${formatMinutesToXhXX(digestiveTransitMins)} after last meal.`;
      } else {
        poopMode = 'daytime_baseline';
        nextPoopExpectedAt = standardPoopExpectedAt;
        poopReason = learnedPoop.isLearned
          ? `Learned average: ~${formatMinutesToXhXX(learnedPoop.intervalMins)} digestive interval (30-day history)`
          : 'Standard digestive interval (~6h)';
      }
    }

    if (nextPoopExpectedAt && !isLastPoopConstipated) {
      const minsUntilPoop = (nextPoopExpectedAt.getTime() - now.getTime()) / (1000 * 60);
      if (isCurrentlyNight && minsUntilPoop > -120) {
        poopUrgency = 'safe';
      } else if (minsUntilPoop <= 0) {
        poopUrgency = 'overdue';
      } else if (minsUntilPoop <= 25) {
        poopUrgency = 'soon';
      } else {
        poopUrgency = 'safe';
      }
    }
  } else {
    poopReason = 'No poop recorded yet';
  }

  // 3. Food Prediction (Learned Meal Schedule & Daily Goal Tracking)
  let nextFoodExpectedAt: Date | null = null;
  let foodMode: FoodScheduleMode = 'daytime_schedule';
  let foodUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let foodReason = '';

  const vetRecommendedMeals = months < 3 ? 4 : months < 6 ? 3 : 2;
  const targetMeals = Math.max(1, profile.targetMealsPerDay || vetRecommendedMeals);

  const todayDateStr = formatLocalDate(now, tz);
  const todayMeals = pastActivities.filter(
    (activity) => activity.type === 'food' && formatLocalDate(parseIsoDate(activity.timestamp), tz) === todayDateStr
  );
  const todayGramTotal = todayMeals.reduce((sum, activity) => sum + (activity.quantityGrams ?? 80), 0);
  const isGoalReached = (profile.dailyFoodGramGoal > 0 && todayGramTotal >= profile.dailyFoodGramGoal) || todayMeals.length >= targetMeals;

  // Use learned meal times (breakfast, lunch, dinner)
  const targetBreakfastToday = new Date(now);
  const bfastH = Math.floor(mealSchedule.breakfastMins / 60);
  const bfastM = mealSchedule.breakfastMins % 60;
  targetBreakfastToday.setHours(bfastH, bfastM, 0, 0);

  const bfastStr = `${String(bfastH).padStart(2, '0')}:${String(bfastM).padStart(2, '0')}`;

  const lateEveningFoodHour = Math.max(19, Math.floor(sleepSchedule.bedtimeHour - 2));

  if (isCurrentlyNight) {
    foodMode = 'night_sleep';
    const targetBreakfastTomorrow = new Date(now);
    if (currentHour >= Math.floor(sleepSchedule.bedtimeHour)) {
      targetBreakfastTomorrow.setDate(targetBreakfastTomorrow.getDate() + 1);
    }
    targetBreakfastTomorrow.setHours(bfastH, bfastM, 0, 0);
    nextFoodExpectedAt = targetBreakfastTomorrow;
    foodUrgency = 'safe';
    foodReason = `Night mode: Puppy sleeping until breakfast at ~${bfastStr}`;
  } else if (isGoalReached || currentHour >= lateEveningFoodHour) {
    foodMode = 'goal_reached';
    const targetBreakfastTomorrow = new Date(now);
    targetBreakfastTomorrow.setDate(targetBreakfastTomorrow.getDate() + 1);
    targetBreakfastTomorrow.setHours(bfastH, bfastM, 0, 0);
    nextFoodExpectedAt = targetBreakfastTomorrow;
    foodUrgency = 'safe';
    foodReason = isGoalReached
      ? `Today's food goal reached (${todayGramTotal}g / ${targetMeals} meals). Next: Breakfast tomorrow ~${bfastStr}`
      : `Evening mode: Next meal is breakfast tomorrow ~${bfastStr}`;
  } else if (todayMeals.length === 0) {
    foodMode = 'daytime_schedule';
    nextFoodExpectedAt = targetBreakfastToday;
    const minsUntilBreakfast = (targetBreakfastToday.getTime() - now.getTime()) / (1000 * 60);

    if (minsUntilBreakfast > 30) {
      foodUrgency = 'safe';
      foodReason = `Puppy resting. Breakfast scheduled at ~${bfastStr} (Meal 1 of ${targetMeals})`;
    } else if (minsUntilBreakfast >= -60) {
      foodUrgency = minsUntilBreakfast <= 15 ? 'soon' : 'safe';
      foodReason = `Morning breakfast due (~${bfastStr}, Meal 1 of ${targetMeals})`;
    } else {
      foodUrgency = 'overdue';
      foodReason = `Breakfast overdue (expected ~${bfastStr}, Meal 1 of ${targetMeals})`;
    }
  } else {
    foodMode = 'daytime_schedule';
    const lastMealToday = todayMeals.reduce((latest, current) => {
      return parseIsoDate(current.timestamp).getTime() > parseIsoDate(latest.timestamp).getTime() ? current : latest;
    }, todayMeals[0]);

    const lastMealTime = parseIsoDate(lastMealToday.timestamp).getTime();
    const daytimeWakingHours = Math.max(10, getWakingHours(sleepSchedule.wakeupHour, sleepSchedule.bedtimeHour));
    const mealIntervalHours = targetMeals > 1 ? daytimeWakingHours / targetMeals : daytimeWakingHours;

    nextFoodExpectedAt = new Date(lastMealTime + mealIntervalHours * 60 * 60 * 1000);
    const formattedInterval = (Math.round(mealIntervalHours * 10) / 10).toString();
    foodReason = `Daytime meal schedule: ${todayMeals.length}/${targetMeals} meals logged today (~every ${formattedInterval}h)`;

    const minsUntilFood = (nextFoodExpectedAt.getTime() - now.getTime()) / (1000 * 60);
    if (minsUntilFood <= -30) {
      foodUrgency = 'overdue';
    } else if (minsUntilFood <= 30) {
      foodUrgency = 'soon';
    } else {
      foodUrgency = 'safe';
    }
  }

  const peeDeltaMins = peeMode === 'post_meal_override' ? 10 : learnedPee.deltaMins;
  const poopDeltaMins = poopMode === 'post_meal_override' ? 15 : learnedPoop.deltaMins;
  const foodDeltaMins = 30;

  return {
    nextPeeExpectedAt,
    standardPeeExpectedAt,
    peeDeltaMins,
    peeMode,
    peeUrgency,
    peeReason,
    nextPoopExpectedAt,
    standardPoopExpectedAt,
    poopDeltaMins,
    poopMode,
    poopUrgency,
    poopReason,
    nextFoodExpectedAt,
    foodDeltaMins,
    foodMode,
    foodUrgency,
    foodReason,
  };
}
