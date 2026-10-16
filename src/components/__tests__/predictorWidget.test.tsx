// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PredictorWidget } from '../PredictorWidget';
import { calculatePredictions } from '../../utils/predictions';
import { act as log, PISTACHE } from '../../utils/__tests__/fixtures';
import type { Activity, PredictionResult } from '../../types';
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

/**
 * The cards for `activities` in the order the app holds them (not sorted); `override` replaces parts of the engine's answer.
 * `at`: the time on the phone (default noon); `isHistoryUnknown`: the dog's logs are not here.
 */
async function renderCards(activities: Activity[], override: Partial<PredictionResult> = {}, { at = now, isHistoryUnknown = false } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <PredictorWidget
        predictions={{ ...calculatePredictions(activities, PISTACHE, at, 'Europe/Paris'), ...override }}
        profile={PISTACHE}
        activities={activities}
        todayFoodLoggedGrams={0}
        todayMealsCount={0}
        nextMealPortionGrams={80}
        onQuickAction={vi.fn()}
        onOpenQuickLogModal={vi.fn()}
        referenceTime={at}
        isHistoryUnknown={isHistoryUnknown}
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

// App review 2026-10-16, decision 6: "Peed…" and "Acciden…" on a tablet. Short words on screen, the full name for screen readers.
describe('the potty buttons', () => {
  const buttons = (container: HTMLElement) =>
    [...container.querySelectorAll('button')].filter((button) => button.hasAttribute('aria-label')).map((button) => [button.getAttribute('aria-label'), button.textContent]);

  it('English: "Outside" and "Accident" on screen; each button named after its card', async () => {
    const container = await renderCards([log('pee', '2026-09-15T11:50:00+02:00')]);
    expect(buttons(container)).toEqual([
      ['Peed Outside', 'Outside'],
      ['Pee accident indoors', 'Accident'],
      ['Pooped Outside', 'Outside'],
      ['Poop accident indoors', 'Accident'],
    ]);
  });

  it('French: "Dehors" and "Accident" on screen; "Pipi dehors", "Accident de pipi"… for screen readers', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const container = await renderCards([log('pee', '2026-09-15T11:50:00+02:00')]);
    expect(buttons(container)).toEqual([
      ['Pipi dehors', 'Dehors'],
      ['Accident de pipi', 'Accident'],
      ['Caca dehors', 'Dehors'],
      ['Accident de caca', 'Accident'],
    ]);
  });
});

// App review 2026-10-16, decision 5 (and prediction decision 1: every card may turn red): a 2 px outline on urgency,
// red when overdue and amber when soon, the same on all three cards, so the meal card's red chip sits on a red card
describe('how loud a card is', () => {
  const recentLogs = [log('pee', '2026-09-15T11:50:00+02:00'), log('poop', '2026-09-15T11:00:00+02:00'), log('food', '2026-09-15T11:00:00+02:00')];
  const cardClasses = async (urgency: PredictionResult['peeUrgency']) => {
    const container = await renderCards(recentLogs, { peeUrgency: urgency, poopUrgency: urgency, foodUrgency: urgency });
    const classes = [...container.querySelectorAll('.card')].map((card) => card.className.split(/\s+/).filter((name) => /^(border|bg)-/.test(name)).sort().join(' '));
    await act(async () => root?.unmount());
    return classes;
  };

  it('overdue: the three cards look the same, red with a 2 px outline; soon: amber with a 2 px outline; calm: the 1 px outline', async () => {
    const overdue = await cardClasses('overdue');
    const soon = await cardClasses('soon');
    const safe = await cardClasses('safe');

    expect(new Set(overdue).size).toBe(1);
    expect(new Set(soon).size).toBe(1);
    expect(new Set(safe).size).toBe(1);
    expect(overdue[0]).toMatch(/\bborder-2\b/);
    expect(overdue[0]).toMatch(/border-red-/);
    expect(soon[0]).toMatch(/\bborder-2\b/);
    expect(soon[0]).toMatch(/border-amber-/);
    expect(safe[0]).not.toMatch(/border-2|red|amber/);
  });
});

// App review 2026-10-16, section 3.3 and decision 9: a new dog showed "Safe Zone" and "— ±20m" next to a meal card "Overdue ~6h50"
describe('a dog with nothing logged yet', () => {
  const cards = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.card')];

  const sixThirty = new Date('2026-09-15T06:30:00+02:00');

  it('English: one line per potty card, no ± and no chip; the meal card is calm and names breakfast', async () => {
    const container = await renderCards([], {}, { at: sixThirty });
    const [pee, poop, meal] = cards(container);

    expect(pee.textContent).toContain('No pee yet. Tap Outside to start.');
    expect(poop.textContent).toContain('No poop yet. Tap Outside to start.');
    expect(meal.textContent).toContain('Next: breakfast ~7:30 AM');
    for (const card of [pee, poop, meal]) {
      expect(card.textContent).not.toMatch(/±|Safe Zone|Overdue|—/);
      expect(card.className).not.toMatch(/red|amber/);
    }
  });

  it('French: "Pas encore de pipi. Touche Dehors pour commencer.", "Prochain : petit-déjeuner ~07:30"', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const container = await renderCards([], {}, { at: sixThirty });
    const [pee, poop, meal] = cards(container);

    expect(pee.textContent).toContain('Pas encore de pipi. Touche Dehors pour commencer.');
    expect(poop.textContent).toContain('Pas encore de caca. Touche Dehors pour commencer.');
    expect(meal.textContent).toContain('Prochain\u00a0: petit-déjeuner ~07:30');
    expect(meal.textContent).not.toContain('En retard');
  });

  it('once a pee is logged the pee card counts down again; the meal card stays calm until the first meal', async () => {
    const container = await renderCards([log('pee', '2026-09-15T08:50:00+02:00')], {}, { at: new Date('2026-09-15T09:00:00+02:00') });
    const [pee, , meal] = cards(container);

    expect(pee.textContent).toMatch(/±/);
    expect(pee.textContent).not.toContain('No pee yet');
    // The engine's breakfast: 15 min after the morning pee
    expect(meal.textContent).toContain('Next: breakfast ~9:05 AM');
    expect(meal.textContent).not.toMatch(/Due Soon|Overdue/);
  });

  // Review 2026-10-16: a dog added in the afternoon read "Next: breakfast ~07:30", hours past; after an evening first
  // pee, the engine's breakfast (15 min after it) read "~21:45"
  it('after the morning, no breakfast time: "Next: first meal", calm', async () => {
    const afternoon = await renderCards([], {}, { at: new Date('2026-09-15T15:00:00+02:00') });
    expect(cards(afternoon)[2].textContent).toContain('Next: first meal');
    expect(cards(afternoon)[2].textContent).not.toMatch(/breakfast|Overdue|Due Soon/);
    await act(async () => root?.unmount());

    const evening = await renderCards([log('pee', '2026-09-15T21:30:00+02:00')], {}, { at: new Date('2026-09-15T21:30:00+02:00') });
    expect(cards(evening)[2].textContent).toContain('Next: first meal');
    expect(cards(evening)[2].textContent).not.toMatch(/breakfast|Overdue|Due Soon/);
  });

  it('French: "Prochain : premier repas"', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const container = await renderCards([], {}, { at: new Date('2026-09-15T15:00:00+02:00') });
    expect(cards(container)[2].textContent).toContain('Prochain\u00a0: premier repas');
  });

  it('a dog that has eaten before keeps its overdue breakfast', async () => {
    const container = await renderCards([log('food', '2026-09-14T19:00:00+02:00', { quantityGrams: 80 })]);
    const meal = cards(container)[2];

    expect(meal.textContent).toContain('Overdue');
    expect(meal.textContent).not.toContain('Next: breakfast');
  });

  // Review 2026-10-16: during a dog switch, or after its logs failed to load, a dog with weeks of logs read
  // "No pee yet. Tap Outside to start." and "0 today"
  it('a dog whose logs are not here: no "nothing yet" line, no counts; the buttons stay', async () => {
    const container = await renderCards([], {}, { at: sixThirty, isHistoryUnknown: true });
    const [pee, poop, meal] = cards(container);

    expect(container.textContent).not.toMatch(/No pee yet|No poop yet|Next: breakfast|Next: first meal|today|Safe Zone|±/);
    expect(container.querySelectorAll('button[aria-expanded]')).toHaveLength(0);
    for (const card of [pee, poop, meal]) expect(card.textContent).toContain('—');
    expect(container.querySelectorAll('button[aria-label]')).toHaveLength(4);
  });
});

// App review 2026-10-16, decision 10: the dashboard was 4 screens long on a phone. Below md a card keeps its countdown and
// buttons, with one line ("2 today · 10m ago"); a tap on it opens the counts and the explanation. From md, everything shows.
describe('compact cards on a phone', () => {
  const summaries = (container: HTMLElement) => [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')];
  const details = (container: HTMLElement, summary: HTMLButtonElement) => container.querySelector<HTMLElement>(`#${summary.getAttribute('aria-controls')}`)!;
  const logs = [log('pee', '2026-09-15T09:00:00+02:00'), log('pee', '2026-09-15T11:50:00+02:00'), log('poop', '2026-09-15T08:00:00+02:00'), log('food', '2026-09-15T08:30:00+02:00', { quantityGrams: 80 })];

  it('one line per card, the explanation folded below md and always shown from md', async () => {
    const container = await renderCards(logs);
    const [pee, poop, meal] = summaries(container);

    expect([pee, poop, meal].map((summary) => summary.textContent)).toEqual(['2 today · 10m ago', '1 today · 4h ago', '0\u00a0g / 240\u00a0g (0/3) · 3h 30m ago']);
    for (const summary of [pee, poop, meal]) {
      expect(summary.getAttribute('aria-expanded')).toBe('false');
      expect(summary.className).toMatch(/\bmd:hidden\b/);
      expect(details(container, summary).className.split(/\s+/)).toEqual(expect.arrayContaining(['hidden', 'md:block']));
    }
    expect(details(container, pee).textContent).toContain('bladder interval');
  });

  it('a tap opens that card\'s explanation, a second tap folds it', async () => {
    const container = await renderCards(logs);
    const pee = summaries(container)[0];

    await act(async () => pee.click());
    expect(pee.getAttribute('aria-expanded')).toBe('true');
    expect(details(container, pee).className.split(/\s+/)).not.toContain('hidden');
    expect(details(container, summaries(container)[1]).className.split(/\s+/)).toContain('hidden');

    await act(async () => pee.click());
    expect(details(container, pee).className.split(/\s+/)).toContain('hidden');
  });

  it('French: "2 aujourd\'hui · il y a 10 min"', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const container = await renderCards(logs);
    expect(summaries(container)[0].textContent).toBe('2 aujourd\'hui · il y a 10\u00a0min');
  });
});
