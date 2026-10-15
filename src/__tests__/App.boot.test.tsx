// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '../App';
import { en } from '../i18n/en';
import { setAuthToken, clearAuthToken, setStoredAuthUser } from '../utils/auth';
import { setStoredPuppies, setActivePuppyId, getActivePuppyId } from '../utils/storage';
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
const owner: UserAccount = { id: 'usr-1', email: 'owner@example.com', name: 'Owner', role: 'Member' };

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

const isSkeletonShown = () => document.querySelector('.h-48.animate-pulse') !== null;
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
  const testRecord: HealthRecord = { id: 'hr-1', householdId: 'hh-1', puppyId: puppy.id, type: 'vaccination', name: 'Vaccine-T1', date: '2026-09-01' };

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
    await settleUntil(() => document.body.textContent!.includes(en.weightChart.title));

    expect(document.body.textContent).toContain(en.weightChart.title);
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

    expect(document.body.textContent).toContain('0g / 200g (0/3)');
  });
});
