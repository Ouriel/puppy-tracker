// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import App from '../App';
import { en } from '../i18n/en';
import { setAuthToken, clearAuthToken, setStoredAuthUser } from '../utils/auth';
import { setStoredPuppies, setActivePuppyId, getActivePuppyId, getStoredPuppies, setStoredRecentActivities } from '../utils/storage';
import { clearApiCache } from '../services/api';
import type { Activity, HealthRecord, PuppyProfile, UserAccount } from '../types';

// The real lock screen loads Google's script; this one signs in with a Google ID token at once.
vi.mock('../components/AuthLockScreen', () => ({
  AuthLockScreen: ({ onUnlockWithSSO }: { onUnlockWithSSO: (email: string, name: string, token: string) => unknown }) => (
    <button id="sign-in" onClick={() => onUnlockWithSSO('owner@example.com', 'Owner', 'google-id-token')}>
      Sign in
    </button>
  ),
}));

// Renders let through by the same shallow prop comparison as the real React.memo components
const renderCounts = vi.hoisted(() => ({ predictorWidget: 0, healthSummary: 0 }));
const countRender = vi.hoisted(() => (name: 'predictorWidget' | 'healthSummary') => {
  renderCounts[name] += 1;
});
vi.mock('../components/PredictorWidget', async (importOriginal) => {
  const { memo } = await import('react');
  const actual = await importOriginal<typeof import('../components/PredictorWidget')>();
  return {
    PredictorWidget: memo((props: ComponentProps<typeof actual.PredictorWidget>) => {
      countRender('predictorWidget');
      return <actual.PredictorWidget {...props} />;
    }),
  };
});
vi.mock('../components/DogHealthSummary', async (importOriginal) => {
  const { memo } = await import('react');
  const actual = await importOriginal<typeof import('../components/DogHealthSummary')>();
  return {
    DogHealthSummary: memo((props: ComponentProps<typeof actual.DogHealthSummary>) => {
      countRender('healthSummary');
      return <actual.DogHealthSummary {...props} />;
    }),
  };
});

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-01-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const owner: UserAccount = { email: 'owner@example.com', name: 'Owner', role: 'Member' };

let root: Root | null = null;
let requestedUrls: string[] = [];
let heldResponses: Array<() => void> = [];

const respond = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
/** No answer during the test; answered at teardown so no request stays in flight in the shared API client. */
const heldUntilTeardown = () =>
  new Promise<Response>((resolve) => heldResponses.push(() => resolve(new Response('{}', { status: 503 }))));

/** Routes each request by path; a path missing from `routes` gets a 404. */
function stubApi(routes: Record<string, (url: string, init?: RequestInit) => Promise<Response>>) {
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    requestedUrls.push(url);
    return routes[url.split('?')[0]]?.(url, init) ?? respond({ error: 'Not found' }, 404);
  }));
}

function recentPee(): Activity {
  return { id: 'act-1', puppyId: puppy.id, type: 'pee', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), loggedBy: 'Owner' };
}

function dashboardPayload(activities: Activity[] = [recentPee()]) {
  return { puppies: [puppy], caretakers: [], activities, healthRecords: [] };
}

// Captured before the fake timers: lazy chunks need real time to load
const realSetTimeout = globalThis.setTimeout;

/** Lets pending responses, lazy chunks and React updates finish. Of the app's timers, only those due now (0 ms) run. */
async function settle() {
  for (let round = 0; round < 10; round += 1) {
    await act(async () => {
      await new Promise((resolve) => realSetTimeout(resolve, 0));
      vi.advanceTimersByTime(0);
    });
  }
}

/** Settles until `condition` holds, for lazy views slower than one settle. */
async function settleUntil(condition: () => boolean) {
  for (let round = 0; round < 50 && !condition(); round += 1) await settle();
}

async function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<App />));
  await settle();
}

const isSkeletonShown = () => document.querySelector('.h-48.motion-safe\\:animate-pulse') !== null;
const isTimelineEmpty = () => document.body.textContent!.includes(en.dashboard.noActivityLogs);
const isLockScreenShown = () => document.getElementById('sign-in') !== null;
const dashboardUrl = '/api/dashboard?puppyId=pup-1&days=14';

/** A returning user on this device: signed in, dog profile cached, no cached logs. */
function signedInWithCachedDogOnly() {
  setAuthToken('app-session');
  setStoredAuthUser(owner);
  setStoredPuppies([puppy]);
  setActivePuppyId(puppy.id);
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom lacks these; HeroUI / react-aria read them.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  // App timers fire only when a test moves the fake clock. On a real clock, the session extension sent
  // 3 s after boot (never cleared on unmount) lands in whichever test runs then, on a slow machine.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  window.history.pushState({}, '', '/');
  requestedUrls = [];
  heldResponses = [];
  localStorage.clear();
  clearAuthToken();
  clearApiCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  heldResponses.forEach((answer) => answer());
  await new Promise((resolve) => realSetTimeout(resolve, 0));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App boot and sign-in data loading', () => {
  it('F2: a dashboard 500 with no cached logs shows an empty dashboard, not an endless skeleton', async () => {
    signedInWithCachedDogOnly();
    stubApi({
      '/api/dashboard': () => respond({ error: 'Failed to fetch dashboard payload' }, 500),
      '/api/dogs': () => respond({ error: 'Internal server error' }, 500),
      '/api/households': () => respond({ error: 'Internal server error' }, 500),
    });

    await renderApp();

    expect(isSkeletonShown()).toBe(false);
    expect(isTimelineEmpty()).toBe(true);
    // The failed dashboard falls back to dogs and household
    expect(requestedUrls).toEqual([dashboardUrl, '/api/dogs', '/api/households']);
  });

  it('a dashboard 401 at boot shows the lock screen and sends no /api/dogs or /api/households request without a token', async () => {
    signedInWithCachedDogOnly();
    stubApi({
      '/api/dashboard': () => respond({ error: 'Unauthorized' }, 401),
      '/api/dogs': () => respond({ error: 'Unauthorized' }, 401),
      '/api/households': () => respond({ error: 'Unauthorized' }, 401),
    });

    await renderApp();

    expect(isLockScreenShown()).toBe(true);
    expect(requestedUrls).toEqual([dashboardUrl]);
  });

  it('Settings paints without waiting for logs, then loads the dashboard payload, so the dashboard opened next shows fresh logs', async () => {
    signedInWithCachedDogOnly();
    let answerDashboard: (response: Response) => void = () => {};
    stubApi({ '/api/dashboard': () => new Promise<Response>((resolve) => { answerDashboard = resolve; }) });
    window.history.pushState({}, '', '/settings');

    await renderApp();

    expect(isSkeletonShown()).toBe(false);
    expect(requestedUrls).toEqual([dashboardUrl]);

    answerDashboard(new Response(JSON.stringify(dashboardPayload())));
    await settle();
    await act(async () => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await settle();

    // No logs were cached: the timeline shows the log from the payload loaded while on Settings
    expect(isTimelineEmpty()).toBe(false);
    expect(requestedUrls).toEqual([dashboardUrl]);
  });

  it('P2: the dashboard paints from /api/dashboard alone, without waiting on /api/dogs or /api/households', async () => {
    signedInWithCachedDogOnly();
    stubApi({
      '/api/dashboard': () => respond(dashboardPayload()),
      '/api/dogs': heldUntilTeardown,
      '/api/households': heldUntilTeardown,
    });

    await renderApp();

    expect(isSkeletonShown()).toBe(false);
    expect(isTimelineEmpty()).toBe(false);
    expect(requestedUrls.filter((url) => url.startsWith('/api/dogs') || url.startsWith('/api/households'))).toEqual([]);
  });

  it('N1 + P3: one return to the app (visibilitychange, focus, pageshow) makes one /api/dashboard request and shows its logs', async () => {
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    // The boot sees no logs; a log made on another phone is there on the return
    stubApi({ '/api/dashboard': () => respond(dashboardPayload(dashboardAnswers++ === 0 ? [] : [recentPee()])) });
    await renderApp();
    expect(isTimelineEmpty()).toBe(true);
    requestedUrls = [];

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));
    });
    await settle();

    expect(requestedUrls).toEqual([dashboardUrl]);
    expect(isTimelineEmpty()).toBe(false);
  });

  it('C2: a return to the app whose stored dog is gone shows the first dog of the refreshed list with its logs: one more /api/dashboard, no /api/activities', async () => {
    const removedPuppy: PuppyProfile = { ...puppy, id: 'pup-removed', name: 'Gone' };
    setAuthToken('app-session');
    setStoredAuthUser(owner);
    setStoredPuppies([removedPuppy]);
    setActivePuppyId(removedPuppy.id);
    let dashboardAnswers = 0;
    stubApi({
      // Like the server: the logs of the requested dog only
      '/api/dashboard': (url) => {
        if (dashboardAnswers++ === 0) return respond({ error: 'Failed to fetch dashboard payload' }, 500);
        const requestedPuppyId = new URL(url, 'http://localhost').searchParams.get('puppyId');
        return respond(dashboardPayload([recentPee()].filter((activity) => !requestedPuppyId || activity.puppyId === requestedPuppyId)));
      },
      '/api/dogs': () => respond({ error: 'Internal server error' }, 500),
      '/api/households': () => respond({ error: 'Internal server error' }, 500),
    });
    await renderApp();
    requestedUrls = [];

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(requestedUrls).toEqual(['/api/dashboard?puppyId=pup-removed&days=14', dashboardUrl]);
    expect(isTimelineEmpty()).toBe(false);
    expect(getActivePuppyId()).toBe(puppy.id);
  });

  it('a return to the app keeps the selected second dog', async () => {
    const secondPuppy: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Second' };
    setAuthToken('app-session');
    setStoredAuthUser(owner);
    setStoredPuppies([puppy, secondPuppy]);
    setActivePuppyId(secondPuppy.id);
    stubApi({ '/api/dashboard': () => respond({ ...dashboardPayload([]), puppies: [puppy, secondPuppy] }) });
    await renderApp();

    for (let round = 0; round < 2; round += 1) {
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await settle();
    }

    expect(requestedUrls.every((url) => url === '/api/dashboard?puppyId=pup-2&days=14')).toBe(true);
    expect(getActivePuppyId()).toBe('pup-2');
  });

  it('a malformed dashboard answer on a return to the app is swallowed, not an unhandled rejection', async () => {
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    stubApi({ '/api/dashboard': () => (dashboardAnswers++ === 0 ? respond(dashboardPayload()) : respond(null)) });
    await renderApp();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });

  it('F3: after a first Google sign-in, /api/dashboard is called and the logs are shown', async () => {
    stubApi({
      '/api/auth/session': () => respond({ sessionToken: 'app-session', user: owner }),
      '/api/dashboard': () => respond(dashboardPayload()),
      '/api/dogs': () => respond([puppy]),
      '/api/households': () => respond({ caretakers: [] }),
    });

    await renderApp();
    await act(async () => document.getElementById('sign-in')!.click());
    await settle();

    expect(requestedUrls).toContain('/api/dashboard?days=14');
    expect(isSkeletonShown()).toBe(false);
    expect(isTimelineEmpty()).toBe(false);
  });

  it('F3: a first Google sign-in whose dashboard request fails falls back to dogs and household, so an owner never sees the register-a-dog card', async () => {
    stubApi({
      '/api/auth/session': () => respond({ sessionToken: 'app-session', user: owner }),
      '/api/dashboard': () => respond({ error: 'Failed to fetch dashboard payload' }, 500),
      '/api/dogs': () => respond([puppy]),
      '/api/households': () => respond({ caretakers: [] }),
    });

    await renderApp();
    await act(async () => document.getElementById('sign-in')!.click());
    await settle();

    expect(requestedUrls).toEqual(['/api/auth/session', '/api/dashboard?days=14', '/api/dogs', '/api/households']);
    expect(document.body.textContent).not.toContain(en.dashboard.welcomeTitle);
  });
});

describe('App log state', () => {
  // With a next date: the health summary lists only open next dates
  const testRecord: HealthRecord = { id: 'hr-1', householdId: 'hh-1', puppyId: puppy.id, type: 'vaccination', name: 'Vaccine-T1', date: '2026-09-01', boosterDate: '2030-09-01' };

  it('F4: a refresh after the last health record was deleted removes it from the health summary', async () => {
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    stubApi({ '/api/dashboard': () => respond({ ...dashboardPayload(), healthRecords: dashboardAnswers++ === 0 ? [testRecord] : [] }) });
    await renderApp();
    expect(document.body.textContent).toContain(testRecord.name);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(document.body.textContent).not.toContain(testRecord.name);
  });

  it('F4: the health passport shows only the selected dog\'s weights', async () => {
    const otherPuppy: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Other' };
    const otherWeight: Activity = { id: 'act-w2', puppyId: otherPuppy.id, type: 'weight', timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), loggedBy: 'Owner', weightKg: 33.3 };
    // No dog chosen yet on this device: /api/dashboard sends every dog's logs
    setAuthToken('app-session');
    setStoredAuthUser(owner);
    setStoredPuppies([puppy, otherPuppy]);
    stubApi({ '/api/dashboard': () => respond({ ...dashboardPayload([recentPee(), otherWeight]), puppies: [puppy, otherPuppy] }) });
    window.history.pushState({}, '', '/health-passport');

    await renderApp();
    // The weight card's chart: its title is now a plain "Weight", found elsewhere on the page too
    await settleUntil(() => document.querySelector('svg[role="img"]') !== null);

    expect(document.querySelector('svg[role="img"] title')!.textContent).toContain(en.weightChart.chartTitle.replace('{name}', puppy.name));
    expect(document.body.textContent).not.toContain('33.3 kg');
  });

  it('F5: opening the log form re-renders neither the prediction cards nor the health summary', async () => {
    signedInWithCachedDogOnly();
    stubApi({ '/api/dashboard': () => respond(dashboardPayload()) });
    await renderApp();
    renderCounts.predictorWidget = 0;
    renderCounts.healthSummary = 0;

    await act(async () => document.querySelector<HTMLElement>(`[aria-label="${en.nav.logEvent}"]`)!.click());
    // The form is a lazy chunk: on a slow runner it needs more rounds than settle() gives
    await settleUntil(() => document.getElementById('quicklog-form') !== null);

    expect(document.getElementById('quicklog-form')).not.toBeNull();
    expect(renderCounts).toEqual({ predictorWidget: 0, healthSummary: 0 });
  });

  it('C1: a log tapped while a refresh is in flight stays when the older refresh answer arrives', async () => {
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    let answerRefresh: (response: Response) => void = () => {};
    stubApi({
      '/api/dashboard': () => (dashboardAnswers++ === 0
        ? respond(dashboardPayload([]))
        : new Promise<Response>((resolve) => { answerRefresh = resolve; })),
      '/api/activities': (_url, init) => respond(JSON.parse(String(init!.body)), 201),
    });
    await renderApp();
    expect(isTimelineEmpty()).toBe(true);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const peeButton = [...document.querySelectorAll('button')].find((button) => button.textContent === en.potty.peedOutside)!;
    await act(async () => peeButton.click());
    await settle();
    // The refresh read the logs before the pee was saved
    answerRefresh(new Response(JSON.stringify(dashboardPayload([]))));
    await settle();

    expect(isTimelineEmpty()).toBe(false);
  });

  it('C1: a log saved between two refresh events of one return to the app stays when the refresh sent before the save answers without it', async () => {
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    const heldRefreshes: Array<(response: Response) => void> = [];
    let answerSave: (response: Response) => void = () => {};
    let savedLog: Activity | undefined;
    stubApi({
      '/api/dashboard': () => (dashboardAnswers++ === 0
        ? respond(dashboardPayload([]))
        : new Promise<Response>((resolve) => { heldRefreshes.push(resolve); })),
      '/api/activities': (_url, init) => new Promise<Response>((resolve) => {
        savedLog = JSON.parse(String(init!.body));
        answerSave = resolve;
      }),
    });
    await renderApp();

    const peeButton = [...document.querySelectorAll('button')].find((button) => button.textContent === en.potty.peedOutside)!;
    await act(async () => peeButton.click());
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    answerSave(new Response(JSON.stringify(savedLog), { status: 201 }));
    await settle();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await settle();
    // The refresh sent while the save was in flight read the logs without the pee; one sent after it sees the pee
    heldRefreshes[0](new Response(JSON.stringify(dashboardPayload([]))));
    heldRefreshes.slice(1).forEach((answer) => answer(new Response(JSON.stringify(dashboardPayload([savedLog!])))));
    await settle();

    expect(isTimelineEmpty()).toBe(false);
  });

  // Owner decision 2026-10-15: a dog with no gram goal may log a meal without grams (stored as null, never 0)
  it('a dog with no gram goal: "Feed Meal Now" saves a meal with the grams box left empty', async () => {
    const noGoalPuppy: PuppyProfile = { ...puppy, dailyFoodGramGoal: 0 };
    setAuthToken('app-session');
    setStoredAuthUser(owner);
    setStoredPuppies([noGoalPuppy]);
    setActivePuppyId(noGoalPuppy.id);
    const posted: Array<Record<string, unknown>> = [];
    stubApi({
      '/api/dashboard': () => respond({ ...dashboardPayload([]), puppies: [noGoalPuppy] }),
      '/api/activities': (_url, init) => {
        posted.push(JSON.parse(String(init!.body)));
        return respond(posted.at(-1), 201);
      },
    });
    await renderApp();

    await act(async () => [...document.querySelectorAll('button')].find((button) => button.textContent === en.dashboard.feedMealNow)!.click());
    await settleUntil(() => document.getElementById('quicklog-quantity-grams') !== null);
    expect((document.getElementById('quicklog-quantity-grams') as HTMLInputElement).value).toBe('');
    await act(async () => document.querySelector<HTMLButtonElement>('button[form="quicklog-form"]')!.click());
    await settle();

    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: 'food', puppyId: noGoalPuppy.id });
    expect(posted[0]).not.toHaveProperty('quantityGrams');
  });

  it('14: a meal dated later today counts neither in today\'s grams nor in today\'s meals', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-14T08:00:00.000Z'));
    signedInWithCachedDogOnly();
    const laterMeal: Activity = { id: 'act-meal', puppyId: puppy.id, type: 'food', timestamp: '2026-10-14T12:00:00.000Z', loggedBy: 'Owner', quantityGrams: 150 };
    stubApi({ '/api/dashboard': () => respond(dashboardPayload([recentPee(), laterMeal])) });

    await renderApp();

    expect(document.body.textContent).toContain('0\u00a0g / 200\u00a0g (0/3)');
  });

  // Owner decision 2026-10-15: the server gives an account without a linked badge one on its first log
  describe('an account with no linked badge', () => {
    const ownBadge = { id: 'c-auto', name: 'Owner', role: 'Member', color: '#EC4899', email: 'owner@example.com' };
    const loggedByLine = () => document.getElementById('quicklog-logged-by')?.textContent;

    async function openLogForm() {
      await act(async () => document.querySelector<HTMLElement>(`[aria-label="${en.nav.logEvent}"]`)!.click());
      await settleUntil(() => loggedByLine() !== undefined);
    }

    async function logPeeThenOpenForm() {
      await renderApp();
      const peeButton = [...document.querySelectorAll('button')].find((button) => button.textContent === en.potty.peedOutside)!;
      await act(async () => peeButton.click());
      await settle();
      await openLogForm();
    }

    it('after its first log reloads the badges, so the log form reads "Logged by" its new badge', async () => {
      signedInWithCachedDogOnly();
      setStoredAuthUser({ ...owner, name: 'Owner Fullname' });
      stubApi({
        '/api/dashboard': () => respond(dashboardPayload([])),
        '/api/activities': (_url, init) => respond({ ...JSON.parse(String(init!.body)), loggedBy: 'Owner' }, 201),
        '/api/households': () => respond({ household: { id: 'hh-1', name: 'Family Pack' }, caretakers: [ownBadge] }),
      });

      await logPeeThenOpenForm();

      expect(requestedUrls).toContain('/api/households');
      expect(loggedByLine()).toBe(en.potty.loggedBy.replace('{name}', 'Owner'));
    });

    it('a first log saved from the log form also reloads the badges', async () => {
      signedInWithCachedDogOnly();
      setStoredAuthUser({ ...owner, name: 'Owner Fullname' });
      stubApi({
        '/api/dashboard': () => respond(dashboardPayload([])),
        '/api/activities': (_url, init) => respond({ ...JSON.parse(String(init!.body)), loggedBy: 'Owner' }, 201),
        '/api/households': () => respond({ household: { id: 'hh-1', name: 'Family Pack' }, caretakers: [ownBadge] }),
      });
      await renderApp();
      await openLogForm();
      expect(loggedByLine()).toBe(en.potty.loggedBy.replace('{name}', 'Owner Fullname'));

      await act(async () => document.querySelector<HTMLButtonElement>('button[type="submit"][form="quicklog-form"]')!.click());
      await settleUntil(() => loggedByLine() === undefined && requestedUrls.includes('/api/households'));
      await openLogForm();

      expect(requestedUrls).toContain('/api/households');
      expect(loggedByLine()).toBe(en.potty.loggedBy.replace('{name}', 'Owner'));
    });

    it('reloads the badges even when the new badge has the account name', async () => {
      signedInWithCachedDogOnly();
      stubApi({
        '/api/dashboard': () => respond(dashboardPayload([])),
        '/api/activities': (_url, init) => respond({ ...JSON.parse(String(init!.body)), loggedBy: 'Owner' }, 201),
        '/api/households': () => respond({ household: { id: 'hh-1', name: 'Family Pack' }, caretakers: [ownBadge] }),
      });

      await logPeeThenOpenForm();

      expect(requestedUrls).toContain('/api/households');
    });

    it('an account with a linked badge reloads nothing after a log', async () => {
      signedInWithCachedDogOnly();
      setStoredAuthUser({ ...owner, name: 'Owner Fullname' });
      stubApi({
        '/api/dashboard': () => respond({ ...dashboardPayload([]), caretakers: [ownBadge] }),
        '/api/activities': (_url, init) => respond(JSON.parse(String(init!.body)), 201),
      });

      await logPeeThenOpenForm();

      expect(requestedUrls).not.toContain('/api/households');
      expect(loggedByLine()).toBe(en.potty.loggedBy.replace('{name}', 'Owner'));
    });
  });
});

const buttonWithText = (text: string) => [...document.querySelectorAll('button')].find((button) => button.textContent === text);

/** The dashboard answers; each POST is refused as by a phone with no signal until `isOnline` is set. */
function stubOfflineSaves(connection: { isOnline: boolean }) {
  const posted: Activity[] = [];
  stubApi({
    '/api/dashboard': () => respond(dashboardPayload([])),
    '/api/activities': (_url, init) => {
      posted.push(JSON.parse(String(init!.body)));
      return connection.isOnline ? respond(posted.at(-1), 201) : Promise.reject(new TypeError('Load failed'));
    },
  });
  return posted;
}

async function tapPeeOutside() {
  await act(async () => buttonWithText(en.potty.peedOutside)!.click());
  await settle();
}

// Backlog item 5: a quick log tapped with no signal used to vanish, so its real time had to be typed again by hand
describe('a quick log that could not be saved', () => {
  const isMarkedNotSaved = () => document.body.textContent!.includes(en.potty.notSaved);
  const retryButtons = () => [...document.querySelectorAll('button')].filter((button) => button.textContent === en.potty.retry);

  it('stays in the feed marked "not saved"; Retry sends it again under the same id and clears the mark', async () => {
    signedInWithCachedDogOnly();
    const connection = { isOnline: false };
    const posted = stubOfflineSaves(connection);
    const danger = vi.spyOn(toast, 'danger');
    await renderApp();

    await tapPeeOutside();
    expect(danger.mock.calls.map(([message]) => message)).toEqual([en.toasts.offline]);
    expect(isMarkedNotSaved()).toBe(true);

    connection.isOnline = true;
    await act(async () => buttonWithText(en.potty.retry)!.click());
    await settle();

    expect(posted).toHaveLength(2);
    expect(posted[1].id).toBe(posted[0].id);
    expect(isMarkedNotSaved()).toBe(false);
    expect(isTimelineEmpty()).toBe(false);
  });

  it('a Retry that fails again keeps the mark', async () => {
    signedInWithCachedDogOnly();
    stubOfflineSaves({ isOnline: false });
    await renderApp();

    await tapPeeOutside();
    await act(async () => buttonWithText(en.potty.retry)!.click());
    await settle();

    expect(isMarkedNotSaved()).toBe(true);
  });

  it('Retry keeps the row in view: marked while the request runs, then shown saved', async () => {
    signedInWithCachedDogOnly();
    const posted: Activity[] = [];
    let answerRetry: (response: Response) => void = () => {};
    stubApi({
      '/api/dashboard': () => respond(dashboardPayload([])),
      '/api/activities': (_url, init) => {
        posted.push(JSON.parse(String(init!.body)));
        return posted.length === 1 ? Promise.reject(new TypeError('Load failed')) : new Promise<Response>((resolve) => { answerRetry = resolve; });
      },
    });
    await renderApp();
    await tapPeeOutside();

    await act(async () => buttonWithText(en.potty.retry)!.click());
    await settle();
    expect(isMarkedNotSaved()).toBe(true);
    expect(retryButtons()).toHaveLength(1);

    await act(async () => answerRetry(new Response(JSON.stringify(posted[1]), { status: 201 })));
    await settle();
    expect(isMarkedNotSaved()).toBe(false);
    expect(document.querySelector('[aria-label^="Delete pee "]')).not.toBeNull();
  });

  it('the red message carries Retry too, since the marked row may be off screen', async () => {
    signedInWithCachedDogOnly();
    const connection = { isOnline: false };
    const posted = stubOfflineSaves(connection);
    const danger = vi.spyOn(toast, 'danger');
    await renderApp();
    await tapPeeOutside();

    const [message, options] = danger.mock.calls[0];
    expect(message).toBe(en.toasts.offline);
    expect(options?.actionProps?.children).toBe(en.potty.retry);

    connection.isOnline = true;
    await act(async () => (options!.actionProps!.onPress as () => void)());
    await settle();

    expect(posted.map((post) => post.id)).toEqual([posted[0].id, posted[0].id]);
    expect(isMarkedNotSaved()).toBe(false);
  });

  it('a server error says "Not saved, try again.", never "changes reverted": the log is kept', async () => {
    signedInWithCachedDogOnly();
    stubApi({
      '/api/dashboard': () => respond(dashboardPayload([])),
      '/api/activities': () => respond({ error: 'Internal server error' }, 500),
    });
    const danger = vi.spyOn(toast, 'danger');
    await renderApp();
    await tapPeeOutside();

    expect(danger.mock.calls.map(([message]) => message)).toEqual([en.potty.saveFailed]);
    expect(isMarkedNotSaved()).toBe(true);
  });

  it('a second tap within 5 s is still a double tap: one POST, one marked row', async () => {
    signedInWithCachedDogOnly();
    const posted = stubOfflineSaves({ isOnline: false });
    const warning = vi.spyOn(toast, 'warning');
    await renderApp();

    await tapPeeOutside();
    await tapPeeOutside();

    expect(posted).toHaveLength(1);
    expect(warning).toHaveBeenCalledWith(en.toasts.alreadyLogged);
    expect(retryButtons()).toHaveLength(1);
  });

  it('a return to the app keeps it', async () => {
    signedInWithCachedDogOnly();
    stubOfflineSaves({ isOnline: false });
    await renderApp();
    await tapPeeOutside();

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(isMarkedNotSaved()).toBe(true);
  });

  it('Discard removes it and sends nothing', async () => {
    signedInWithCachedDogOnly();
    const posted = stubOfflineSaves({ isOnline: false });
    await renderApp();
    await tapPeeOutside();

    await act(async () => document.querySelector<HTMLElement>(`[aria-label="${en.potty.discard}"]`)!.click());
    await settle();

    expect(posted).toHaveLength(1);
    expect(isTimelineEmpty()).toBe(true);
  });
});

// Backlog item 5: the log form closed before the save was answered, so a failed save lost what was typed
describe('a log form whose save fails', () => {
  const notesBox = () => document.getElementById('quicklog-notes') as HTMLInputElement | null;
  const alertText = () => document.querySelector('[role="alert"]')?.textContent;

  async function typeNotes(text: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(notesBox(), text);
      notesBox()!.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function openLogForm() {
    await act(async () => document.querySelector<HTMLElement>(`[aria-label="${en.nav.logEvent}"]`)!.click());
    await settleUntil(() => notesBox() !== null);
  }

  async function pressSave() {
    await act(async () => document.querySelector<HTMLButtonElement>('button[form="quicklog-form"]')!.click());
    await settle();
  }

  it('stays open with what was typed; Save again sends the same log under the same id and closes it', async () => {
    signedInWithCachedDogOnly();
    const connection = { isOnline: false };
    const posted = stubOfflineSaves(connection);
    await renderApp();
    await openLogForm();
    await typeNotes('by the door');

    await pressSave();
    expect(notesBox()?.value).toBe('by the door');
    expect(alertText()).toBe(en.potty.saveFailed);

    connection.isOnline = true;
    await pressSave();
    expect(posted.map((post) => post.id)).toEqual([posted[0].id, posted[0].id]);
    expect(notesBox()).toBeNull();
  });

  it('a Save the double-tap guard ignores closes the form, as before ("Already logged")', async () => {
    signedInWithCachedDogOnly();
    const posted = stubOfflineSaves({ isOnline: true });
    const warning = vi.spyOn(toast, 'warning');
    await renderApp();
    await tapPeeOutside();
    await openLogForm();

    await pressSave();

    expect(warning).toHaveBeenCalledWith(en.toasts.alreadyLogged);
    expect(posted).toHaveLength(1);
    expect(notesBox()).toBeNull();
  });

  it('an edit the server does not take keeps the edit form open with the edited note', async () => {
    signedInWithCachedDogOnly();
    stubApi({
      '/api/dashboard': () => respond(dashboardPayload()),
      '/api/activities': () => Promise.reject(new TypeError('Load failed')),
    });
    await renderApp();
    await act(async () => document.querySelector<HTMLButtonElement>(`button[title="${en.dashboard.expandAll}"]`)!.click());
    await act(async () => document.querySelector<HTMLElement>('[aria-label^="Edit "]')!.click());
    await settleUntil(() => notesBox() !== null);
    await typeNotes('edited');

    await pressSave();

    expect(notesBox()?.value).toBe('edited');
    expect(alertText()).toBe(en.potty.saveFailed);
  });
});

// Backlog item 5: an app opened with no connection showed cached cards and predictions with no sign they were old
describe('a dashboard that cannot be reached', () => {
  it('says "Offline, data from HH:mm" with the time of the logs it shows, until a load works again', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    // 09:15 in Paris: the last load that worked, before the app was closed
    vi.setSystemTime(new Date('2026-10-14T07:15:00.000Z'));
    signedInWithCachedDogOnly();
    const connection = { isOnline: true };
    stubApi({ '/api/dashboard': () => (connection.isOnline ? respond(dashboardPayload()) : Promise.reject(new TypeError('Load failed'))) });
    await renderApp();
    expect(document.body.textContent).not.toContain('Offline');
    await act(async () => root!.unmount());

    // Opened again at 11:40 with no signal
    vi.setSystemTime(new Date('2026-10-14T09:40:00.000Z'));
    connection.isOnline = false;
    clearApiCache();
    await renderApp();
    expect(document.body.textContent).toContain('Offline, data from 09:15');

    connection.isOnline = true;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(document.body.textContent).not.toContain('Offline');
  });
});


// Carnet review 2026-10-16, phase 3: the passport never reads "nothing recorded" while it waits, and says when it is offline
describe('the health passport while its data loads', () => {
  const isPassportBusy = () => document.querySelector('[aria-busy="true"]')?.textContent === en.common.loading;

  it('shows skeletons until the first dashboard answer, then the records', async () => {
    signedInWithCachedDogOnly();
    let answerDashboard: (response: Response) => void = () => {};
    stubApi({
      '/api/dashboard': () => new Promise<Response>((resolve) => {
        answerDashboard = resolve;
        heldResponses.push(() => resolve(new Response('{}', { status: 503 })));
      }),
    });
    window.history.pushState({}, '', '/health-passport');

    await renderApp();
    await settleUntil(isPassportBusy);
    expect(isPassportBusy()).toBe(true);
    expect(document.body.textContent).not.toMatch(/\(0\)/);

    answerDashboard(new Response(JSON.stringify(dashboardPayload())));
    await settleUntil(() => !isPassportBusy());
    expect(document.body.textContent).toContain(`${en.health.vaccinations} (0)`);
  });

  // Health records are never kept on the phone: with no answer, the passport cannot know what is due
  const expectNoMadeUpState = () => {
    const text = document.body.textContent!;
    expect(text).not.toContain(en.health.nothingDue);
    expect(text).not.toMatch(/\(0\)/);
    expect(text).not.toContain('No weigh-in yet');
  };
  const overdueRabies: HealthRecord = {
    id: 'hr-rabies', householdId: 'hh-1', puppyId: puppy.id, type: 'vaccination',
    name: 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)', date: '2025-01-10', boosterDate: '2026-01-10',
  };

  it('offline: "Offline, data from HH:mm", then one line saying the health book is unavailable', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    // The last load that worked, at 09:15 in Paris; opened again at 11:40 with no signal
    vi.setSystemTime(new Date('2026-10-14T07:15:00.000Z'));
    signedInWithCachedDogOnly();
    setStoredRecentActivities(puppy.id, [recentPee()]);
    vi.setSystemTime(new Date('2026-10-14T09:40:00.000Z'));
    const offline = () => Promise.reject(new TypeError('Load failed'));
    stubApi({ '/api/dashboard': offline, '/api/health-records': offline, '/api/dogs': offline, '/api/households': offline });
    window.history.pushState({}, '', '/health-passport');

    await renderApp();
    await settleUntil(() => document.body.textContent!.includes(en.health.recordsUnavailable));

    expect(document.body.textContent).toContain('Offline, data from 09:15');
    expect(document.body.textContent).toContain(en.health.recordsUnavailable);
    expectNoMadeUpState();
  });

  it('a dashboard 500: skeletons while the passport loads its records itself, then the records', async () => {
    signedInWithCachedDogOnly();
    let answerRecords: (response: Response) => void = () => {};
    stubApi({
      '/api/dashboard': () => respond({ error: 'Failed to fetch dashboard payload' }, 500),
      '/api/health-records': () => new Promise<Response>((resolve) => {
        answerRecords = resolve;
        heldResponses.push(() => resolve(new Response('{}', { status: 503 })));
      }),
    });
    window.history.pushState({}, '', '/health-passport');

    await renderApp();
    await settleUntil(() => requestedUrls.includes('/api/health-records?puppyId=pup-1') && document.body.textContent!.includes(en.nav.carnetDeSante));
    expect(isPassportBusy()).toBe(true);
    expectNoMadeUpState();

    answerRecords(new Response(JSON.stringify([overdueRabies])));
    await settleUntil(() => !isPassportBusy());
    const toDoLine = [...document.querySelectorAll('h3')].find((title) => title.textContent === en.health.toDo)!.closest('section')!.querySelector('li')!;
    expect(toDoLine.textContent).toMatch(new RegExp(`^Rabies.*${en.potty.overdue}$`));
  });

  it('a dashboard 500 and no records either: the line says so, with no offline line to explain it', async () => {
    signedInWithCachedDogOnly();
    stubApi({
      '/api/dashboard': () => respond({ error: 'Failed to fetch dashboard payload' }, 500),
      '/api/health-records': () => respond({ error: 'Internal server error' }, 500),
    });
    window.history.pushState({}, '', '/health-passport');

    await renderApp();
    await settleUntil(() => document.body.textContent!.includes(en.health.recordsUnavailable));

    expect(document.body.textContent).toContain(en.health.recordsUnavailable);
    expect(document.body.textContent).not.toContain('Offline');
    expectNoMadeUpState();
  });

  it('a stored dog that is gone: skeletons until the answer for the first dog, which carries the records', async () => {
    const removedPuppy: PuppyProfile = { ...puppy, id: 'pup-removed', name: 'Gone' };
    signedInWithCachedDogOnly();
    setStoredPuppies([removedPuppy]);
    setActivePuppyId(removedPuppy.id);
    // Its logs kept on the phone: the app opens on the passport at once, before any answer
    setStoredRecentActivities(removedPuppy.id, [{ ...recentPee(), puppyId: removedPuppy.id }]);
    let answerSecond: (response: Response) => void = () => {};
    stubApi({
      '/api/dashboard': (url) => (url.includes('pup-removed')
        ? respond(dashboardPayload())
        : new Promise<Response>((resolve) => {
          answerSecond = resolve;
          heldResponses.push(() => resolve(new Response('{}', { status: 503 })));
        })),
    });
    window.history.pushState({}, '', '/health-passport');

    await renderApp();
    await settleUntil(() => requestedUrls.includes(dashboardUrl) && document.body.textContent!.includes(en.nav.carnetDeSante));
    expect(isPassportBusy()).toBe(true);
    expectNoMadeUpState();

    answerSecond(new Response(JSON.stringify({ ...dashboardPayload(), healthRecords: [overdueRabies] })));
    await settleUntil(() => !isPassportBusy());
    expect(document.body.textContent).toContain(`${en.health.vaccinations} (1)`);
  });

  it('the dashboard card\'s "To do": busy until the first answer, then unavailable offline, never "nothing due"', async () => {
    signedInWithCachedDogOnly();
    setStoredRecentActivities(puppy.id, [recentPee()]);
    let failDashboard: () => void = () => {};
    stubApi({
      '/api/dashboard': () => new Promise<Response>((resolve, reject) => {
        failDashboard = () => reject(new TypeError('Load failed'));
        heldResponses.push(() => resolve(new Response('{}', { status: 503 })));
      }),
    });

    await renderApp();
    const toDo = () => [...document.querySelectorAll('h3')].find((title) => title.textContent === en.health.toDo)!.closest('section')!;
    expect(toDo().getAttribute('aria-busy')).toBe('true');
    expect(toDo().textContent).not.toContain(en.health.nothingDue);

    failDashboard();
    await settle();
    expect(toDo().getAttribute('aria-busy')).toBeNull();
    expect(toDo().textContent).toContain(en.health.recordsUnavailable);
    expect(toDo().textContent).not.toContain(en.health.nothingDue);
  });
});

// Backlog item 15 (owner default: yes, only while visible)
describe('a screen left open, like a tablet in the kitchen', () => {
  // The session extension sent 3 s after boot is not a dashboard load
  const dashboardRequests = () => requestedUrls.filter((url) => url.startsWith('/api/dashboard'));

  /** Moves the clock minute by minute, as the app's 60 s ticker sees it. */
  async function waitMinutes(minutes: number) {
    for (let minute = 0; minute < minutes; minute += 1) {
      await act(async () => vi.advanceTimersByTime(60_000));
      await settle();
    }
  }

  it('reloads the dashboard once its data is 15 minutes old, so a log made on another phone shows; never while the screen is hidden', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    stubApi({ '/api/dashboard': () => respond(dashboardPayload(dashboardAnswers++ === 0 ? [] : [recentPee()])) });
    await renderApp();
    requestedUrls = [];

    await waitMinutes(14);
    expect(dashboardRequests()).toEqual([]);
    expect(isTimelineEmpty()).toBe(true);

    await waitMinutes(1);
    expect(dashboardRequests()).toEqual([dashboardUrl]);
    expect(isTimelineEmpty()).toBe(false);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await waitMinutes(30);
    expect(dashboardRequests()).toEqual([dashboardUrl]);
  });

  it('a return to the app just before the reload is due makes one request: the reload joins it', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    // The return's request is slow: still running when the reload is due
    stubApi({ '/api/dashboard': () => (dashboardAnswers++ === 0 ? respond(dashboardPayload()) : heldUntilTeardown()) });
    await renderApp();
    requestedUrls = [];

    await act(async () => vi.advanceTimersByTime(14 * 60_000 + 59_000));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => vi.advanceTimersByTime(1_000));
    await settle();

    expect(dashboardRequests()).toEqual([dashboardUrl]);
  });

  it('a return to the app whose request is still running when the reload is due makes one request, even if it hangs for minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    stubApi({ '/api/dashboard': () => (dashboardAnswers++ === 0 ? respond(dashboardPayload()) : heldUntilTeardown()) });
    await renderApp();
    requestedUrls = [];

    await act(async () => vi.advanceTimersByTime(14 * 60_000 + 57_000));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // The reload is due while the return's request is 3 s old: too old to join it
    await act(async () => vi.advanceTimersByTime(3_000));
    await settle();
    await waitMinutes(24);

    expect(dashboardRequests()).toEqual([dashboardUrl]);
  });

  it('a dashboard that keeps failing is retried every 15 minutes, not every minute', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    signedInWithCachedDogOnly();
    let dashboardAnswers = 0;
    stubApi({
      '/api/dashboard': () =>
        dashboardAnswers++ === 0 ? respond(dashboardPayload()) : respond({ error: 'Failed to fetch dashboard payload' }, 500),
    });
    await renderApp();
    requestedUrls = [];

    await waitMinutes(45);

    expect(dashboardRequests()).toEqual([dashboardUrl, dashboardUrl, dashboardUrl]);
  });
});

// Backlog item 20: /api/dashboard sends the owner's deleted dogs; Settings lists them and Restore brings one back
describe('restorable dog delete', () => {
  it("lists the dashboard's deleted dogs in Settings, and Restore puts the dog back in Dog Profiles", async () => {
    signedInWithCachedDogOnly();
    const mia: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Mia' };
    stubApi({
      '/api/dashboard': () => respond({ ...dashboardPayload(), deletedPuppies: [mia] }),
      '/api/dogs': (_url, init) => (init?.method === 'PUT' ? respond({ ...mia, deletedAt: null }) : respond({ error: 'Not found' }, 404)),
    });
    window.history.pushState({}, '', '/settings');
    const restoreButton = () => document.querySelector<HTMLElement>('button[aria-label="Restore Mia"]');

    await renderApp();
    await settleUntil(() => restoreButton() !== null);
    expect(document.body.textContent).toContain(`${en.settings.dogProfiles} (1)`);

    await act(async () => restoreButton()!.click());
    await settle();

    expect(requestedUrls).toContain('/api/dogs?id=pup-2&restore=true');
    expect(restoreButton()).toBeNull();
    expect(document.body.textContent).toContain(`${en.settings.dogProfiles} (2)`);
  });

  it('the owner restores the only dog when every dog is deleted (the dashboard has no dog left)', async () => {
    setAuthToken('app-session');
    setStoredAuthUser(owner);
    stubApi({
      '/api/dashboard': () => respond({ ...dashboardPayload([]), puppies: [], deletedPuppies: [puppy] }),
      '/api/dogs': (_url, init) => (init?.method === 'PUT' ? respond({ ...puppy, deletedAt: null }) : respond({ error: 'Not found' }, 404)),
    });
    window.history.pushState({}, '', '/settings');
    const restoreButton = () => document.querySelector<HTMLElement>('button[aria-label="Restore Rex"]');

    await renderApp();
    await settleUntil(() => restoreButton() !== null);
    await act(async () => restoreButton()!.click());
    await settle();

    expect(requestedUrls).toContain('/api/dogs?id=pup-1&restore=true');
    expect(document.body.textContent).toContain(`${en.settings.dogProfiles} (1)`);
  });

  it("a member's phone drops a cached dog once the dashboard has none left (the owner deleted the last one)", async () => {
    signedInWithCachedDogOnly();
    stubApi({ '/api/dashboard': () => respond({ ...dashboardPayload([]), puppies: [], deletedPuppies: [] }) });

    await renderApp();

    expect(getStoredPuppies()).toEqual([]);
    expect(document.body.textContent).toContain(en.dashboard.welcomeTitle);
  });
});

// App review 2026-10-16, 5.3: the tab title names the screen, in the app language
describe('page title', () => {
  it('follows the screen and the language: "Tableau de bord — PupPace", then "Gestion du foyer — PupPace"', async () => {
    signedInWithCachedDogOnly();
    localStorage.setItem('puppace_lang_v1', 'fr');
    stubApi({ '/api/dashboard': () => respond(dashboardPayload()) });

    await renderApp();
    expect(document.title).toBe('Tableau de bord — PupPace');

    await act(async () => {
      window.history.pushState({}, '', '/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(document.title).toBe('Gestion du foyer — PupPace');
  });

  // AGENTS.md concise labels: 'Profils des chiens (1)' and 'Membres du foyer (3)' were cut at 320 px
  it('in French, the Settings tabs read "Chiens (1)" and "Membres (…)"', async () => {
    signedInWithCachedDogOnly();
    localStorage.setItem('puppace_lang_v1', 'fr');
    stubApi({ '/api/dashboard': () => respond(dashboardPayload()) });
    window.history.pushState({}, '', '/settings');

    await renderApp();
    await settleUntil(() => document.querySelector('button[aria-pressed]') !== null);
    const tabs = [...document.querySelectorAll('button[aria-pressed]')].map((tab) => tab.textContent);
    expect(tabs[0]).toBe('Chiens (1)');
    expect(tabs[1]).toMatch(/^Membres \(\d+\)$/);
  });

  it('in English, the health passport reads "Health Book — PupPace"', async () => {
    signedInWithCachedDogOnly();
    localStorage.setItem('puppace_lang_v1', 'en');
    stubApi({ '/api/dashboard': () => respond(dashboardPayload()) });
    window.history.pushState({}, '', '/health-passport');

    await renderApp();
    expect(document.title).toBe('Health Book — PupPace');
  });
});

// App review 2026-10-16, 5.7: a screen reader's heading list starts with the dog's name
describe('dashboard headings', () => {
  it('one page heading, the dog\'s name, hidden on screen; the cards are headings under it', async () => {
    signedInWithCachedDogOnly();
    stubApi({ '/api/dashboard': () => respond(dashboardPayload()) });

    await renderApp();
    const pageHeadings = [...document.querySelectorAll('h1')];
    expect(pageHeadings.map((heading) => [heading.textContent, heading.className])).toEqual([['Rex', 'sr-only']]);
    expect([...document.querySelectorAll('h2')].map((heading) => heading.textContent)).toEqual(
      expect.arrayContaining([en.potty.nextPee, en.potty.nextPoop, en.potty.nextMeal])
    );
  });
});
