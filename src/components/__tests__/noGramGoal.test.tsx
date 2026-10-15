// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PredictorWidget } from '../PredictorWidget';
import { DogHealthSummary } from '../DogHealthSummary';
import { ActivityTimeline } from '../ActivityTimeline';
import { calculatePredictions } from '../../utils/predictions';
import { act as log, BALMA } from '../../utils/__tests__/fixtures';
import { en } from '../../i18n/en';

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

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

// One 80 g breakfast today, 3 meals a day
const now = new Date('2026-08-07T12:00:00+02:00');
const meals = [log('food', '2026-08-07T08:00:00+02:00', { quantityGrams: 80 })];
const withGoal = { ...BALMA, dailyFoodGramGoal: 240, targetMealsPerDay: 3 };
const noGoal = { ...withGoal, dailyFoodGramGoal: 0 };

function renderMealCard(profile: typeof withGoal) {
  return render(
    <PredictorWidget
      predictions={calculatePredictions(meals, profile, now, 'Europe/Paris')}
      profile={profile}
      activities={meals}
      todayFoodLoggedGrams={80}
      todayMealsCount={1}
      nextMealPortionGrams={profile.dailyFoodGramGoal ? 80 : undefined}
      onQuickAction={vi.fn()}
      onOpenQuickLogModal={vi.fn()}
      referenceTime={now}
    />
  );
}

describe('a dog with no gram goal: no goal in grams on any screen', () => {
  it('meal card: meals only, and the feed button offers no grams', async () => {
    const container = await renderMealCard(noGoal);
    expect(container.textContent).toContain('Ration intake today:1/3 meals');
    expect(container.textContent).not.toMatch(/\d+g \/ \d+g/);
    expect(container.textContent).not.toMatch(/Feed Meal Now \(/);
  });

  it('meal card of a dog with a goal is unchanged', async () => {
    const container = await renderMealCard(withGoal);
    expect(container.textContent).toContain('Ration intake today:80g / 240g (1/3)');
    expect(container.textContent).toContain('Feed Meal Now (80g)');
  });

  it('health summary: meal schedule without grams', async () => {
    const container = await render(
      <DogHealthSummary profile={noGoal} activities={meals} weightActivities={[]} predictions={calculatePredictions(meals, noGoal, now, 'Europe/Paris')} onOpenHealthPassport={vi.fn()} />
    );
    expect(container.textContent).toContain('3 meals / day');
    // No word boundary: per-meal grams render glued to the next label ('~80gLunch')
    expect(container.textContent).not.toMatch(/\d+g/);
  });

  it('timeline: today shows the grams eaten and the meal count, with no gram goal', async () => {
    const container = await render(
      <ActivityTimeline activities={meals} caretakers={[]} activePuppy={noGoal} onDeleteActivity={vi.fn()} referenceTime={now} />
    );
    expect(container.textContent).toContain('80g');
    expect(container.textContent).not.toMatch(/\d+g \/ \d+g/);
  });

  it('timeline: a meal saved without grams shows the meal count, no "0g"', async () => {
    const gramlessMeal = log('food', '2026-08-07T08:00:00+02:00');
    const container = await render(
      <ActivityTimeline activities={[gramlessMeal]} caretakers={[]} activePuppy={noGoal} onDeleteActivity={vi.fn()} referenceTime={now} />
    );
    const foodPill = container.querySelector<HTMLElement>('[title^="Food intake"]')!;
    expect(foodPill.title).toBe('Food intake: (1/3)');
    expect(foodPill.textContent).toBe('(1/3)');
    expect(foodPill.querySelectorAll('span')).toHaveLength(1);
  });

  it('timeline edit: a meal can be saved with its grams box emptied', async () => {
    // jsdom lacks it; the HeroUI modal reads it
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const onUpdateActivity = vi.fn();
    await render(
      <ActivityTimeline activities={meals} caretakers={[]} activePuppy={noGoal} onDeleteActivity={vi.fn()} onUpdateActivity={onUpdateActivity} referenceTime={now} />
    );
    const dayHeader = [...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((button) => button.textContent?.includes('80g'))!;
    await act(async () => dayHeader.click());
    await act(async () => document.querySelector<HTMLButtonElement>(`button[aria-label="${en.potty.editActivity}"]`)!.click());
    // The edit form is a lazy chunk
    await act(async () => { await import('../QuickLogModal'); });
    const grams = document.getElementById('quicklog-quantity-grams') as HTMLInputElement;
    expect(grams.value).toBe('80');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(grams, '');
      grams.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());

    expect(onUpdateActivity).toHaveBeenCalledTimes(1);
    expect(onUpdateActivity.mock.calls[0][0]).toMatchObject({ id: meals[0].id, type: 'food' });
    expect(onUpdateActivity.mock.calls[0][0].quantityGrams).toBeUndefined();
  });
});
