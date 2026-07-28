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

  activities.forEach((a) => {
    const hr = parseIsoDate(a.timestamp).getHours();
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
  type: 'pee' | 'poop',
  fallbackMinutes: number,
  sleepSchedule = { bedtimeHour: 22, wakeupHour: 7 }
): { intervalMins: number; sampleCount: number; isLearned: boolean } {
  const sortedLogs = [...activities]
    .filter((a) => a.type === type)
    .sort((a, b) => parseIsoDate(a.timestamp).getTime() - parseIsoDate(b.timestamp).getTime());

  if (sortedLogs.length < 2) {
    return { intervalMins: fallbackMinutes, sampleCount: sortedLogs.length, isLearned: false };
  }

  // Filter daytime gaps (occurring between morning wakeup and bedtime, ignoring overnight gaps)
  const intervals: number[] = [];
  for (let i = 1; i < sortedLogs.length; i++) {
    const prevDate = parseIsoDate(sortedLogs[i - 1].timestamp);
    const currDate = parseIsoDate(sortedLogs[i].timestamp);
    const prevHour = prevDate.getHours();
    const diffMins = (currDate.getTime() - prevDate.getTime()) / (1000 * 60);

    // Only include daytime intervals (between wakeup and bedtime)
    const isDaytime = prevHour >= sleepSchedule.wakeupHour && prevHour < sleepSchedule.bedtimeHour;
    if (isDaytime && diffMins >= 15 && diffMins <= 360) {
      intervals.push(diffMins);
    }
  }

  if (intervals.length === 0) {
    return { intervalMins: fallbackMinutes, sampleCount: 0, isLearned: false };
  }

  const avg = Math.round(intervals.reduce((sum, v) => sum + v, 0) / intervals.length);
  const blended = Math.round(avg * 0.7 + fallbackMinutes * 0.3);

  return { intervalMins: blended, sampleCount: intervals.length, isLearned: true };
}

/**
 * Advanced Predictive Potty & Feeding Schedules with Night Sleep Detection
 */
export function calculatePredictions(
  activities: Activity[],
  profile: PuppyProfile
): PredictionResult {
  const now = new Date();
  const currentHour = now.getHours();
  const sleepSchedule = detectSleepSchedule(activities);

  const isCurrentlyNight = currentHour >= sleepSchedule.bedtimeHour || currentHour < sleepSchedule.wakeupHour;

  const sorted = [...activities].sort(
    (a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime()
  );

  const lastPee = sorted.find((a) => a.type === 'pee');
  const lastPoop = sorted.find((a) => a.type === 'poop');
  const lastFood = sorted.find((a) => a.type === 'food');

  const { months } = getPuppyAge(profile.birthDate);
  const baseBladderHours = Math.max(1, Math.min(months, 4));
  const fallbackPeeIntervalMins = baseBladderHours * 60;

  // Learn personalized daytime pee & poop intervals
  const learnedPee = calculateLearnedIntervalMinutes(activities, 'pee', fallbackPeeIntervalMins, sleepSchedule);
  const learnedPoop = calculateLearnedIntervalMinutes(activities, 'poop', 300, sleepSchedule); // 5h fallback

  // 1. Pee Prediction
  let nextPeeExpectedAt: Date | null = null;
  let peeUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let peeReason = '';

  if (lastPee) {
    const lastPeeDate = parseIsoDate(lastPee.timestamp);
    const lastPeeTime = lastPeeDate.getTime();
    const lastPeeHour = lastPeeDate.getHours();

    const isLateEveningPee = lastPeeHour >= sleepSchedule.bedtimeHour - 1 || lastPeeHour < sleepSchedule.wakeupHour;

    if (isLateEveningPee || isCurrentlyNight) {
      // Overnight sleep mode for pee
      const targetWakeup = new Date(now);
      if (currentHour >= sleepSchedule.bedtimeHour) {
        targetWakeup.setDate(targetWakeup.getDate() + 1);
      }
      targetWakeup.setHours(sleepSchedule.wakeupHour, 0, 0, 0);

      // Young puppies under 10 weeks might need 1 mid-night potty break
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
      const bladderPeeTime = lastPeeTime + learnedPee.intervalMins * 60 * 1000;

      if (postFoodPee.getTime() < now.getTime() && bladderPeeTime > postFoodPee.getTime()) {
        nextPeeExpectedAt = new Date(bladderPeeTime);
        peeReason = learnedPee.isLearned
          ? `Adaptive AI: Learned ~${learnedPee.intervalMins}m avg gap from ${learnedPee.sampleCount} logs`
          : `Based on ~${Math.round(learnedPee.intervalMins)}m age bladder capacity`;
      } else {
        nextPeeExpectedAt = postFoodPee;
        peeReason = 'Pup fed recently (pees ~20-30 min post-meal)';
      }
    } else {
      nextPeeExpectedAt = new Date(lastPeeTime + learnedPee.intervalMins * 60 * 1000);
      peeReason = learnedPee.isLearned
        ? `Adaptive AI: Learned ~${learnedPee.intervalMins}m avg gap from ${learnedPee.sampleCount} logs`
        : `Based on ~${Math.round(learnedPee.intervalMins)}m age bladder capacity`;
    }

    if (nextPeeExpectedAt) {
      const minsUntilPee = (nextPeeExpectedAt.getTime() - now.getTime()) / (1000 * 60);
      if (isCurrentlyNight && minsUntilPee > -120) {
        peeUrgency = 'safe'; // Keep safe during night sleep
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
  let poopUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let poopReason = '';

  if (lastPoop) {
    const lastPoopDate = parseIsoDate(lastPoop.timestamp);
    const lastPoopTime = lastPoopDate.getTime();
    const lastPoopHour = lastPoopDate.getHours();

    const isEveningPoop = lastPoopHour >= 19 || lastPoopHour < sleepSchedule.wakeupHour;

    if (isEveningPoop || isCurrentlyNight) {
      // Overnight sleep mode for poop: Dogs don't poop at 2 AM
      const targetMorningPoop = new Date(now);
      if (currentHour >= 19) {
        targetMorningPoop.setDate(targetMorningPoop.getDate() + 1);
      }
      targetMorningPoop.setHours(sleepSchedule.wakeupHour + 1, 0, 0, 0); // ~8:00 AM post-breakfast
      nextPoopExpectedAt = targetMorningPoop;
      poopReason = `Night mode: Sleeping overnight. Expected after morning breakfast (~${sleepSchedule.wakeupHour + 1}:00 AM)`;
    } else if (lastFood && parseIsoDate(lastFood.timestamp).getTime() > lastPoopTime) {
      const foodTime = parseIsoDate(lastFood.timestamp).getTime();
      const postFoodPoopTime = foodTime + 35 * 60 * 1000;
      const digestPoopTime = lastPoopTime + learnedPoop.intervalMins * 60 * 1000;

      if (postFoodPoopTime < now.getTime() && digestPoopTime > postFoodPoopTime) {
        nextPoopExpectedAt = new Date(digestPoopTime);
        poopReason = learnedPoop.isLearned
          ? `Adaptive AI: Learned ~${Math.round(learnedPoop.intervalMins / 60)}h avg digest time`
          : 'Standard digestive interval (~5h)';
      } else {
        nextPoopExpectedAt = new Date(postFoodPoopTime);
        poopReason = 'Pup ate recently (poop gastrocolic reflex in 30-45 min)';
      }
    } else {
      nextPoopExpectedAt = new Date(lastPoopTime + learnedPoop.intervalMins * 60 * 1000);
      poopReason = learnedPoop.isLearned
        ? `Adaptive AI: Learned ~${Math.round(learnedPoop.intervalMins / 60)}h avg digest time`
        : 'Standard digestive interval (~5h)';
    }

    if (nextPoopExpectedAt) {
      const minsUntilPoop = (nextPoopExpectedAt.getTime() - now.getTime()) / (1000 * 60);
      if (isCurrentlyNight && minsUntilPoop > -120) {
        poopUrgency = 'safe'; // Keep safe during night sleep
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

  // 3. Food Prediction
  let nextFoodExpectedAt: Date | null = null;
  let foodUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let foodReason = '';

  if (lastFood) {
    const lastFoodTime = parseIsoDate(lastFood.timestamp).getTime();
    const mealIntervalHours = Math.max(3, Math.min(6, 12 / (profile.targetMealsPerDay || 3)));
    nextFoodExpectedAt = new Date(lastFoodTime + mealIntervalHours * 60 * 60 * 1000);
    foodReason = `Next of ${profile.targetMealsPerDay} daily meals (~every ${mealIntervalHours}h)`;

    const minsUntilFood = (nextFoodExpectedAt.getTime() - now.getTime()) / (1000 * 60);
    if (minsUntilFood <= -15) {
      foodUrgency = 'overdue';
    } else if (minsUntilFood <= 30) {
      foodUrgency = 'soon';
    } else {
      foodUrgency = 'safe';
    }
  } else {
    foodReason = 'No meal recorded today';
  }

  return {
    nextPeeExpectedAt,
    peeUrgency,
    peeReason,
    nextPoopExpectedAt,
    poopUrgency,
    poopReason,
    nextFoodExpectedAt,
    foodUrgency,
    foodReason,
  };
}
