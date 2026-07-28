import type { Activity, PredictionResult, PuppyProfile } from '../types';

function parseIsoDate(timestamp: string): Date {
  if (!timestamp) return new Date();
  const formatted = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  return new Date(formatted);
}

export function getPuppyAge(birthDateIso: string): { weeks: number; months: number; text: string } {
  const birth = parseIsoDate(birthDateIso);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
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
 * Learns puppy's typical night sleep schedule (bedtime & morning wakeup) from activity logs
 */
export function detectSleepSchedule(activities: Activity[]): { bedtimeHour: number; wakeupHour: number } {
  const defaultSchedule = { bedtimeHour: 22, wakeupHour: 7 }; // 10:00 PM to 7:00 AM
  if (activities.length < 5) return defaultSchedule;

  const eveningHours: number[] = [];
  const morningHours: number[] = [];

  activities.forEach((activity) => {
    const hr = parseIsoDate(activity.timestamp).getHours();
    if (hr >= 21 || hr <= 1) {
      eveningHours.push(hr >= 21 ? hr : hr + 24);
    } else if (hr >= 5 && hr <= 9) {
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
  const sortedLogs = [...activities]
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
export function calculatePredictions(activities: Activity[], profile: PuppyProfile): PredictionResult {
  const now = new Date();
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
      const postFoodPee = new Date(foodTime + 25 * 60 * 1000);

      if (postFoodPee.getTime() < now.getTime() && standardPeeExpectedAt.getTime() > postFoodPee.getTime()) {
        nextPeeExpectedAt = standardPeeExpectedAt;
        peeReason = learnedPee.isLearned
          ? `Adaptive AI: Learned ~${learnedPee.intervalMins}m average bladder interval`
          : `Based on ~${Math.round(learnedPee.intervalMins)}m age bladder capacity`;
      } else {
        nextPeeExpectedAt = postFoodPee;
        peeReason = `Pup fed recently (pees ~20-30m post-meal). Learned interval: ~${learnedPee.intervalMins}m`;
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

      if (postFoodPoopTime < now.getTime() && standardPoopExpectedAt.getTime() > postFoodPoopTime) {
        nextPoopExpectedAt = standardPoopExpectedAt;
        poopReason = learnedPoop.isLearned
          ? `Adaptive AI: Learned ~${(learnedPoop.intervalMins / 60).toFixed(1)}h average digest interval`
          : 'Standard digestive interval (~5h)';
      } else {
        nextPoopExpectedAt = new Date(postFoodPoopTime);
        poopReason = `Pup fed recently (gastrocolic reflex ~30-45m). Learned interval: ~${(learnedPoop.intervalMins / 60).toFixed(1)}h`;
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

  // 3. Food Prediction (Veterinary Standard & Age-Aware)
  let nextFoodExpectedAt: Date | null = null;
  let foodUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let foodReason = '';

  const vetRecommendedMeals = months < 3 ? 4 : months < 6 ? 3 : 2;
  const targetMeals = Math.max(1, profile.targetMealsPerDay || vetRecommendedMeals);

  const todayStr = now.toISOString().slice(0, 10);
  const todayMeals = activities.filter(
    (activity) => activity.type === 'food' && parseIsoDate(activity.timestamp).toISOString().slice(0, 10) === todayStr
  );
  const todayGramTotal = todayMeals.reduce((sum, activity) => sum + (activity.quantityGrams || 80), 0);
  const isGoalReached = (profile.dailyFoodGramGoal > 0 && todayGramTotal >= profile.dailyFoodGramGoal) || todayMeals.length >= targetMeals;

  if (isGoalReached || currentHour >= 19 || isCurrentlyNight) {
    const targetBreakfast = new Date(now);
    if (currentHour >= 19 || isGoalReached) {
      targetBreakfast.setDate(targetBreakfast.getDate() + 1);
    }
    targetBreakfast.setHours(sleepSchedule.wakeupHour, 30, 0, 0); // ~07:30 AM
    nextFoodExpectedAt = targetBreakfast;

    if (isGoalReached) {
      foodReason = `Today's food goal reached (${todayGramTotal}g / ${targetMeals} meals). Next: ~${sleepSchedule.wakeupHour}:30 AM`;
      foodUrgency = 'safe';
    } else {
      foodReason = `Night mode: Next meal is breakfast tomorrow ~${sleepSchedule.wakeupHour}:30 AM`;
      foodUrgency = 'safe';
    }
  } else if (lastFood) {
    const lastFoodTime = parseIsoDate(lastFood.timestamp).getTime();
    const mealIntervalHours = targetMeals > 1 ? 11 / (targetMeals - 1) : 11;
    nextFoodExpectedAt = new Date(lastFoodTime + mealIntervalHours * 60 * 60 * 1000);

    const formattedInterval = (Math.round(mealIntervalHours * 10) / 10).toString();
    foodReason = `Vet guideline for ${months}mo puppy: ${targetMeals} daily meals (~every ${formattedInterval}h)`;

    const minsUntilFood = (nextFoodExpectedAt.getTime() - now.getTime()) / (1000 * 60);
    if (minsUntilFood <= -20) {
      foodUrgency = 'overdue';
    } else if (minsUntilFood <= 30) {
      foodUrgency = 'soon';
    } else {
      foodUrgency = 'safe';
    }
  } else {
    foodReason = `No meal recorded today (${targetMeals} meals/day recommended for ${months}mo puppy)`;
  }

  return {
    nextPeeExpectedAt,
    standardPeeExpectedAt,
    peeUrgency,
    peeReason,
    nextPoopExpectedAt,
    standardPoopExpectedAt,
    poopUrgency,
    poopReason,
    nextFoodExpectedAt,
    foodUrgency,
    foodReason,
  };
}
