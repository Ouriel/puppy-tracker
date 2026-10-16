// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PredictorWidget } from '../PredictorWidget';
import { calculatePredictions } from '../../utils/predictions';
import { act as log, PISTACHE } from '../../utils/__tests__/fixtures';
import type { Activity } from '../../types';
import { fr } from '../../i18n/fr';

// The dashboard cards (prediction review 2026-10-16: B13 and the vet lines), on made-up logs.

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
});

const now = new Date('2026-09-15T12:00:00+02:00');

/** The cards for `activities` in the order the app holds them (not sorted). */
async function renderCards(activities: Activity[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <PredictorWidget
        predictions={calculatePredictions(activities, PISTACHE, now, 'Europe/Paris')}
        profile={PISTACHE}
        activities={activities}
        todayFoodLoggedGrams={0}
        todayMealsCount={0}
        nextMealPortionGrams={80}
        onQuickAction={vi.fn()}
        onOpenQuickLogModal={vi.fn()}
        referenceTime={now}
      />
    )
  );
  return container;
}

describe('B13: "Last pee" is the newest pee, whatever the list order', () => {
  const recentPee = log('pee', '2026-09-15T11:50:00+02:00');

  it('a pee back-filled 2 h ago (prepended to the list) does not become the last one', async () => {
    const container = await renderCards([log('pee', '2026-09-15T10:00:00+02:00'), recentPee]);
    expect(container.textContent).toContain('Last pee:10m ago');
  });

  it('a pee dated 2 h in the future is ignored', async () => {
    const container = await renderCards([log('pee', '2026-09-15T14:00:00+02:00'), recentPee]);
    expect(container.textContent).toContain('Last pee:10m ago');
  });
});

describe('vet lines on the stool alerts', () => {
  const diarrhoeaEn = 'Keep water available. Call your vet if it lasts more than 24 h, or now if there is blood, vomiting, tiredness, or the puppy is not fully vaccinated.';
  const hardStoolEn = 'Keep water available. Call your vet if there is no stool for 48 h, or if there is straining or vomiting.';
  const poopAt11 = (stoolConsistency: Activity['stoolConsistency']) => [log('poop', '2026-09-15T11:00:00+02:00', { stoolConsistency })];

  it('diarrhoea: when to call the vet', async () => {
    const container = await renderCards(poopAt11('diarrhea'));
    expect(container.textContent).toContain(diarrhoeaEn);
  });

  it('hard stool: when to call the vet', async () => {
    const container = await renderCards(poopAt11('hard'));
    expect(container.textContent).toContain(hardStoolEn);
  });

  it('normal stool: no vet line', async () => {
    const container = await renderCards(poopAt11('normal'));
    expect(container.textContent).not.toContain('Call your vet');
  });

  it('in French', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const diarrhoea = await renderCards(poopAt11('diarrhea'));
    expect(diarrhoea.textContent).toContain(
      "Laisse de l'eau à disposition. Appelle le vétérinaire si cela dure plus de 24\u00a0h, ou tout de suite en cas de sang, de vomissements, de fatigue, ou si le chiot n'a pas tous ses vaccins."
    );
    await act(async () => root?.unmount());
    const hardStool = await renderCards(poopAt11('hard'));
    expect(hardStool.textContent).toContain(
      "Laisse de l'eau à disposition. Appelle le vétérinaire en l'absence de selles pendant 48\u00a0h, ou en cas d'efforts ou de vomissements."
    );
  });
});

// App review 2026-10-16, S6: one duration style per language, "il y a" before the time, grams with a space
describe('durations, "ago" and grams in the app language', () => {
  const recentPee = log('pee', '2026-09-15T11:50:00+02:00');

  it('French: "il y a 10 min", "±… min", never "m" (metres), "0 g / 240 g" and "(80 g)"', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const container = await renderCards([recentPee]);
    const text = container.textContent!;
    expect(text).toContain(`${fr.dashboard.lastPee}il y a 10\u00a0min`);
    expect(text).toMatch(/±\d+\u00a0min/);
    expect(text).not.toMatch(/\d+m(?!in)/);
    expect(text).not.toContain('il y a il');
    expect(text).toContain('0\u00a0g / 240\u00a0g (0/3)');
    expect(text).toContain('(80\u00a0g)');
  });

  it('French: a log under a minute old reads "à l\'instant"', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const container = await renderCards([log('pee', '2026-09-15T12:00:00+02:00')]);
    expect(container.textContent).toContain(`${fr.dashboard.lastPee}à l'instant`);
  });

  it('English: "10m ago", and clock times "1:30 PM", never "01:30 PM"', async () => {
    const container = await renderCards([recentPee]);
    const text = container.textContent!;
    expect(text).toContain('Last pee:10m ago');
    expect(text).toMatch(/\(\d{1,2}:\d\d [AP]M\)/);
    expect(text).not.toMatch(/\(0\d:\d\d [AP]M\)/);
    expect(text).toContain('(80\u00a0g)');
  });
});
