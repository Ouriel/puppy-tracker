// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DogHealthSummary } from '../DogHealthSummary';
import { calculatePredictions } from '../../utils/predictions';
import { PISTACHE } from '../../utils/__tests__/fixtures';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

async function renderMealTimes(targetMealsPerDay: number, mealSchedule: number[]): Promise<string[]> {
  const profile = { ...PISTACHE, targetMealsPerDay, dailyFoodGramGoal: 200 };
  const predictions = { ...calculatePredictions([], profile, new Date('2026-09-10T12:00:00+02:00'), 'Europe/Paris'), mealSchedule };
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(<DogHealthSummary profile={profile} activities={[]} weightActivities={[]} predictions={predictions} onOpenHealthPassport={vi.fn()} />)
  );
  return [...container.querySelectorAll('[title]')].map((label) => `${label.textContent} ${label.nextElementSibling?.textContent}`);
}

describe('daily schedule card: one learned time per meal', () => {
  it('4 meals: the snack is its own learned time, not the middle of lunch and dinner', async () => {
    expect(await renderMealTimes(4, [6 * 60 + 30, 10 * 60 + 30, 14 * 60 + 30, 18 * 60 + 30]))
      .toEqual(['Breakfast ~06:30', 'Lunch ~10:30', 'Snack ~14:30', 'Dinner ~18:30']);
  });

  it('2 meals: breakfast and dinner', async () => {
    expect(await renderMealTimes(2, [9 * 60 + 45, 19 * 60 + 45])).toEqual(['Breakfast ~09:45', 'Dinner ~19:45']);
  });
});
