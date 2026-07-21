import type { Activity, PredictionResult, PuppyProfile } from '../types';

/**
 * Calculates puppy age in weeks and months
 */
export function getPuppyAge(birthDateIso: string): { weeks: number; months: number; text: string } {
  const birth = new Date(birthDateIso);
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
 * Calculates predictive potty & feeding schedules for a puppy
 */
export function calculatePredictions(
  activities: Activity[],
  profile: PuppyProfile
): PredictionResult {
  const now = new Date();
  const sorted = [...activities].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const lastPee = sorted.find((a) => a.type === 'pee');
  const lastPoop = sorted.find((a) => a.type === 'poop');
  const lastFood = sorted.find((a) => a.type === 'food');
  const lastNap = sorted.find((a) => a.type === 'nap');

  // Age based max bladder hold rule of thumb: ~1 hour per month of age up to 4 hours max for young pup
  const { months } = getPuppyAge(profile.birthDate);
  const baseBladderHours = Math.max(1, Math.min(months, 4));

  // 1. Pee Prediction
  let nextPeeExpectedAt: Date | null = null;
  let peeUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let peeReason = '';

  if (lastPee) {
    const lastPeeTime = new Date(lastPee.timestamp).getTime();
    let targetIntervalMinutes = baseBladderHours * 60;

    if (lastFood && new Date(lastFood.timestamp).getTime() > lastPeeTime) {
      const foodTime = new Date(lastFood.timestamp).getTime();
      const postFoodPee = new Date(foodTime + 25 * 60 * 1000);
      if (postFoodPee.getTime() < lastPeeTime + targetIntervalMinutes * 60 * 1000) {
        nextPeeExpectedAt = postFoodPee;
        peeReason = 'Pup fed recently (pees ~20-30 min post-meal)';
      }
    }

    if (!nextPeeExpectedAt) {
      nextPeeExpectedAt = new Date(lastPeeTime + targetIntervalMinutes * 60 * 1000);
      peeReason = `Based on ~${Math.round(targetIntervalMinutes)} min bladder capacity`;
    }

    const minsUntilPee = (nextPeeExpectedAt.getTime() - now.getTime()) / (1000 * 60);
    if (minsUntilPee <= 0) {
      peeUrgency = 'overdue';
    } else if (minsUntilPee <= 20) {
      peeUrgency = 'soon';
    } else {
      peeUrgency = 'safe';
    }
  } else {
    peeReason = 'No pee recorded yet';
  }

  // 2. Poop Prediction
  let nextPoopExpectedAt: Date | null = null;
  let poopUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let poopReason = '';

  if (lastPoop) {
    const lastPoopTime = new Date(lastPoop.timestamp).getTime();
    let targetPoopIntervalMins = 5 * 60;

    if (lastFood && new Date(lastFood.timestamp).getTime() > lastPoopTime) {
      const foodTime = new Date(lastFood.timestamp).getTime();
      const postFoodPoop = new Date(foodTime + 35 * 60 * 1000);
      nextPoopExpectedAt = postFoodPoop;
      poopReason = 'Pup ate recently (poop gastrocolic reflex in 30-45 min)';
    } else {
      nextPoopExpectedAt = new Date(lastPoopTime + targetPoopIntervalMins * 60 * 1000);
      poopReason = 'Standard digestive interval';
    }

    const minsUntilPoop = (nextPoopExpectedAt.getTime() - now.getTime()) / (1000 * 60);
    if (minsUntilPoop <= 0) {
      poopUrgency = 'overdue';
    } else if (minsUntilPoop <= 25) {
      poopUrgency = 'soon';
    } else {
      poopUrgency = 'safe';
    }
  } else {
    poopReason = 'No poop recorded yet';
  }

  // 3. Food Prediction
  let nextFoodExpectedAt: Date | null = null;
  let foodUrgency: 'safe' | 'soon' | 'overdue' = 'safe';
  let foodReason = '';

  if (lastFood) {
    const lastFoodTime = new Date(lastFood.timestamp).getTime();
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
    hoursAwake: 2,
    lastNapEndedAt: lastNap ? new Date(lastNap.timestamp) : null,
  };
}
