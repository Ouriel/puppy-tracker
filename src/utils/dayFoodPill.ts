import { formatGrams } from './weight';

export interface DayFoodPill {
  text: string;
  mealsText?: string;
  tone: 'goalReached' | 'underGoal' | 'neutral';
}

/**
 * Food pill of one timeline day. Only today is compared to the profile's goal: past goals are not stored
 * (e.g. 250 g / 3 meals until ~6 months, then 200 g / 2), so past days show plain totals in a neutral style.
 * `mealsCountText` is the day's meal count in words ('3 meals').
 */
export function getDayFoodPill(
  day: { isToday: boolean; totalFoodGrams: number; mealsCount: number; dailyGoalGrams: number; targetMealsCount: number },
  mealsCountText: string,
  lang: 'en' | 'fr'
): DayFoodPill {
  const grams = (value: number) => formatGrams(value, lang);
  // No gram goal (0): the day's target is its meal count, and no goal in grams is shown.
  // Its meals may have no grams (stored as null): no grams eaten shows no '0g'.
  const hasGramGoal = day.dailyGoalGrams > 0;
  const showsGrams = hasGramGoal || day.totalFoodGrams > 0;
  if (!day.isToday) {
    return { text: showsGrams ? `${grams(day.totalFoodGrams)} · ${mealsCountText}` : mealsCountText, tone: 'neutral' };
  }
  const isGoalReached = hasGramGoal ? day.totalFoodGrams >= day.dailyGoalGrams : day.mealsCount >= day.targetMealsCount;
  const hasEaten = hasGramGoal ? day.totalFoodGrams > 0 : day.mealsCount > 0;
  return {
    text: hasGramGoal ? `${grams(day.totalFoodGrams)} / ${grams(day.dailyGoalGrams)}` : showsGrams ? grams(day.totalFoodGrams) : '',
    mealsText: `(${day.mealsCount}/${day.targetMealsCount})`,
    tone: isGoalReached ? 'goalReached' : hasEaten ? 'underGoal' : 'neutral',
  };
}
