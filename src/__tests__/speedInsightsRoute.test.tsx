// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { en } from '../i18n/en';
import { setAuthToken, setStoredAuthUser } from '../utils/auth';
import { setActivePuppyId, setStoredPuppies } from '../utils/storage';
import type { PuppyProfile } from '../types';

// The service worker module exists only in a Vite build
vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }));

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-01-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };

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

/** Lets pending responses, lazy chunks and React updates finish. */
async function settle() {
  for (let round = 0; round < 20; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// Layout-shift hunt 2026-10-20: the route was set once at boot, so a shift on the passport was reported under /dashboard
describe('Speed Insights', () => {
  it('reports under the screen shown: its script\'s route follows the navigation', async () => {
    setAuthToken('app-session');
    setStoredAuthUser({ email: 'owner@example.com', name: 'Owner', role: 'Member' });
    setStoredPuppies([puppy]);
    setActivePuppyId(puppy.id);
    const dashboard = { puppies: [puppy], caretakers: [], activities: [], healthRecords: [] };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.startsWith('/api/dashboard') ? dashboard : []))));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<div id="root"></div>';
    const route = () => document.head.querySelector<HTMLScriptElement>('script[src*="speed-insights"]')?.dataset.route;

    // The app as it starts: main.tsx renders it into #root
    await act(async () => {
      await import('../main');
    });
    await settle();
    expect(route()).toBe('/dashboard');

    const passportButton = [...document.querySelectorAll('button')].find((button) => button.textContent === en.health.viewFullHealthPassport)!;
    await act(async () => passportButton.click());
    await settle();
    expect(route()).toBe('/health-passport');

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    await settle();
    expect(route()).toBe('/dashboard');
  });
});
