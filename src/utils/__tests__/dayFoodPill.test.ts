import { describe, it, expect } from 'vitest';
import { getDayFoodPill } from '../dayFoodPill';
import { en } from '../../i18n/en';
import { fr } from '../../i18n/fr';

// Current profile goal: 200 g in 2 meals. Until ~6 months it was 250 g in 3 meals, and past goals are not stored.
const currentGoal = { dailyGoalGrams: 200, targetMealsCount: 2 };

describe('getDayFoodPill', () => {
  it('compares today to the current goal: under goal', () => {
    const pill = getDayFoodPill({ isToday: true, totalFoodGrams: 150, mealsCount: 1, ...currentGoal }, en.dashboard.mealsCount);
    expect(pill).toEqual({ text: '150g / 200g', mealsText: '(1/2)', tone: 'underGoal' });
  });

  it('compares today to the current goal: goal reached', () => {
    const pill = getDayFoodPill({ isToday: true, totalFoodGrams: 200, mealsCount: 2, ...currentGoal }, en.dashboard.mealsCount);
    expect(pill).toEqual({ text: '200g / 200g', mealsText: '(2/2)', tone: 'goalReached' });
  });

  it('keeps today neutral before the first meal', () => {
    const pill = getDayFoodPill({ isToday: true, totalFoodGrams: 0, mealsCount: 0, ...currentGoal }, en.dashboard.mealsCount);
    expect(pill).toEqual({ text: '0g / 200g', mealsText: '(0/2)', tone: 'neutral' });
  });

  it('with no gram goal, today counts meals against the target and shows the grams eaten without a goal', () => {
    const noGoal = { dailyGoalGrams: 0, targetMealsCount: 2 };
    expect(getDayFoodPill({ isToday: true, totalFoodGrams: 150, mealsCount: 1, ...noGoal }, en.dashboard.mealsCount))
      .toEqual({ text: '150g', mealsText: '(1/2)', tone: 'underGoal' });
    expect(getDayFoodPill({ isToday: true, totalFoodGrams: 230, mealsCount: 2, ...noGoal }, en.dashboard.mealsCount))
      .toEqual({ text: '230g', mealsText: '(2/2)', tone: 'goalReached' });
  });

  // Owner decision 2026-10-15: such a dog's meals may have no grams (stored as null): never shown as '0g'
  it('with no gram goal, meals saved without grams show the meal count only, under goal until the target', () => {
    const noGoal = { dailyGoalGrams: 0, targetMealsCount: 2 };
    expect(getDayFoodPill({ isToday: true, totalFoodGrams: 0, mealsCount: 1, ...noGoal }, en.dashboard.mealsCount))
      .toEqual({ text: '', mealsText: '(1/2)', tone: 'underGoal' });
    expect(getDayFoodPill({ isToday: true, totalFoodGrams: 0, mealsCount: 2, ...noGoal }, en.dashboard.mealsCount))
      .toEqual({ text: '', mealsText: '(2/2)', tone: 'goalReached' });
    expect(getDayFoodPill({ isToday: false, totalFoodGrams: 0, mealsCount: 2, ...noGoal }, en.dashboard.mealsCount))
      .toEqual({ text: '2 meal(s)', tone: 'neutral' });
  });

  it('shows a past day as plain totals, not against the current goal (owner report "240g / 200g (3/2)")', () => {
    const pastDay = { isToday: false, totalFoodGrams: 240, mealsCount: 3, ...currentGoal };
    expect(getDayFoodPill(pastDay, en.dashboard.mealsCount)).toEqual({ text: '240g · 3 meal(s)', tone: 'neutral' });
    expect(getDayFoodPill(pastDay, fr.dashboard.mealsCount)).toEqual({ text: '240g · 3 repas', tone: 'neutral' });
  });
});
