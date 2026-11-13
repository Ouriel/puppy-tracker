// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ActivityTimeline } from '../ActivityTimeline';
import type { Activity, PuppyProfile } from '../../types';

// Editing a weigh-in from the feed checks the decimal point as the passport chart does. Now: 15 Oct 2026, noon in Paris.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const weighIn = (id: string, date: string, weightKg: number): Activity =>
  ({ id, puppyId: puppy.id, type: 'weight', timestamp: `${date}T08:00:00.000Z`, weightKg, loggedBy: 'Sam' });
// Weigh-ins come weeks apart: the feed's recent window holds only the last one
const allWeighIns = [weighIn('w-sep1', '2026-09-01', 9), weighIn('w-sep15', '2026-09-15', 9.6), weighIn('w-oct', '2026-10-01', 10.4), weighIn('w-last', '2026-10-12', 10.8)];
const feed = [allWeighIns[3]];

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
  localStorage.setItem('puppace_lang_v1', 'en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00+02:00'));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

async function typeIn(id: string, text: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('editing a weigh-in from the feed', () => {
  it('warns when the typed weight is 10 times off the weigh-ins either side of it', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(
      <ActivityTimeline
        activities={feed}
        weightActivities={allWeighIns}
        caretakers={[]}
        activePuppy={puppy}
        onDeleteActivity={vi.fn()}
        onUpdateActivity={vi.fn().mockResolvedValue(true)}
        referenceTime={new Date()}
      />
    ));
    const expandAll = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Expand All')!;
    await act(async () => expandAll.click());

    const editButton = container.querySelector<HTMLButtonElement>('button[aria-label^="Edit weight "]')!;
    await act(async () => {
      editButton.click();
      await import('../QuickLogModal');
    });
    await typeIn('quicklog-weight-kg', '1,08');
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Check the decimal point: 1.08 kg?');

    await typeIn('quicklog-weight-kg', '10,9');
    expect(document.querySelector('[role="status"]')).toBeNull();
  });
});
