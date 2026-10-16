// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ActivityTimeline } from '../ActivityTimeline';
import type { Activity, ActivityType, Caretaker, PuppyProfile } from '../../types';

// Backlog item 26, on a made-up dog. Now: 15 Oct 2026, noon in Paris (npm test pins TZ=Europe/Paris).

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const log = (id: string, type: ActivityType, timestamp: string, extra: Partial<Activity> = {}): Activity =>
  ({ id, puppyId: puppy.id, type, timestamp, loggedBy: 'Sam', ...extra });

const activities = [
  log('act-poop', 'poop', '2026-10-15T08:15:00+02:00'),
  // A day runs from 04:00 to 04:00: this pee belongs to yesterday
  log('act-late-pee', 'pee', '2026-10-15T00:30:00+02:00'),
  log('act-accident', 'pee', '2026-10-14T20:00:00+02:00', { pottyLocation: 'indoor_accident' }),
];

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
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

/** Renders the feed in `lang` with every day open. */
async function renderFeed(lang: 'en' | 'fr', list: Activity[] = activities, caretakers: Caretaker[] = []) {
  localStorage.setItem('puppace_lang_v1', lang);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(
    <ActivityTimeline activities={list} caretakers={caretakers} activePuppy={puppy} onDeleteActivity={vi.fn()} referenceTime={new Date()} />
  ));
  const expandAll = [...container.querySelectorAll('button')].find((button) => button.textContent === (lang === 'fr' ? 'Tout déplier' : 'Expand All'))!;
  await act(async () => expandAll.click());
  return container;
}

// Each row's time is the span before its "•"
const rowTimes = (container: HTMLElement) =>
  [...container.querySelectorAll('span')].filter((span) => span.nextElementSibling?.textContent === '•').map((span) => span.textContent);
const titles = (container: HTMLElement) => [...container.querySelectorAll('[title]')].map((element) => element.getAttribute('title'));
const eventBadges = (container: HTMLElement) =>
  [...container.querySelectorAll('button[aria-expanded] span')].map((span) => span.textContent!).filter((text) => /event|événement/.test(text));

describe('activity feed day groups (backlog item 26)', () => {
  it('in French, rows show only the time: the 00:30 pee under "Hier" never reads "Aujourd\'hui"; counts read "1 événement", "2 pipis", "0 caca"', async () => {
    const container = await renderFeed('fr');

    expect(rowTimes(container)).toEqual(['08:15', '00:30', '20:00']);
    expect(eventBadges(container)).toEqual(['1 événement', '2 événements']);
    expect(titles(container)).toEqual(expect.arrayContaining(['0 pipi', '1 caca', '2 pipis', '0 caca', '1 accident']));
    expect(container.textContent).toContain('0\u00a0g · 0 repas');
    expect(container.textContent).not.toContain('(s)');
  });

  it('in English, rows show the 24 h time with no day; counts read "1 event", "2 events", "0 poops", "0 meals"', async () => {
    const container = await renderFeed('en');

    expect(rowTimes(container)).toEqual(['08:15', '00:30', '20:00']);
    expect(eventBadges(container)).toEqual(['1 event', '2 events']);
    expect(titles(container)).toEqual(expect.arrayContaining(['0 pees', '1 poop', '2 pees', '0 poops', '1 accident']));
    expect(container.textContent).toContain('0\u00a0g · 0 meals');
    expect(container.textContent).not.toContain('(s)');
  });

  // The chip sits next to the row title "Caca": its word agrees with it, unlike the form's "Selles molles"
  it('in French, the stool chip agrees with "Caca": "Mou", "Dur (constipation)", never "Molles" or "Dures"', async () => {
    const container = await renderFeed('fr', [
      log('act-soft', 'poop', '2026-10-15T09:00:00+02:00', { pottyLocation: 'outside', stoolConsistency: 'soft' }),
      log('act-hard', 'poop', '2026-10-15T10:00:00+02:00', { stoolConsistency: 'hard' }),
      log('act-normal', 'poop', '2026-10-15T11:00:00+02:00', { stoolConsistency: 'normal' }),
    ]);
    const spans = [...container.querySelectorAll('span')].map((span) => span.textContent);

    expect(spans).toEqual(expect.arrayContaining(['Mou', 'Dur (constipation)', 'Normal']));
    expect(container.textContent).not.toMatch(/Molles|Dures|Normales/);
  });

  // App review 2026-10-16, section 3: CSS capitalize gave "Ven. 16 Oct."; only the first letter is a capital
  it('in French, a day header starts with a capital and keeps the rest lower case: "Mardi 13 oct.", "Aujourd\'hui • jeu. 15 oct."', async () => {
    const container = await renderFeed('fr', [...activities, log('act-older', 'pee', '2026-10-13T09:00:00+02:00')]);
    const headers = [...container.querySelectorAll('button[aria-expanded] span.font-extrabold')];

    expect(headers.map((header) => header.textContent)).toEqual(['Aujourd\'hui • jeu. 15 oct.', 'Hier • mer. 14 oct.', 'Mardi 13 oct.']);
    expect(headers.some((header) => header.classList.contains('capitalize'))).toBe(false);
  });

  // App review 2026-10-16, section 3: a dark badge colour made the name unreadable (1.95:1); the colour stays on the dot and the outline
  it('the caretaker\'s name is written in the feed\'s text colour; the badge colour marks the dot and the outline', async () => {
    const darkBadge: Caretaker = { id: 'c-1', name: 'Sam', role: 'Member', color: '#1E3A8A' };
    const container = await renderFeed('en', [log('act-pee', 'pee', '2026-10-15T09:00:00+02:00')], [darkBadge]);
    const namePill = container.querySelector<HTMLElement>('[title="Sam"]')!;

    expect(namePill.style.color).toBe('');
    expect(namePill.style.borderColor).toBe('rgb(30, 58, 138)');
    expect([...container.querySelectorAll<HTMLElement>('[style]')].some((element) => element.style.backgroundColor === 'rgb(30, 58, 138)')).toBe(true);
  });
});
