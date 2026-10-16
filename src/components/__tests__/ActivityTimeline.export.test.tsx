// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ActivityTimeline } from '../ActivityTimeline';
import { exportActivitiesToCSV, printActivitiesReport } from '../../utils/export';
import { en } from '../../i18n/en';
import type { Activity, PuppyProfile } from '../../types';

vi.mock('../../utils/export', () => ({ exportActivitiesToCSV: vi.fn(() => true), printActivitiesReport: vi.fn(() => true) }));

// Pre-fill review item 29 (owner decision 2026-10-14): the export is what the feed shows, and the report prints its dates
const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const referenceTime = new Date('2026-08-20T10:00:00.000Z');
// One pee a day at 12:00 Paris, from 20 Aug back to 1 Aug: 14 days loaded beyond the 7 shown
const activities: Activity[] = Array.from({ length: 20 }, (_, index) => ({
  id: `act-${index}`, puppyId: puppy.id, type: 'pee', pottyLocation: 'outside', loggedBy: 'Owner',
  timestamp: new Date(referenceTime.getTime() - index * 24 * 60 * 60 * 1000).toISOString(),
}));

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

async function renderTimeline({ shownActivities = activities, hasMoreRemote = false, unsavedIds = new Set<string>() } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<ActivityTimeline activities={shownActivities} caretakers={[]} activePuppy={puppy} onDeleteActivity={vi.fn()} hasMoreRemote={hasMoreRemote} referenceTime={referenceTime} unsavedIds={unsavedIds} />);
  });
}

const buttonContaining = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent!.includes(text))!;

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function exportAs(label: string) {
  await click(document.querySelector<HTMLButtonElement>(`button[title="${en.dashboard.export}"]`)!);
  await click(buttonContaining(label));
}

const exportedIds = (mock: unknown) => (vi.mocked(mock as typeof exportActivitiesToCSV).mock.calls[0][0] as Activity[]).map((activity) => activity.id);
const shownIds = activities.slice(0, 7).map((activity) => activity.id);

describe('Activity feed export (pre-fill review item 29)', () => {
  it('the CSV holds the 7 days on screen, not every log loaded', async () => {
    await renderTimeline();
    await exportAs(en.dashboard.exportCsv);

    expect(exportedIds(exportActivitiesToCSV)).toEqual(shownIds);
  });

  it('the printed report holds the 7 days on screen and gets their first and last day', async () => {
    await renderTimeline();
    await exportAs(en.dashboard.exportPdf);

    expect(exportedIds(printActivitiesReport)).toEqual(shownIds);
    expect(vi.mocked(printActivitiesReport).mock.calls[0][5]).toEqual({ from: '2026-08-14', to: '2026-08-20' });
  });

  it('after "load more", the export follows the wider window', async () => {
    await renderTimeline();
    await click(buttonContaining(en.dashboard.loadEarlier.replace('{days}', '14')));
    await exportAs(en.dashboard.exportPdf);

    expect(exportedIds(printActivitiesReport)).toHaveLength(14);
    expect(vi.mocked(printActivitiesReport).mock.calls[0][5]).toEqual({ from: '2026-08-07', to: '2026-08-20' });
  });

  it('all time: the report starts on the oldest day shown', async () => {
    await renderTimeline({ hasMoreRemote: true });
    for (const days of ['14', '30', '90', '180']) await click(buttonContaining(en.dashboard.loadEarlier.replace('{days}', days)));
    await click(buttonContaining(en.dashboard.loadAllLogs));
    await exportAs(en.dashboard.exportPdf);

    expect(exportedIds(printActivitiesReport)).toHaveLength(20);
    expect(vi.mocked(printActivitiesReport).mock.calls[0][5]).toEqual({ from: '2026-08-01', to: '2026-08-20' });
  });

  it('no log in the days shown: no export, even with older logs loaded', async () => {
    await renderTimeline({ shownActivities: activities.slice(7) });

    expect(document.querySelector(`button[title="${en.dashboard.export}"]`)).toBeNull();
  });

  // App review 2026-10-16, decision 8: a log the server never took is not in the family's records
  it('a log marked "not saved" stays out of the CSV and the print', async () => {
    await renderTimeline({ unsavedIds: new Set(['act-0']) });
    await exportAs(en.dashboard.exportCsv);
    await exportAs(en.dashboard.exportPdf);

    expect(exportedIds(exportActivitiesToCSV)).toEqual(shownIds.slice(1));
    expect(exportedIds(printActivitiesReport)).toEqual(shownIds.slice(1));
  });
});
