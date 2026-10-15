// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '../App';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
import { clearAuthToken, getAuthToken, getStoredAuthUser } from '../utils/auth';
import { clearApiCache } from '../services/api';

// The real lock screen, with a stand-in for Google Identity Services (window.google.accounts.id).

let root: Root | null = null;

// A Google ID token as the lock screen reads it: only the payload (email, name) matters here.
const credential = ['header', btoa(JSON.stringify({ email: 'sitter@example.com', name: 'Sitter' })), 'signature'].join('.');

function stubGoogle() {
  const googleId = {
    initialize: vi.fn(),
    // Google draws its button once, into the element it is given
    renderButton: vi.fn((element: HTMLElement) => { element.innerHTML = '<div role="button" id="gsi-btn"></div>'; }),
    prompt: vi.fn(),
  };
  window.google = { accounts: { id: googleId } };
  return googleId;
}

/** Hands the credential to the callback last given to Google, as its button or One Tap does. */
async function signInWithGoogle(googleId: ReturnType<typeof stubGoogle>) {
  const { callback } = googleId.initialize.mock.calls.at(-1)![0];
  // Not awaited: the session answer may be held by the test
  await act(async () => {
    callback({ credential });
  });
}

function stubSession(answer: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    url === '/api/auth/session' ? answer() : Promise.resolve(new Response('{}', { status: 404 }))));
}

const realSetTimeout = globalThis.setTimeout;

/** Lets pending responses, the lazy lock screen chunk and React updates finish. */
async function settle() {
  for (let round = 0; round < 10; round += 1) {
    await act(async () => {
      await new Promise((resolve) => realSetTimeout(resolve, 0));
      vi.advanceTimersByTime(0);
    });
  }
}

/** Renders the app signed out and waits for the lazy sign-in screen, slower than one settle on a cold import. */
async function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<App />));
  for (let round = 0; round < 50 && !document.querySelector('img[alt="PupPace Logo"]'); round += 1) await settle();
}

const pageText = () => document.body.textContent ?? '';
const gsiScript = () => document.getElementById('google-gsi-script')!;
/** The message a screen reader announces as it appears. */
const alertText = () => document.querySelector('[role="alert"]')?.textContent ?? '';
const googleButton = () => document.getElementById('gsi-btn');

/** Google's button is still on the page and visible, so a refused sign-in can be retried without a reload. */
function expectGoogleButtonUsable(googleId: ReturnType<typeof stubGoogle>) {
  expect(googleButton()).not.toBeNull();
  expect(googleButton()!.closest('.hidden')).toBeNull();
  expect(googleId.renderButton).toHaveBeenCalledTimes(1);
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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  window.history.pushState({}, '', '/');
  localStorage.clear();
  clearAuthToken();
  clearApiCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  document.getElementById('google-gsi-script')?.remove();
  delete window.google;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Sign-in screen', () => {
  it('a pending account keeps the sign-in screen while the session request runs, then sees the pending message in its language; Google is set up and One Tap shown once', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const googleId = stubGoogle();
    let answerSession!: (response: Response) => void;
    stubSession(() => new Promise((resolve) => { answerSession = resolve; }));
    await renderApp();

    await signInWithGoogle(googleId);
    await settle();
    expect(pageText()).toContain(fr.auth.signingIn);
    expect(googleButton()!.parentElement!.classList.contains('hidden')).toBe(true);

    answerSession(new Response(JSON.stringify({ error: 'Account pending activation by Super Admin.' }), { status: 403 }));
    await settle();
    await act(async () => vi.advanceTimersByTime(5 * 60_000));

    expect(alertText()).toContain(fr.auth.pendingActivation);
    expect(pageText()).not.toContain('Account pending activation by Super Admin.');
    expect(pageText()).not.toContain(fr.auth.signingIn);
    expectGoogleButtonUsable(googleId);
    expect(googleId.initialize).toHaveBeenCalledTimes(1);
    expect(googleId.prompt).toHaveBeenCalledTimes(1);
    // No session and no app data for an account waiting for approval
    expect(getAuthToken()).toBeNull();
    expect(getStoredAuthUser()).toBeNull();
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session']);
  });

  it.each([
    ['no network', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a server error', () => Promise.resolve(new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 }))],
    ['a refused token (401)', () => Promise.resolve(new Response(JSON.stringify({ error: 'User account not found' }), { status: 401 }))],
  ])('a sign-in that fails on %s says it failed, not that the account is pending', async (_case, answer) => {
    const googleId = stubGoogle();
    stubSession(answer);
    await renderApp();

    await signInWithGoogle(googleId);
    await settle();

    expect(alertText()).toContain(en.auth.ssoFailed);
    expect(pageText()).not.toContain(en.auth.pendingActivation);
    expect(pageText()).not.toContain('Account pending activation');
    expectGoogleButtonUsable(googleId);
  });

  it('three minutes on the sign-in screen set Google up once: no rebuilt button, no new One Tap', async () => {
    const googleId = stubGoogle();
    await renderApp();

    for (let minute = 0; minute < 3; minute += 1) {
      await act(async () => vi.advanceTimersByTime(60_000));
    }

    expect(googleId.initialize).toHaveBeenCalledTimes(1);
    expect(googleId.renderButton).toHaveBeenCalledTimes(1);
    expect(googleId.prompt).toHaveBeenCalledTimes(1);
  });

  it('Google\'s script loading after 6 s still shows the button', async () => {
    await renderApp();
    await act(async () => vi.advanceTimersByTime(6_000));

    const googleId = stubGoogle();
    await act(async () => gsiScript().dispatchEvent(new Event('load')));

    expect(googleId.initialize).toHaveBeenCalledTimes(1);
    expect(googleId.renderButton).toHaveBeenCalledTimes(1);
  });

  it('Google\'s script failing to load shows a message and a retry button', async () => {
    await renderApp();

    await act(async () => gsiScript().dispatchEvent(new Event('error')));

    expect(alertText()).toContain(en.auth.googleScriptFailed);
    const buttons = [...document.querySelectorAll('button')].map((button) => button.textContent);
    expect(buttons).toContain(en.auth.retry);
  });
});
