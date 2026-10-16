// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WeightGrowthChart } from '../WeightGrowthChart';
import { fr } from '../../i18n/fr';
import { en } from '../../i18n/en';
import type { Activity, PuppyProfile } from '../../types';

// The passport's weight card in French, on a made-up dog. Today: 15 Oct 2026, 10:00 Paris.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const weighIn = (id: string, date: string, weightKg: number, notes: string | null = null): Activity =>
  ({ id, puppyId: puppy.id, type: 'weight', timestamp: `${date}T08:00:00.000Z`, weightKg, notes, loggedBy: 'Owner' });
const weighIns = [weighIn('w-aug', '2026-08-01', 7.6), weighIn('w-sep1', '2026-09-01', 9), weighIn('w-sep15', '2026-09-15', 9.6), weighIn('w-oct', '2026-10-01', 10.4)];

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  localStorage.setItem('puppace_lang_v1', 'fr');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderChart(props: Partial<ComponentProps<typeof WeightGrowthChart>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(
    <WeightGrowthChart activities={weighIns} profile={puppy} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} onUpdateActivity={vi.fn()} {...props} />
  ));
  return container;
}

const chart = () => document.querySelector<SVGSVGElement>('svg[role="img"]')!;
const readout = () => document.querySelector('[aria-live="polite"]')!.textContent;
const rows = () => [...document.querySelectorAll('tbody tr')].map((row) => row.textContent);
const tile = (label: string) => [...document.querySelectorAll('[data-tile]')].find((element) => element.getAttribute('data-tile') === label)!.textContent;
const buttonWithText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent!.trim() === text);

async function press(key: string) {
  const group = document.querySelector<HTMLElement>('[role="group"][tabindex="0"]')!;
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  await act(async () => group.dispatchEvent(event));
  return event;
}

/** Where a weigh-in's dot is drawn (jsdom puts the svg at 0, 0). */
const dotAt = (id: string) => {
  const marker = chart().querySelector(`[data-weigh-in="${id}"]`)!;
  return { clientX: Number(marker.getAttribute('cx')), clientY: Number(marker.getAttribute('cy')) };
};

async function pointer(type: 'pointerdown' | 'pointermove', id: string, init: PointerEventInit = {}) {
  const hitArea = chart().querySelector<SVGRectElement>('[data-hit-area]')!;
  await act(async () => hitArea.dispatchEvent(new PointerEvent(type, { bubbles: true, ...dotAt(id), ...init })));
}

/** Types in a form box the way React sees it. */
async function typeIn(id: string, text: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('the weight card, in French', () => {
  it('is titled "Poids" and draws the curve in real pixels: 200 px tall, no viewBox, a title and description for screen readers', async () => {
    const container = await renderChart();

    expect(container.querySelector('h3')!.textContent).toContain(fr.weightChart.title);
    expect(fr.weightChart.title).toBe('Poids');
    expect(chart().getAttribute('height')).toBe('200');
    expect(chart().hasAttribute('viewBox')).toBe(false);
    expect(chart().querySelector('title')!.textContent).toBe('Courbe de poids de Rex');
    expect(chart().querySelector('desc')!.textContent).toContain('Pesées\u00a0: 4 (du 1 août au 1 oct.), de 7,6 kg à 10,4 kg');
  });

  it('three tiles in one row: the last weigh-in, the measured pace, the adult range; no WALTHAM on screen', async () => {
    const container = await renderChart();

    expect(tile('weight')).toBe('Poids10,4 kgil y a 14\u00a0j'); // Intl.RelativeTimeFormat puts a no-break space before "j"
    // 9,6 kg on 15 Sep, 10,4 kg on 1 Oct: the 28 days up to the last weigh-in
    expect(tile('pace')).toBe('Rythme+50\u00a0g/jsur 16\u00a0j');
    expect(tile('adult')).toMatch(/^Adulte\d+–\d+ kgestimé$/);
    expect(container.querySelector('[data-tile]')!.parentElement!.className).toContain('grid-cols-3');
    expect(container.textContent).not.toMatch(/WALTHAM|Cat\. /);
  });

  it('the readout shows the selected weigh-in: weight, date, age, change since the previous one; arrows, Home and End move it', async () => {
    await renderChart();

    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(readout()).toContain('10,4 kg');
    expect(readout()).toContain('1 oct. · 7\u00a0mois');
    expect(readout()).toContain('+0,8 kg en 16\u00a0j (50\u00a0g/j)'); // no-break spaces: the rate never wraps from its unit

    await press('ArrowLeft');
    expect(readout()).toContain('9,6 kg');
    await press('Home');
    expect(readout()).toContain('7,6 kg');
    expect(readout()).toContain('1 août · 5\u00a0mois'); // 22 weeks: months from 16 weeks on
    expect(readout()).toContain(fr.weightChart.firstWeighIn);
    await press('ArrowRight');
    expect(readout()).toContain('9 kg');
    expect(readout()).toContain('1 sept.');
    await press('End');
    expect(readout()).toContain('10,4 kg');
  });

  it('the arrow keys move the selection, not the page; other keys are left alone', async () => {
    await renderChart();

    expect((await press('ArrowLeft')).defaultPrevented).toBe(true);
    expect((await press('Home')).defaultPrevented).toBe(true);
    expect((await press('Tab')).defaultPrevented).toBe(false);
  });

  it('screen readers: the chart group is described by the readout, the svg labelled by its title and description', async () => {
    await renderChart();
    const group = document.querySelector('[role="group"][tabindex="0"]')!;
    const [titleId, descriptionId] = chart().getAttribute('aria-labelledby')!.split(' ');

    expect(document.getElementById(group.getAttribute('aria-describedby')!)).toBe(document.querySelector('[aria-live="polite"]'));
    expect(document.getElementById(titleId)).toBe(chart().querySelector('title'));
    expect(document.getElementById(descriptionId)).toBe(chart().querySelector('desc'));
  });

  it('drawn at the width of its box, as measured, with 11 px labels; pan-y lets a vertical swipe scroll the page', async () => {
    vi.stubGlobal('ResizeObserver', class {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 254 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    });
    await renderChart({ activities: [...weighIns, weighIn('w-typo', '2026-10-08', 104)] });

    expect(chart().getAttribute('width')).toBe('254');
    expect(chart().getAttribute('class')).toContain('touch-pan-y');
    for (const label of chart().querySelectorAll('text')) {
      expect(label.getAttribute('class')).toContain(label.textContent === '!' ? 'text-[10px]' : 'text-[11px]');
    }
  });

  it('a tap or a drag picks the nearest weigh-in', async () => {
    await renderChart();
    const marker = chart().querySelector<SVGCircleElement>('[data-weigh-in="w-sep1"]')!;
    const hitArea = chart().querySelector<SVGRectElement>('[data-hit-area]')!;

    await act(async () => hitArea.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: Number(marker.getAttribute('cx')) + 3, clientY: Number(marker.getAttribute('cy')) - 2,
    })));

    expect(readout()).toContain('9 kg');
    expect(readout()).toContain('1 sept.');

    // A finger dragging across the chart
    await pointer('pointermove', 'w-aug', { pointerType: 'touch', buttons: 1 });
    expect(readout()).toContain('1 août');
  });

  it('a pointer moving with no button pressed never changes the selection (a mouse on its way to the readout\'s buttons)', async () => {
    await renderChart();

    await pointer('pointermove', 'w-sep1', { pointerType: 'mouse', buttons: 0 });
    expect(readout()).toContain('1 oct.');
    await pointer('pointermove', 'w-sep1', { pointerType: 'touch', buttons: 0 });
    expect(readout()).toContain('1 oct.');
    // A mouse drag does
    await pointer('pointermove', 'w-sep1', { pointerType: 'mouse', buttons: 1 });
    expect(readout()).toContain('1 sept.');
  });

  it('the list folds open under the chart: the last 3 weigh-ins, then all of them, each one editable', async () => {
    await renderChart();
    const toggle = buttonWithText('Voir toutes les pesées (4)')!;

    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toContain('10,4 kg');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await act(async () => toggle.click());
    expect(rows()).toHaveLength(4);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Réduire');
    expect(document.querySelectorAll('tbody button[aria-label^="Modifier la pesée du "]')).toHaveLength(4);
  });

  it('delete asks first, then deletes the selected weigh-in', async () => {
    const onDeleteActivity = vi.fn();
    await renderChart({ onDeleteActivity });
    const readoutCard = document.querySelector('[aria-live="polite"]')!;

    await act(async () => readoutCard.querySelector<HTMLButtonElement>('button[aria-label="Supprimer la pesée du 1 oct."]')!.click());
    expect(onDeleteActivity).not.toHaveBeenCalled();
    // The question names the weigh-in it deletes
    expect(document.body.textContent).toContain('Supprimer la pesée du 1 oct. (10,4 kg)\u00a0?');
    await act(async () => buttonWithText(fr.common.delete)!.click());

    expect(onDeleteActivity).toHaveBeenCalledWith('w-oct');
  });

  it('a weigh-in that looks like a typo is marked "À vérifier" with a "!", out of the line and the tiles until edited', async () => {
    const container = await renderChart({ activities: [...weighIns, weighIn('w-typo', '2026-10-08', 104)] });

    expect(readout()).toContain('104 kg');
    expect(readout()).toContain(fr.weightChart.checkBadge);
    expect(readout()).toContain(fr.weightChart.checkReason);
    expect(rows()[0]).toContain(fr.weightChart.checkBadge);
    expect(chart().querySelector('[data-weigh-in="w-typo"]')!.parentElement!.textContent).toBe('!');
    expect(tile('weight')).toContain('10,4 kg');
    expect(container.querySelector('[data-line]')!.getAttribute('d')!.match(/[ML]/g)).toHaveLength(4);
  });

  it('no vet or home distinction: a weigh-in noted with a product name looks like any other', async () => {
    const container = await renderChart({ activities: [...weighIns.slice(0, 3), weighIn('w-oct', '2026-10-01', 10.4, 'Credelio Plus')] });

    expect(container.textContent).not.toMatch(/[Vv]éto|Vétérinaire/);
    expect(chart().querySelectorAll('[data-weigh-in]')).toHaveLength(4);
    expect([...chart().querySelectorAll('[data-weigh-in]')].every((marker) => marker.tagName === 'circle')).toBe(true);
  });

  it('no weigh-in yet: the expected zone only, and a line asking to weigh the dog', async () => {
    const container = await renderChart({ activities: [] });

    expect(readout()).toBe('Pas encore de pesée. Touche «\u00a0Peser le chiot\u00a0» pour voir la courbe de Rex.');
    expect(chart().querySelector('[data-band]')).not.toBeNull();
    expect(chart().querySelectorAll('[data-weigh-in]')).toHaveLength(0);
    expect(container.querySelector('table')).toBeNull();
    expect(tile('weight')).toBe('Poids—aucune');
  });

  it('a breed the app does not know, no adult weight typed, no weigh-in: no adult figure (the 13 kg fallback is made up)', async () => {
    await renderChart({ activities: [], profile: { ...puppy, breed: 'Unknown Breed' } });

    expect(tile('adult')).toBe('Adulte—≥\u00a01\u00a0pesée');
  });

  it('tile sub-lines fit a 320 px phone in French and English: 12 characters at most, wrapped rather than cut', async () => {
    for (const dictionary of [fr, en]) {
      for (const key of ['noWeighInYet', 'paceNeedsTwo', 'paceNeedsWeek', 'adultEstimated', 'adultFromBreed', 'adultNeedsWeighIn'] as const) {
        expect(dictionary.weightChart[key].length, `${key}: ${dictionary.weightChart[key]}`).toBeLessThanOrEqual(12);
      }
    }
    await renderChart({ activities: [] });

    for (const tileElement of document.querySelectorAll('[data-tile]')) {
      expect(tileElement.lastElementChild!.className).not.toContain('truncate');
    }
  });

  it('one weigh-in: one dot, and no pace yet; ages in weeks before 16 weeks', async () => {
    await renderChart({ activities: [weighIn('w-may', '2026-05-20', 4.1)] });

    expect(chart().querySelectorAll('[data-weigh-in]')).toHaveLength(1);
    expect(tile('pace')).toBe('Rythme—≥\u00a02\u00a0pesées');
    expect(readout()).toContain('20 mai · 11\u00a0sem.');
  });

  it('a breed the app does not know, with no adult weight typed: no expected zone', async () => {
    await renderChart({ profile: { ...puppy, breed: 'Labradoodle' } });

    expect(chart().querySelector('[data-band]')).toBeNull();
  });

  it('the 3-month zoom', async () => {
    await renderChart();
    const zoom = buttonWithText(fr.weightChart.periodQuarter)!;

    await act(async () => zoom.click());

    expect(zoom.getAttribute('aria-pressed')).toBe('true');
    expect(buttonWithText(fr.weightChart.periodYear)!.getAttribute('aria-pressed')).toBe('false');
    expect(chart().textContent).not.toContain('12\u00a0mois');
  });

  it('a dog over a year old: the full view is "Tout", not "1 an"', async () => {
    await renderChart({ profile: { ...puppy, birthDate: '2024-09-01' } });

    expect(buttonWithText(fr.weightChart.periodAll)!.getAttribute('aria-pressed')).toBe('true');
    expect(buttonWithText(fr.weightChart.periodYear)).toBeUndefined();
  });

  it('editing a weigh-in from the list checks the typed weight against the weigh-ins either side of it', async () => {
    await renderChart();
    // The 15 Sep row, between 9 kg (1 Sep) and 10,4 kg (1 Oct)
    const editButton = document.querySelectorAll<HTMLButtonElement>('tbody button[aria-label^="Modifier la pesée du "]')[1];

    await act(async () => {
      editButton.click();
      await import('../QuickLogModal');
    });
    await typeIn('quicklog-weight-kg', '96');
    expect(document.querySelector('[role="status"]')!.textContent).toBe('Vérifie la virgule\u00a0: 96\u00a0kg\u00a0?');

    await typeIn('quicklog-weight-kg', '9,7');
    expect(document.querySelector('[role="status"]')).toBeNull();
  });
});
