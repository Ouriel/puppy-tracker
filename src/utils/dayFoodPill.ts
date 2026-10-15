export interface DayFoodPill {
  text: string;
  mealsText?: string;
  tone: 'goalReached' | 'underGoal' | 'neutral';
}

/**
 * Food pill of one timeline day. Only today is compared to the profile's goal: past goals are not stored
 * (e.g. 250 g / 3 meals until ~6 months, then 200 g / 2), so past days show plain totals in a neutral style.
 * `mealsCountTemplate` is `t.dashboard.mealsCount` ('{count} meal(s)').
 */
export function getDayFoodPill(
  day: { isToday: boolean; totalFoodGrams: number; mealsCount: number; dailyGoalGrams: number; targetMealsCount: number },
  mealsCountTemplate: string
): DayFoodPill {
  if (!day.isToday) {
    return { text: `${day.totalFoodGrams}g · ${mealsCountTemplate.replace('{count}', String(day.mealsCount))}`, tone: 'neutral' };
  }
  // No gram goal (0): the day's target is its meal count, and no goal in grams is shown
  const hasGramGoal = day.dailyGoalGrams > 0;
  const isGoalReached = hasGramGoal ? day.totalFoodGrams >= day.dailyGoalGrams : day.mealsCount >= day.targetMealsCount;
  return {
    text: hasGramGoal ? `${day.totalFoodGrams}g / ${day.dailyGoalGrams}g` : `${day.totalFoodGrams}g`,
    mealsText: `(${day.mealsCount}/${day.targetMealsCount})`,
    tone: isGoalReached ? 'goalReached' : day.totalFoodGrams > 0 ? 'underGoal' : 'neutral',
  };
}
