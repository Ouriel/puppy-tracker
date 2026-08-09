import type { Activity, PredictionResult, PuppyProfile } from '../types';
import { parseIsoDate, formatLocalDate } from './date';

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
  const rer = 70 * Math.pow(weightKg, 0.75);
  const merMultiplier = ageMonths < 4 ? 3.0 : ageMonths < 12 ? 2.0 : 1.6;
  const dailyKcal = rer * merMultiplier;
  const kcalPerGram = 3.8; // Standard AAFCO growth kibble density (~380 kcal/cup)
  return Math.round(dailyKcal / kcalPerGram);
}

/**
 * Learns puppy's typical night sleep schedule (bedtime & morning wakeup) from activity logs
 */
export function detectSleepSchedule(activities: Activity[]): { bedtimeHour: number; wakeupHour: number } {
  const defaultSchedule = { bedtimeHour: 22, wakeupHour: 7 }; // 10:00 PM to 7:00 AM

  // Filter logs to last 30 days to avoid historical bloat & reflect current sleep patterns
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((activity) => parseIsoDate(activity.timestamp) >= thirtyDaysAgo);
  const targetLogs = recentActivities.length >= 5 ? recentActivities : activities;

  if (targetLogs.length < 5) return defaultSchedule;

  const eveningHours: number[] = [];
  const morningHours: number[] = [];

  targetLogs.forEach((activity) => {
    const hr = parseIsoDate(activity.timestamp).getHours();
    if (hr >= 20 || hr <= 3) {
      eveningHours.push(hr >= 20 ? hr : hr + 24);
    } else if (hr >= 4 && hr <= 10) {
      morningHours.push(hr);
    }
  });

  const bedtimeHour = eveningHours.length >= 3
    ? Math.round(eveningHours.reduce((s, h) => s + h, 0) / eveningHours.length) % 24
    : 22;

  const wakeupHour = morningHours.length >= 3
    ? Math.round(morningHours.reduce((s, h) => s + h, 0) / morningHours.length)
    : 7;

  return { bedtimeHour, wakeupHour };
}

/**
 * Calculates adaptive average daytime interval between activities based on history
 */
export function calculateLearnedIntervalMinutes(
  activities: Activity[],
  type: 'pee' | 'poop' | 'food',
  fallbackMinutes: number,
  sleepSchedule = { bedtimeHour: 22, wakeupHour: 7 }
): { intervalMins: number; sampleCount: number; isLearned: boolean } {
  // Use last 30 days of activities to reflect current puppy age & capacity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentActivities = activities.filter((activity) => parseIsoDate(activity.timestamp) >= thirtyDaysAgo);
  const targetActivities = recentActivities.length >= 5 ? recentActivities : activities;

  const sortedLogs = [...targetActivities]
    .filter((activity) => activity.type === type)
    .sort((activityA, activityB) => parseIsoDate(activityA.timestamp).getTime() - parseIsoDate(activityB.timestamp).getTime());

  if (sortedLogs.length < 2) {
    return { intervalMins: fallbackMinutes, sampleCount: sortedLogs.length, isLearned: false };
  }

  // Filter daytime gaps (occurring between morning wakeup and bedtime, ignoring overnight gaps)
  const intervals: number[] = [];
  for (let i = 1; i < sortedLogs.length; i++) {
    const prevTime = parseIsoDate(sortedLogs[i - 1].timestamp);
    const currTime = parseIsoDate(sortedLogs[i].timestamp);

    const diffMinutes = (currTime.getTime() - prevTime.getTime()) / (1000 * 60);

    // Filter out multi-day lapses (> 12 hours) or negative timestamps
    if (diffMinutes >= 15 && diffMinutes <= 12 * 60) {
      const prevHour = prevTime.getHours();
      const currHour = currTime.getHours();

      // Check if both events happened during active daytime hours
      const isPrevDay = prevHour >= sleepSchedule.wakeupHour && prevHour < sleepSchedule.bedtimeHour;
      const isCurrDay = currHour >= sleepSchedule.wakeupHour && currHour < sleepSchedule.bedtimeHour;

      if (isPrevDay && isCurrDay) {
        intervals.push(diffMinutes);
      }
    }
  }

  if (intervals.length === 0) {
    return { intervalMins: fallbackMinutes, sampleCount: 0, isLearned: false };
  }

  // Median average calculation
  const sortedIntervals = [...intervals].sort((intervalA, intervalB) => intervalA - intervalB);
  const midIndex = Math.floor(sortedIntervals.length / 2);
  const medianMinutes = sortedIntervals.length % 2 !== 0
    ? sortedIntervals[midIndex]
    : Math.round((sortedIntervals[midIndex - 1] + sortedIntervals[midIndex]) / 2);

  return {
    intervalMins: Math.max(30, Math.min(medianMinutes, 360)), // clamp between 30 min and 6 hours
    sampleCount: intervals.length,
    isLearned: true,
  };
}

/**
 * Advanced Predictive Potty & Feeding Schedules with Night Sleep Detection
 */
export function calculatePredictions(activities: Activity[], profile: PuppyProfile, referenceTime?: Date): PredictionResult {
  const now = referenceTime || new Date();
  const currentHour = now.getHours();

  const sleepSchedule = detectSleepSchedule(activities);
  const isCurrentlyNight = currentHour >= sleepSchedule.bedtimeHour || currentHour < sleepSchedule.wakeupHour;

  const sorted = [...activities].sort(
    (activityA, activityB) => parseIsoDate(activityB.timestamp).getTime() - parseIsoDate(activityA.timestamp).getTime()
  );

  const lastPee = sorted.find((activity) => activity.type === 'pee');
  const lastPoop = sorted.find((activity) => activity.type === 'poop');
  const lastFood = sorted.find((activity) => activity.type === 'food');

  const { months } = getPuppyAge(profile.birthDate);
  const baseBladderHours = Math.max(1, Math.min(months, 4));
  const fallbackPeeIntervalMins = baseBladderHours * 60;

  // Learn personalized daytime pee & poop intervals
  const learnedPee = calculateLearnedIntervalMinutes(activities, 'pee', fallbackPeeIntervalMins, sleepSchedule);
  const learnedPoop = calculateLearnedIntervalMinutes(activities, 'poop', 300, sleepSchedule); // 5h fallback

  // 1. Pee Prediction
  let nextPeeExpectedAt: Date | null = null;
  let standardPeeExpectedAt: Date | null = null;
  let peeUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let peeReason = '';

  if (lastPee) {
    const lastPeeDate = parseIsoDate(lastPee.timestamp);
    const lastPeeTime = lastPeeDate.getTime();
    const lastPeeHour = lastPeeDate.getHours();

    standardPeeExpectedAt = new Date(lastPeeTime + learnedPee.intervalMins * 60 * 1000);

    const isLateEveningPee = lastPeeHour >= sleepSchedule.bedtimeHour - 1 || lastPeeHour < sleepSchedule.wakeupHour;

    if (isLateEveningPee || isCurrentlyNight) {
      const targetWakeup = new Date(now);
      if (currentHour >= sleepSchedule.bedtimeHour) {
        targetWakeup.setDate(targetWakeup.getDate() + 1);
      }
      targetWakeup.setHours(sleepSchedule.wakeupHour, 0, 0, 0);

      if (months < 2.5) {
        const midNightPee = new Date(lastPeeTime + 4 * 60 * 60 * 1000);
        if (midNightPee > now) {
          nextPeeExpectedAt = midNightPee;
          peeReason = 'Night mode: Young puppy mid-night potty break';
        } else {
          nextPeeExpectedAt = targetWakeup;
          peeReason = `Night mode: Sleeping until ~${sleepSchedule.wakeupHour}:00 AM morning wakeup`;
        }
      } else {
        nextPeeExpectedAt = targetWakeup;
        peeReason = `Night mode: Sleeping until ~${sleepSchedule.wakeupHour}:00 AM morning wakeup`;
      }
    } else if (lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPeeTime) {
      const foodTime = parseIsoDate(lastFood.timestamp).getTime();
      const postFoodPee = new Date(foodTime + 20 * 60 * 1000);
      const minsSinceMeal = Math.round((now.getTime() - foodTime) / (1000 * 60));

      nextPeeExpectedAt = postFoodPee;

      if (minsSinceMeal > 25) {
        peeReason = `Pup fed ${minsSinceMeal}m ago — post-meal potty break is overdue!`;
      } else {
        peeReason = `Pup fed recently (${minsSinceMeal}m ago). Pees ~15-20m post-meal.`;
      }
    } else {
      nextPeeExpectedAt = standardPeeExpectedAt;
      peeReason = learnedPee.isLearned
        ? `Adaptive AI: Learned ~${learnedPee.intervalMins}m average bladder interval`
        : `Based on ~${Math.round(learnedPee.intervalMins)}m age bladder capacity`;
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
  let poopUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let poopReason = '';

  if (lastPoop) {
    const lastPoopDate = parseIsoDate(lastPoop.timestamp);
    const lastPoopTime = lastPoopDate.getTime();
    const lastPoopHour = lastPoopDate.getHours();

    standardPoopExpectedAt = new Date(lastPoopTime + learnedPoop.intervalMins * 60 * 1000);

    const isEveningPoop = lastPoopHour >= 19 || lastPoopHour < sleepSchedule.wakeupHour;

    if (isEveningPoop || isCurrentlyNight) {
      const targetMorningPoop = new Date(now);
      if (currentHour >= 19) {
        targetMorningPoop.setDate(targetMorningPoop.getDate() + 1);
      }
      targetMorningPoop.setHours(sleepSchedule.wakeupHour + 1, 0, 0, 0); // ~8:00 AM post-breakfast
      nextPoopExpectedAt = targetMorningPoop;
      poopReason = `Night mode: Sleeping overnight. Expected post-breakfast (~${sleepSchedule.wakeupHour + 1}:00 AM)`;
    } else if (lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPoopTime) {
      const foodTime = parseIsoDate(lastFood.timestamp).getTime();
      const postFoodPoopTime = foodTime + 35 * 60 * 1000;
      const minsSinceMeal = Math.round((now.getTime() - foodTime) / (1000 * 60));

      nextPoopExpectedAt = new Date(postFoodPoopTime);

      if (minsSinceMeal > 45) {
        poopReason = `Pup fed ${minsSinceMeal}m ago — post-meal poop break (gastrocolic reflex) is overdue!`;
      } else {
        poopReason = `Pup fed recently (${minsSinceMeal}m ago). Gastrocolic reflex triggers poop ~30-45m post-meal.`;
      }
    } else {
      nextPoopExpectedAt = standardPoopExpectedAt;
      poopReason = learnedPoop.isLearned
        ? `Adaptive AI: Learned ~${(learnedPoop.intervalMins / 60).toFixed(1)}h average digest interval`
        : 'Standard digestive interval (~5h)';
    }

    if (nextPoopExpectedAt) {
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

  // 3. Food Prediction (Veterinary Standard, Sleep-Aware & Smart Daytime Schedule)
  let nextFoodExpectedAt: Date | null = null;
  let foodUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let foodReason = '';

  const vetRecommendedMeals = months < 3 ? 4 : months < 6 ? 3 : 2;
  const targetMeals = Math.max(1, profile.targetMealsPerDay || vetRecommendedMeals);

  const todayDateStr = formatLocalDate(now);
  const todayMeals = activities.filter(
    (activity) => activity.type === 'food' && formatLocalDate(parseIsoDate(activity.timestamp)) === todayDateStr
  );
  const todayGramTotal = todayMeals.reduce((sum, activity) => sum + (activity.quantityGrams || 80), 0);
  const isGoalReached = (profile.dailyFoodGramGoal > 0 && todayGramTotal >= profile.dailyFoodGramGoal) || todayMeals.length >= targetMeals;

  const targetBreakfastToday = new Date(now);
  targetBreakfastToday.setHours(sleepSchedule.wakeupHour, 30, 0, 0);

  if (isCurrentlyNight) {
    // Night mode: puppy is sleeping until morning
    const targetBreakfastTomorrow = new Date(now);
    if (currentHour >= sleepSchedule.bedtimeHour) {
      targetBreakfastTomorrow.setDate(targetBreakfastTomorrow.getDate() + 1);
    }
    targetBreakfastTomorrow.setHours(sleepSchedule.wakeupHour, 30, 0, 0);
    nextFoodExpectedAt = targetBreakfastTomorrow;
    foodUrgency = 'safe';
    foodReason = `Night mode: Puppy sleeping until breakfast at ~${sleepSchedule.wakeupHour}:30 AM`;
  } else if (isGoalReached || currentHour >= 20) {
    // Goal reached or late evening: next meal is breakfast tomorrow
    const targetBreakfastTomorrow = new Date(now);
    targetBreakfastTomorrow.setDate(targetBreakfastTomorrow.getDate() + 1);
    targetBreakfastTomorrow.setHours(sleepSchedule.wakeupHour, 30, 0, 0);
    nextFoodExpectedAt = targetBreakfastTomorrow;
    foodUrgency = 'safe';
    foodReason = isGoalReached
      ? `Today's food goal reached (${todayGramTotal}g / ${targetMeals} meals). Next: Breakfast tomorrow ~${sleepSchedule.wakeupHour}:30 AM`
      : `Evening mode: Next meal is breakfast tomorrow ~${sleepSchedule.wakeupHour}:30 AM`;
  } else if (todayMeals.length === 0) {
    // Morning / daytime before first meal of the day: next meal is TODAY's Breakfast
    nextFoodExpectedAt = targetBreakfastToday;
    const minsUntilBreakfast = (targetBreakfastToday.getTime() - now.getTime()) / (1000 * 60);

    if (minsUntilBreakfast > 30) {
      foodUrgency = 'safe';
      foodReason = `Puppy resting. Breakfast scheduled at ~${sleepSchedule.wakeupHour}:30 AM (Meal 1 of ${targetMeals})`;
    } else if (minsUntilBreakfast >= -60) {
      foodUrgency = minsUntilBreakfast < 0 ? 'soon' : 'safe';
      foodReason = `Morning breakfast due (~${sleepSchedule.wakeupHour}:30 AM, Meal 1 of ${targetMeals})`;
    } else {
      foodUrgency = 'overdue';
      foodReason = `Breakfast overdue (expected ~${sleepSchedule.wakeupHour}:30 AM, Meal 1 of ${targetMeals})`;
    }
  } else {
    // Daytime meals (Lunch / Dinner): calculate from the most recent meal logged today
    const lastMealToday = todayMeals.reduce((latest, current) => {
      return parseIsoDate(current.timestamp).getTime() > parseIsoDate(latest.timestamp).getTime() ? current : latest;
    }, todayMeals[0]);

    const lastMealTime = parseIsoDate(lastMealToday.timestamp).getTime();
    const daytimeWakingHours = Math.max(10, sleepSchedule.bedtimeHour - sleepSchedule.wakeupHour);
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

  let isPostMealPee = false;
  if (lastPee) {
    const lastPeeDate = parseIsoDate(lastPee.timestamp);
    const lastPeeTime = lastPeeDate.getTime();
    const lastPeeHour = lastPeeDate.getHours();
    const isLateEveningPee = lastPeeHour >= sleepSchedule.bedtimeHour - 1 || lastPeeHour < sleepSchedule.wakeupHour;

    if (!(isLateEveningPee || isCurrentlyNight) && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPeeTime) {
      isPostMealPee = true;
    }
  }

  let isPostMealPoop = false;
  if (lastPoop) {
    const lastPoopDate = parseIsoDate(lastPoop.timestamp);
    const lastPoopTime = lastPoopDate.getTime();
    const lastPoopHour = lastPoopDate.getHours();
    const isEveningPoop = lastPoopHour >= 19 || lastPoopHour < sleepSchedule.wakeupHour;

    if (!(isEveningPoop || isCurrentlyNight) && lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPoopTime) {
      isPostMealPoop = true;
    }
  }

  return {
    nextPeeExpectedAt,
    standardPeeExpectedAt,
    isPostMealPee,
    peeUrgency,
    peeReason,
    nextPoopExpectedAt,
    standardPoopExpectedAt,
    isPostMealPoop,
    poopUrgency,
    poopReason,
    nextFoodExpectedAt,
    foodUrgency,
    foodReason,
    isNightMode: isCurrentlyNight,
  };
}
