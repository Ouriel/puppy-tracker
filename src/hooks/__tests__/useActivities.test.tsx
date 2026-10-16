// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useActivities } from '../useActivities';
import { clearApiCache } from '../../services/api';
import { en } from '../../i18n/en';
import type { Activity, ActivityType, PuppyProfile } from '../../types';

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-01-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const HOUR_MS = 60 * 60 * 1000;

interface SentRequest {
  url: string;
  method: string;
  body?: Activity;
  answer: (status: number, body?: unknown) => Promise<void>;
}

let root: Root | null = null;
let hook: ReturnType<typeof useActivities>;
let sent: SentRequest[] = [];
/** When set, answers every GET at once, like the server would. */
let answerGet: ((url: URL) => unknown) | null = null;

function HookProbe({ onRender }: { onRender: (state: ReturnType<typeof useActivities>) => void }) {
  onRender(useActivities(puppy, { skipInitialFetch: true }));
  return null;
}

/** Fetches the dog's recent logs on mount and on each dog switch, like a dog picked in the navbar. */
function DogProbe({ dog, onRender }: { dog: PuppyProfile; onRender: (state: ReturnType<typeof useActivities>) => void }) {
  onRender(useActivities(dog));
  return null;
}

/** Lets pending responses and React updates finish. */
async function settle() {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit = {}) => new Promise<Response>((resolve) => {
    const method = init.method ?? 'GET';
    if (method === 'GET' && answerGet) {
      resolve(new Response(JSON.stringify(answerGet(new URL(url, 'http://localhost')))));
    }
    sent.push({
      url,
      method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      answer: async (status, body = {}) => {
        resolve(new Response(JSON.stringify(body), { status }));
        await settle();
      },
    });
  })));
}

/** Starts a hook call without waiting for its request to be answered. */
async function start(action: () => Promise<unknown>) {
  await act(async () => {
    void action();
  });
}

function log(id: string, hoursAgo: number, type: ActivityType = 'pee'): Activity {
  return { id, puppyId: puppy.id, type, timestamp: new Date(Date.now() - hoursAgo * HOUR_MS).toISOString(), loggedBy: 'Owner' };
}

function newLog(type: ActivityType): Omit<Activity, 'id'> {
  return { puppyId: puppy.id, type, timestamp: new Date().toISOString(), loggedBy: 'Owner' };
}

const ids = () => hook.activities.map((activity) => activity.id);
const posts = () => sent.filter((request) => request.method === 'POST');
/** The request sent for a row, matched by its id in the body or the query string. */
const requestFor = (id: string) => sent.find((request) => request.body?.id === id || request.url.includes(`id=${id}`))!;

async function showRecentLogs(rows: Activity[]) {
  await act(async () => hook.setActivitiesForPuppy(rows, puppy.id));
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  sent = [];
  answerGet = null;
  localStorage.clear();
  clearApiCache();
  stubFetch();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<HookProbe onRender={(state) => { hook = state; }} />));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useActivities: a failed change rolls back only itself (N5)', () => {
  it('a failed add removes only its own row: a later add that succeeds stays', async () => {
    await start(() => hook.addActivity(newLog('pee')));
    await start(() => hook.addActivity(newLog('poop')));
    const [peePost, poopPost] = posts();

    await peePost.answer(500, { error: 'Internal server error' });
    await poopPost.answer(201, poopPost.body);

    expect(ids()).toEqual([poopPost.body!.id]);
  });

  it('a failed pee removes only itself: the pee already in the timeline stays', async () => {
    await showRecentLogs([log('act-old', 2)]);
    await start(() => hook.addActivity(newLog('pee')));

    await posts()[0].answer(500, { error: 'Internal server error' });

    expect(ids()).toEqual(['act-old']);
  });

  it('two failed adds leave no ghost row', async () => {
    await start(() => hook.addActivity(newLog('pee')));
    await start(() => hook.addActivity(newLog('poop')));
    const [peePost, poopPost] = posts();

    await peePost.answer(500, { error: 'Internal server error' });
    await poopPost.answer(500, { error: 'Internal server error' });

    expect(ids()).toEqual([]);
  });

  it('a failed edit restores only its own row: an edit saved meanwhile on another row is kept', async () => {
    await showRecentLogs([log('act-x', 1), log('act-y', 2)]);
    await start(() => hook.updateActivity({ id: 'act-x', notes: 'x edited' }));
    await start(() => hook.updateActivity({ id: 'act-y', notes: 'y edited' }));

    await requestFor('act-y').answer(200, { ...log('act-y', 2), notes: 'y edited' });
    await requestFor('act-x').answer(500, { error: 'Internal server error' });

    expect(hook.activities.map((activity) => [activity.id, activity.notes])).toEqual([['act-x', undefined], ['act-y', 'y edited']]);
  });

  it('a failed delete restores only its own row: a row deleted meanwhile stays deleted', async () => {
    await showRecentLogs([log('act-x', 1), log('act-y', 2)]);
    await start(() => hook.deleteActivity('act-x'));
    await start(() => hook.deleteActivity('act-y'));

    await requestFor('act-y').answer(200, { success: true, deletedId: 'act-y' });
    await requestFor('act-x').answer(500, { error: 'Internal server error' });

    expect(ids()).toEqual(['act-x']);
  });
});

// The edit form closes only once the edit is saved, and keeps what was typed when it is refused
it('an edit resolves to whether it was saved', async () => {
  await showRecentLogs([log('act-x', 1), log('act-y', 2)]);

  let refused: boolean | undefined;
  let saved: boolean | undefined;
  await start(async () => { refused = await hook.updateActivity({ id: 'act-x', notes: 'refused' }); });
  await requestFor('act-x').answer(500, { error: 'Internal server error' });
  await start(async () => { saved = await hook.updateActivity({ id: 'act-y', notes: 'saved' }); });
  await requestFor('act-y').answer(200, { ...log('act-y', 2), notes: 'saved' });

  expect([refused, saved]).toEqual([false, true]);
});

describe('useActivities: history loaded with "load more" (N4 + P3)', () => {
  /** The server's logs, newest first (default: 1200 logs, 24 a day): like GET /api/activities with days, limit and offset. */
  function serveHistory(history = Array.from({ length: 1200 }, (_unused, index) => log(`act-${index}`, index + 0.5))) {
    answerGet = (url) => {
      const days = Number(url.searchParams.get('days')) || Infinity;
      const offset = Number(url.searchParams.get('offset')) || 0;
      const limit = Number(url.searchParams.get('limit'));
      return history
        .filter((activity) => Date.now() - Date.parse(activity.timestamp) <= days * 24 * HOUR_MS)
        .slice(offset, offset + limit);
    };
    return history;
  }

  /** One log every 2 h, newest first: the 14-day window holds 168 logs, under the 300 limit. */
  const everyTwoHours = (count: number) => Array.from({ length: count }, (_unused, index) => log(`act-${index}`, index * 2 + 1));
  const lastDays = (rows: Activity[], days: number) => rows.filter((activity) => Date.now() - Date.parse(activity.timestamp) <= days * 24 * HOUR_MS);
  const sentOffset = () => new URL(sent.at(-1)!.url, 'http://localhost').searchParams.get('offset');

  const oldestLoadedDaysAgo = () =>
    Math.floor((Date.now() - Math.min(...hook.activities.map((activity) => Date.parse(activity.timestamp)))) / (24 * HOUR_MS));

  it('pages through the history: 1200 logs load past 33 days', async () => {
    const history = serveHistory();
    // The dashboard window: the newest 300 logs
    await showRecentLogs(history.slice(0, 300));

    for (const days of [30, 90]) {
      await act(async () => hook.loadMoreActivities(days));
    }

    expect(oldestLoadedDaysAgo()).toBeGreaterThan(33);
    expect(new Set(ids()).size).toBe(hook.activities.length);
  });

  it('a refresh keeps the older logs loaded with "load more", so the next "load more" continues where it stopped', async () => {
    const history = serveHistory();
    await showRecentLogs(history.slice(0, 300));
    await act(async () => hook.loadMoreActivities(30));
    const loadedCount = hook.activities.length;

    // Return to the app: the dashboard sends the same 14-day window again
    await showRecentLogs(history.slice(0, 300));

    expect(hook.activities.length).toBe(loadedCount);
    sent = [];
    await act(async () => hook.loadMoreActivities(90));
    expect(new URL(sent[0].url, 'http://localhost').searchParams.get('offset')).toBe(String(loadedCount));
  });

  it('a refresh keeps an older log that shares its time with the oldest log of a full window', async () => {
    const history = Array.from({ length: 300 }, (_unused, index) => log(`act-${index}`, index + 0.5));
    history.push({ ...log('act-300', 0), timestamp: history[299].timestamp });
    serveHistory(history);
    await showRecentLogs(history.slice(0, 300));
    await act(async () => hook.loadMoreActivities(30));
    expect(ids()).toContain('act-300');

    await showRecentLogs(history.slice(0, 300));

    expect(ids()).toContain('act-300');
  });

  it('a log back-dated before the loaded history does not shift the next page, so no older log is skipped', async () => {
    const history = serveHistory(everyTwoHours(480));
    await showRecentLogs(lastDays(history, 14));
    // A weight from a vet visit 20 days ago, entered now
    await start(() => hook.addActivity({ ...newLog('weight'), timestamp: new Date(Date.now() - 20 * 24 * HOUR_MS).toISOString(), weightKg: 8 }));
    await posts()[0].answer(201, posts()[0].body);
    history.push(posts()[0].body!);
    history.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

    await act(async () => hook.loadMoreActivities(30));

    expect(sentOffset()).toBe('168');
    expect(ids()).toContain('act-168');
  });

  it('a log whose save is still in flight does not shift the next page', async () => {
    const history = serveHistory(everyTwoHours(480));
    await showRecentLogs(lastDays(history, 14));
    await start(() => hook.addActivity(newLog('pee')));

    await act(async () => hook.loadMoreActivities(30));

    expect(sentOffset()).toBe('168');
    expect(ids()).toContain('act-168');

    // Once saved, it counts: the 360 logs of 30 days and the pee
    await posts()[0].answer(201, posts()[0].body);
    history.unshift(posts()[0].body!);
    await act(async () => hook.loadMoreActivities(90));
    expect(sentOffset()).toBe('361');
  });

  it('a quick log kept as not saved does not shift the next page', async () => {
    const history = serveHistory(everyTwoHours(480));
    await showRecentLogs(lastDays(history, 14));
    await start(() => hook.addActivity(newLog('pee'), { keepUnsaved: true }));
    await posts()[0].answer(500, { error: 'Internal server error' });

    await act(async () => hook.loadMoreActivities(30));

    expect(sentOffset()).toBe('168');
  });

  it('the next page starts after the selected dog\'s logs only, when the window holds every dog\'s logs', async () => {
    const history = serveHistory(everyTwoHours(480));
    const otherDogLogs = Array.from({ length: 20 }, (_unused, index) => ({ ...log(`other-${index}`, index * 2 + 2), puppyId: 'pup-2' }));
    // No dog chosen yet on this device: the dashboard sends every dog's logs
    await showRecentLogs([...lastDays(history, 14), ...otherDogLogs]);

    await act(async () => hook.loadMoreActivities(30));

    expect(sentOffset()).toBe('168');
  });

  it('a refresh of the same dog keeps "load more" once a page came back full; a switch to another dog resets it', async () => {
    const history = serveHistory(everyTwoHours(1440));
    await showRecentLogs(lastDays(history, 14));
    expect(hook.hasMoreRemoteActivities).toBe(false);
    await act(async () => hook.loadMoreActivities(90));
    expect(hook.hasMoreRemoteActivities).toBe(true);

    await showRecentLogs(lastDays(history, 14));
    expect(hook.hasMoreRemoteActivities).toBe(true);

    await act(async () => hook.setActivitiesForPuppy([{ ...log('other-1', 1), puppyId: 'pup-2' }], 'pup-2'));
    expect(hook.hasMoreRemoteActivities).toBe(false);
  });

  it('a refresh drops a log deleted on another phone inside the window, and keeps the older ones', async () => {
    const history = serveHistory();
    await showRecentLogs(history.slice(0, 300));
    await act(async () => hook.loadMoreActivities(30));
    const loadedCount = hook.activities.length;

    // The server's window: still its newest 300 logs, without the deleted one
    await showRecentLogs(history.slice(1, 301));

    expect(hook.activities.length).toBe(loadedCount - 1);
    expect(ids()).not.toContain('act-0');
  });
});

describe('useActivities: a dog switch fetches the same recent window as the dashboard', () => {
  it('asks for 300 logs, shows "load more" only when 300 came back, and "load more" continues after them', async () => {
    const logsOf = (dogId: string, count: number) => Array.from({ length: count }, (_unused, index) => ({ ...log(`${dogId}-${index}`, index + 0.5), puppyId: dogId }));
    answerGet = (url) => logsOf(url.searchParams.get('puppyId')!, url.searchParams.get('puppyId') === 'pup-3' ? 300 : 299);
    const switchTo = async (dog: PuppyProfile) => {
      await act(async () => root!.render(<DogProbe dog={dog} onRender={(state) => { hook = state; }} />));
      await settle();
    };

    await switchTo(puppy);
    await switchTo({ ...puppy, id: 'pup-2', name: 'Second' });

    // The recent window, not the weigh-ins and medications fetched with it
    const switchRequest = new URL(sent.filter((request) => !request.url.includes('type=')).at(-1)!.url, 'http://localhost');
    expect(switchRequest.searchParams.get('puppyId')).toBe('pup-2');
    expect(switchRequest.searchParams.get('limit')).toBe('300');
    expect(hook.hasMoreRemoteActivities).toBe(false);
    await act(async () => hook.loadMoreActivities(30));
    expect(new URL(sent.at(-1)!.url, 'http://localhost').searchParams.get('offset')).toBe('299');

    await switchTo({ ...puppy, id: 'pup-3', name: 'Third' });
    expect(hook.hasMoreRemoteActivities).toBe(true);
  });

  // Review 2026-10-16: the dimmed dashboard lets a log be made while the switch's request runs; its answer, read before
  // the log was stored, used to replace the rows and drop it from the screen
  it('keeps a log saved while its request ran: the answer read before it was stored does not drop it', async () => {
    const secondDog: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Second' };
    answerGet = () => [];
    await act(async () => root!.render(<DogProbe dog={puppy} onRender={(state) => { hook = state; }} />));
    await settle();
    answerGet = null;
    await act(async () => root!.render(<DogProbe dog={secondDog} onRender={(state) => { hook = state; }} />));
    const switchRequests = sent.filter((request) => request.method === 'GET' && request.url.includes('puppyId=pup-2'));

    await start(() => hook.addActivity({ ...newLog('pee'), puppyId: 'pup-2' }));
    const peeId = posts()[0].body!.id;
    await posts()[0].answer(201, posts()[0].body);
    for (const request of switchRequests) await request.answer(200, []);

    expect(ids()).toContain(peeId);
  });

  it('a log deleted while its request ran does not come back with the answer', async () => {
    const secondDog: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Second' };
    const pee = { ...log('act-2', 1), puppyId: 'pup-2' };
    answerGet = () => [];
    await act(async () => root!.render(<DogProbe dog={puppy} onRender={(state) => { hook = state; }} />));
    await settle();
    answerGet = null;
    await act(async () => root!.render(<DogProbe dog={secondDog} onRender={(state) => { hook = state; }} />));
    const switchRequests = sent.filter((request) => request.method === 'GET' && request.url.includes('puppyId=pup-2'));

    // A row of the second dog on screen (the passport, a log made at once) deleted before the answer
    await act(async () => hook.setActivities((previous) => [pee, ...previous]));
    await start(() => hook.deleteActivity('act-2'));
    await requestFor('act-2').answer(200, { success: true, deletedId: 'act-2' });
    for (const request of switchRequests) await request.answer(200, request.url.includes('type=weight') ? [] : [pee]);

    expect(ids()).not.toContain('act-2');
  });
});

describe('useActivities: a dashboard answer read before a local change (C1)', () => {
  it('does not resurrect a log deleted after the request was sent', async () => {
    await showRecentLogs([log('act-x', 1), log('act-y', 2)]);
    const mutationVersion = hook.getMutationVersion();
    await start(() => hook.deleteActivity('act-x'));
    await requestFor('act-x').answer(200, { success: true, deletedId: 'act-x' });

    await act(async () => hook.setActivitiesForPuppy([log('act-x', 1), log('act-y', 2)], puppy.id, mutationVersion));

    expect(ids()).toEqual(['act-y']);
  });

  it('does not undo an edit saved after the request was sent', async () => {
    await showRecentLogs([log('act-x', 1)]);
    const mutationVersion = hook.getMutationVersion();
    await start(() => hook.updateActivity({ id: 'act-x', notes: 'edited' }));
    await requestFor('act-x').answer(200, { ...log('act-x', 1), notes: 'edited' });

    await act(async () => hook.setActivitiesForPuppy([log('act-x', 1)], puppy.id, mutationVersion));

    expect(hook.activities.map((activity) => activity.notes)).toEqual(['edited']);
  });

  it('does not drop a log whose save is still in flight', async () => {
    await showRecentLogs([log('act-y', 2)]);
    const mutationVersion = hook.getMutationVersion();
    await start(() => hook.addActivity(newLog('pee')));
    const addedId = posts()[0].body!.id;

    await act(async () => hook.setActivitiesForPuppy([log('act-y', 2)], puppy.id, mutationVersion));
    expect(ids()).toContain(addedId);

    await posts()[0].answer(201, posts()[0].body);
    expect(ids()).toEqual([addedId, 'act-y']);
  });

  it('an answer read after every change settled replaces the window as usual', async () => {
    await showRecentLogs([log('act-x', 1), log('act-y', 2)]);
    const mutationVersion = hook.getMutationVersion();

    await act(async () => hook.setActivitiesForPuppy([log('act-x', 1)], puppy.id, mutationVersion));

    expect(ids()).toEqual(['act-x']);
  });
});

describe('useActivities: double-log guard (owner decision 2026-10-13)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T08:00:00.000Z'));
  });

  async function logAfter(seconds: number, type: ActivityType) {
    vi.setSystemTime(Date.now() + seconds * 1000);
    await start(() => hook.addActivity(newLog(type)));
  }

  it('a second pee 1 s after the first is ignored, with an "already logged" toast', async () => {
    const warning = vi.spyOn(toast, 'warning');
    await logAfter(0, 'pee');
    await logAfter(1, 'pee');

    expect(posts()).toHaveLength(1);
    expect(hook.activities).toHaveLength(1);
    expect(warning).toHaveBeenCalledWith(en.toasts.alreadyLogged);
  });

  it('pee then poop logs both', async () => {
    await logAfter(0, 'pee');
    await logAfter(1, 'poop');

    expect(posts().map((request) => request.body!.type)).toEqual(['pee', 'poop']);
  });

  it('a second pee 6 s after the first logs both', async () => {
    await logAfter(0, 'pee');
    await logAfter(6, 'pee');

    expect(posts()).toHaveLength(2);
  });

  it('a pee after the phone clock moved back is logged, not refused as already logged', async () => {
    await logAfter(0, 'pee');
    await logAfter(-3600, 'pee');

    expect(posts()).toHaveLength(2);
  });

  it('a pee whose save failed can be logged again at once', async () => {
    await logAfter(0, 'pee');
    await posts()[0].answer(500, { error: 'Internal server error' });
    await logAfter(1, 'pee');

    expect(posts()).toHaveLength(2);
  });
});

describe('useActivities: every weight event of the dog, whatever its date (Phase 5c)', () => {
  const weighIn = (id: string, daysAgo: number, weightKg: number): Activity => ({ ...log(id, daysAgo * 24, 'weight'), weightKg });
  const weightIds = () => hook.allTimeActivities.map((activity) => activity.id);

  it('a weigh-in older than the recent window can be edited and deleted', async () => {
    await act(async () => hook.setActivitiesForPuppy([log('act-pee', 1)], puppy.id, hook.getMutationVersion(), [weighIn('act-w-old', 40, 6.1)]));
    expect(weightIds()).toEqual(['act-w-old']);

    await start(() => hook.updateActivity({ id: 'act-w-old', weightKg: 6.2 }));
    expect(requestFor('act-w-old').method).toBe('PUT');
    await requestFor('act-w-old').answer(200, { ...weighIn('act-w-old', 40, 6.2) });
    expect(hook.allTimeActivities.map((activity) => activity.weightKg)).toEqual([6.2]);

    sent = [];
    await start(() => hook.deleteActivity('act-w-old'));
    expect(requestFor('act-w-old').method).toBe('DELETE');
    expect(weightIds()).toEqual([]);
    await requestFor('act-w-old').answer(200, { success: true, deletedId: 'act-w-old' });
    expect(ids()).toEqual(['act-pee']);
  });

  it('a weigh-in saved from any form joins the list; a failed save leaves it', async () => {
    await act(async () => hook.setActivitiesForPuppy([], puppy.id, hook.getMutationVersion(), [weighIn('act-w-old', 40, 6.1)]));
    await start(() => hook.addActivity({ ...newLog('weight'), weightKg: 8.4 }));
    const savedId = posts()[0].body!.id;
    expect(weightIds()).toEqual([savedId, 'act-w-old']);

    await posts()[0].answer(500, { error: 'Internal server error' });
    expect(weightIds()).toEqual(['act-w-old']);
  });

  it('an edit of a weigh-in older than the recent window shows at once; refused, it gets its old weight back', async () => {
    await act(async () => hook.setActivitiesForPuppy([], puppy.id, hook.getMutationVersion(), [weighIn('act-w-old', 40, 6.1)]));

    await start(() => hook.updateActivity({ id: 'act-w-old', weightKg: 6.2 }));
    expect(hook.allTimeActivities.map((activity) => activity.weightKg)).toEqual([6.2]);
    await requestFor('act-w-old').answer(500, { error: 'Internal server error' });

    expect(hook.allTimeActivities.map((activity) => [activity.id, activity.weightKg])).toEqual([['act-w-old', 6.1]]);
  });

  it('a refused delete of a weigh-in older than the recent window puts it back', async () => {
    await act(async () => hook.setActivitiesForPuppy([], puppy.id, hook.getMutationVersion(), [weighIn('act-w-old', 40, 6.1)]));

    await start(() => hook.deleteActivity('act-w-old'));
    expect(weightIds()).toEqual([]);
    await requestFor('act-w-old').answer(500, { error: 'Internal server error' });

    expect(hook.allTimeActivities.map((activity) => [activity.id, activity.weightKg])).toEqual([['act-w-old', 6.1]]);
  });

  it('a saved weigh-in takes the server\'s answer', async () => {
    await start(() => hook.addActivity({ ...newLog('weight'), weightKg: 8.4 }));

    await posts()[0].answer(201, { ...posts()[0].body, loggedBy: 'Signed-in Owner' });

    expect(hook.allTimeActivities.map((activity) => [activity.weightKg, activity.loggedBy])).toEqual([[8.4, 'Signed-in Owner']]);
  });

  it('a recent window sent without the weight list keeps it', async () => {
    await act(async () => hook.setActivitiesForPuppy([], puppy.id, hook.getMutationVersion(), [weighIn('act-w-old', 40, 6.1)]));

    await showRecentLogs([log('act-pee', 1)]);

    expect(weightIds()).toEqual(['act-w-old']);
  });

  it('a refresh read before a weigh-in was deleted does not bring it back', async () => {
    await act(async () => hook.setActivitiesForPuppy([], puppy.id, hook.getMutationVersion(), [weighIn('act-w-1', 40, 6.1), weighIn('act-w-2', 20, 7.3)]));
    const mutationVersion = hook.getMutationVersion();
    await start(() => hook.deleteActivity('act-w-1'));
    await requestFor('act-w-1').answer(200, { success: true, deletedId: 'act-w-1' });

    await act(async () => hook.setActivitiesForPuppy([], puppy.id, mutationVersion, [weighIn('act-w-1', 40, 6.1), weighIn('act-w-2', 20, 7.3)]));

    expect(weightIds()).toEqual(['act-w-2']);
  });

  it('a dog switch also loads every weigh-in of that dog', async () => {
    const secondDog: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Second' };
    // Like the server: a type query gets only that type (no medication here)
    answerGet = (url) => ({ weight: [{ ...weighIn('act-w-2', 60, 3.3), puppyId: 'pup-2' }], medication: [] })[url.searchParams.get('type') ?? '']
      ?? [{ ...log('act-pee-2', 1), puppyId: 'pup-2' }];

    await act(async () => root!.render(<DogProbe dog={secondDog} onRender={(state) => { hook = state; }} />));
    await settle();

    const weightRequest = sent.find((request) => request.url.includes('type=weight'))!;
    expect(new URL(weightRequest.url, 'http://localhost').searchParams.get('puppyId')).toBe('pup-2');
    expect(new URL(weightRequest.url, 'http://localhost').searchParams.get('days')).toBeNull();
    expect(weightIds()).toEqual(['act-w-2']);
    expect(ids()).toEqual(['act-pee-2']);
  });
});

// Owner decision C9 (carnet review 2026-10-16): the passport lists every medication, whatever its date
describe('useActivities: every medication of the dog too, whatever its date', () => {
  const medication = (id: string, daysAgo: number, medicationName: string): Activity => ({ ...log(id, daysAgo * 24, 'medication'), medicationName });
  const allTimeIds = () => hook.allTimeActivities.map((activity) => activity.id);

  it('a medication older than the recent window can be edited and stays in the list; deleted, it leaves', async () => {
    await act(async () => hook.setActivitiesForPuppy([log('act-pee', 1)], puppy.id, hook.getMutationVersion(), [medication('act-med-old', 40, 'Old-Med')]));

    await start(() => hook.updateActivity({ id: 'act-med-old', medicationName: 'Renamed-Med' }));
    expect(hook.allTimeActivities.map((activity) => activity.medicationName)).toEqual(['Renamed-Med']);
    await requestFor('act-med-old').answer(200, medication('act-med-old', 40, 'Renamed-Med'));
    expect(hook.allTimeActivities.map((activity) => activity.medicationName)).toEqual(['Renamed-Med']);
    expect(ids()).toEqual(['act-pee']);

    sent = [];
    await start(() => hook.deleteActivity('act-med-old'));
    await requestFor('act-med-old').answer(200, { success: true, deletedId: 'act-med-old' });
    expect(allTimeIds()).toEqual([]);
  });

  it('a medication saved from the log form joins the list', async () => {
    await start(() => hook.addActivity({ ...newLog('medication'), medicationName: 'New-Med' }));
    await posts()[0].answer(201, posts()[0].body);

    expect(hook.allTimeActivities.map((activity) => activity.medicationName)).toEqual(['New-Med']);
  });

  it('a dog switch also loads every medication of that dog', async () => {
    const secondDog: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Second' };
    answerGet = (url) => ({
      weight: [{ ...log('act-w-2', 60 * 24, 'weight'), weightKg: 3.3, puppyId: 'pup-2' }],
      medication: [{ ...medication('act-med-2', 90, 'Old-Med'), puppyId: 'pup-2' }],
    })[url.searchParams.get('type') ?? ''] ?? [{ ...log('act-pee-2', 1), puppyId: 'pup-2' }];

    await act(async () => root!.render(<DogProbe dog={secondDog} onRender={(state) => { hook = state; }} />));
    await settle();

    const medicationRequest = new URL(sent.find((request) => request.url.includes('type=medication'))!.url, 'http://localhost');
    expect(medicationRequest.searchParams.get('puppyId')).toBe('pup-2');
    expect(medicationRequest.searchParams.get('days')).toBeNull();
    expect(allTimeIds().sort()).toEqual(['act-med-2', 'act-w-2']);
    expect(ids()).toEqual(['act-pee-2']);
  });
});

// Backlog item 5: a quick log that could not be saved stays, marked, until it is sent again or discarded
describe('useActivities: a quick log kept as not saved', () => {
  it('a dog switch keeps it, still marked', async () => {
    const secondDog: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Second' };
    answerGet = () => [];
    await act(async () => root!.render(<DogProbe dog={puppy} onRender={(state) => { hook = state; }} />));
    await settle();
    await start(() => hook.addActivity(newLog('pee'), { keepUnsaved: true }));
    const peeId = posts()[0].body!.id;
    await posts()[0].answer(500, { error: 'Internal server error' });

    await act(async () => root!.render(<DogProbe dog={secondDog} onRender={(state) => { hook = state; }} />));
    await settle();

    expect(ids()).toContain(peeId);
    expect(hook.unsavedActivityIds.has(peeId)).toBe(true);
  });
});

// A save whose answer is lost may be stored: the log form keeps one id while open, so Save again never stores it twice
describe('useActivities: a log form saved again after a failure', () => {
  it('sends the same id', async () => {
    await start(() => hook.addActivity(newLog('food'), { id: 'act-form' }));
    await posts()[0].answer(500, { error: 'Internal server error' });
    await start(() => hook.addActivity(newLog('food'), { id: 'act-form' }));

    expect(posts().map((post) => post.body!.id)).toEqual(['act-form', 'act-form']);
  });

  it('shows its log once when a refresh brought it in meanwhile', async () => {
    await start(() => hook.addActivity(newLog('food'), { id: 'act-form' }));
    await posts()[0].answer(500, { error: 'Internal server error' });
    await showRecentLogs([log('act-form', 0, 'food')]);
    await start(() => hook.addActivity(newLog('food'), { id: 'act-form' }));

    expect(ids()).toEqual(['act-form']);
  });
});


// App review 2026-10-16, decision 7: a mis-tap ("Pipi dehors" for "Accident") took 2.8 screens of scrolling to fix
describe('useActivities: Undo after a one-tap log', () => {
  const peeOutside = (): Omit<Activity, 'id'> => ({ ...newLog('pee'), pottyLocation: 'outside' });
  const peeAccident = (): Omit<Activity, 'id'> => ({ ...newLog('pee'), pottyLocation: 'indoor_accident' });
  const deletes = () => sent.filter((request) => request.method === 'DELETE');

  /** Logs with one tap, saves it, and returns the success toast's Undo. */
  async function tapAndSave(activity: Omit<Activity, 'id'>) {
    const success = vi.spyOn(toast, 'success');
    await start(() => hook.addActivity(activity, { keepUnsaved: true }));
    const post = posts().at(-1)!;
    await post.answer(201, post.body);
    const [message, options] = success.mock.calls.at(-1)!;
    return { id: post.body!.id, message, undo: options?.actionProps };
  }

  it('the toast names the log and offers Undo, which deletes that log', async () => {
    const { id, message, undo } = await tapAndSave(peeOutside());
    expect(message).toBe('Logged: Peed Outside');
    expect(undo?.children).toBe('Undo');

    await act(async () => (undo!.onPress as () => void)());
    expect(ids()).not.toContain(id);
    expect(deletes().map((request) => request.url)).toEqual([expect.stringContaining(`id=${id}`)]);
    await deletes()[0].answer(200, { success: true, deletedId: id });

    expect(ids()).not.toContain(id);
  });

  it('the tap that corrects it, within 5 s, is logged: not refused as "already logged"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T08:00:00.000Z'));
    const warning = vi.spyOn(toast, 'warning');
    const { id, undo } = await tapAndSave(peeOutside());
    await act(async () => (undo!.onPress as () => void)());
    await deletes()[0].answer(200, { success: true, deletedId: id });

    vi.setSystemTime(Date.now() + 2000);
    await start(() => hook.addActivity(peeAccident(), { keepUnsaved: true }));

    expect(warning).not.toHaveBeenCalled();
    expect(posts().map((post) => post.body!.pottyLocation)).toEqual(['outside', 'indoor_accident']);
  });

  it('an Undo the server refuses puts the log back', async () => {
    const { id, undo } = await tapAndSave(peeOutside());
    await act(async () => (undo!.onPress as () => void)());

    await deletes()[0].answer(500, { error: 'Internal server error' });

    expect(ids()).toEqual([id]);
  });

  it('in French: "Accident de pipi enregistré", Undo reads "Annuler"', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    await act(async () => root!.render(<HookProbe key="fr" onRender={(state) => { hook = state; }} />));
    const { message, undo } = await tapAndSave(peeAccident());

    expect(message).toBe('Accident de pipi enregistré');
    expect(undo?.children).toBe('Annuler');
  });

  it('a poop is named a poop: "Pooped Outside", "Poop accident indoors"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T08:00:00.000Z'));
    const outside = await tapAndSave({ ...newLog('poop'), pottyLocation: 'outside' });
    expect(outside.message).toBe('Logged: Pooped Outside');
    vi.setSystemTime(Date.now() + 6000);
    const accident = await tapAndSave({ ...newLog('poop'), pottyLocation: 'indoor_accident' });
    expect(accident.message).toBe('Logged: Poop accident indoors');
  });

  it('a log saved from the log form keeps the plain toast, with no Undo', async () => {
    const success = vi.spyOn(toast, 'success');
    await start(() => hook.addActivity(newLog('food')));
    await posts()[0].answer(201, posts()[0].body);

    expect(success).toHaveBeenCalledWith(en.toasts.activityLogged);
  });
});
