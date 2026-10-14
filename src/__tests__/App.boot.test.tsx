// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '../App';
import { en } from '../i18n/en';
import { setAuthToken, clearAuthToken, setStoredAuthUser } from '../utils/auth';
import { setStoredPuppies, setActivePuppyId, getActivePuppyId } from '../utils/storage';
import { clearApiCache } from '../services/api';
import type { Activity, PuppyProfile, UserAccount } from '../types';

// The real lock screen loads Google's script; this one signs in with a Google ID token at once.
vi.mock('../components/AuthLockScreen', () => ({
  AuthLockScreen: ({ onUnlockWithSSO }: { onUnlockWithSSO: (email: string, name: string, token: string) => unknown }) => (
    <button id="sign-in" onClick={() => onUnlockWithSSO('owner@example.com', 'Owner', 'google-id-token')}>
      Sign in
    </button>
  ),
}));

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
function stubApi(routes: Record<string, () => Promise<Response>>) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    requestedUrls.push(url);
    return routes[url.split('?')[0]]?.() ?? respond({ error: 'Not found' }, 404);
  }));
}

function recentPee(): Activity {
  return { id: 'act-1', puppyId: puppy.id, type: 'pee', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), loggedBy: 'Owner' };
}

function dashboardPayload(activities: Activity[] = [recentPee()]) {
  return { puppies: [puppy], caretakers: [], activities, healthRecords: [] };
}

/** Lets pending responses, lazy chunks and React updates finish. */
async function settle() {
  for (let round = 0; round < 10; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
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
  await new Promise((resolve) => setTimeout(resolve, 0));
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

  it('a return to the app whose stored dog is gone shows the first dog of the refreshed list, without an extra /api/activities request', async () => {
    const removedPuppy: PuppyProfile = { ...puppy, id: 'pup-removed', name: 'Gone' };
    setAuthToken('app-session');
    setStoredAuthUser(owner);
    setStoredPuppies([removedPuppy]);
    setActivePuppyId(removedPuppy.id);
    let dashboardAnswers = 0;
    stubApi({
      '/api/dashboard': () => (dashboardAnswers++ === 0 ? respond({ error: 'Failed to fetch dashboard payload' }, 500) : respond(dashboardPayload())),
      '/api/dogs': () => respond({ error: 'Internal server error' }, 500),
      '/api/households': () => respond({ error: 'Internal server error' }, 500),
    });
    await renderApp();
    requestedUrls = [];

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(requestedUrls).toEqual(['/api/dashboard?puppyId=pup-removed&days=14']);
    expect(isTimelineEmpty()).toBe(false);
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
