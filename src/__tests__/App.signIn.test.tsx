// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '../App';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
import { clearAuthToken, getAuthToken, getStoredAuthUser, setAuthToken, setStoredAuthUser } from '../utils/auth';
import { clearApiCache } from '../services/api';
import { toast } from '@heroui/react';

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
    disableAutoSelect: vi.fn(),
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
/** The calm "waiting for approval" note (a status, not an alert). */
const pendingNote = () => [...document.querySelectorAll('[role="status"]')].find((element) => element.querySelector('.lucide-clock'));
const PENDING_FR = "Demande envoyée. L'admin de ton foyer doit valider ton compte\u00a0; reviens te connecter ensuite.";
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

    expect(pendingNote()?.textContent).toContain(fr.auth.pendingActivation);
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

  // App review 2026-10-16, Sign-in, and owner decision 14: a new member waiting for approval saw a red ⚠️ box, gone after a reload
  describe('waiting for approval', () => {
    async function signInPending(googleId: ReturnType<typeof stubGoogle>) {
      stubSession(() => Promise.resolve(new Response(JSON.stringify({ error: 'pending' }), { status: 403 })));
      await signInWithGoogle(googleId);
      await settle();
    }

    async function reload() {
      await act(async () => root?.unmount());
      document.body.innerHTML = '';
      await renderApp();
    }

    it("is a calm note, not an error: it says the household's admin approves, what to do next, and which account waits", async () => {
      localStorage.setItem('puppace_lang_v1', 'fr');
      const googleId = stubGoogle();
      await renderApp();
      await signInPending(googleId);

      expect(pendingNote()?.textContent).toContain(PENDING_FR);
      expect(pendingNote()?.textContent).toContain('sitter@example.com');
      expect(document.querySelector('[role="alert"]')).toBeNull();
      // No warning triangle, the icon of the sign-in errors
      expect(document.querySelector('[class*="triangle-alert"], [class*="alert-triangle"]')).toBeNull();
    });

    it('is still there after a reload, with no sign-in and no request', async () => {
      localStorage.setItem('puppace_lang_v1', 'fr');
      const googleId = stubGoogle();
      await renderApp();
      await signInPending(googleId);
      vi.mocked(fetch).mockClear();

      await reload();

      expect(pendingNote()?.textContent).toContain(PENDING_FR);
      expect(pendingNote()?.textContent).toContain('sitter@example.com');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('"Utiliser un autre compte Google" removes it for good and stops Google picking the same account by itself', async () => {
      localStorage.setItem('puppace_lang_v1', 'fr');
      const googleId = stubGoogle();
      await renderApp();
      await signInPending(googleId);

      const otherAccount = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Utiliser un autre compte Google')!;
      expect(otherAccount.classList).toContain('min-h-11');
      await act(async () => otherAccount.click());

      expect(pendingNote()).toBeUndefined();
      expect(googleId.disableAutoSelect).toHaveBeenCalledTimes(1);
      expectGoogleButtonUsable(googleId);
      await reload();
      expect(pendingNote()).toBeUndefined();
    });

    it('is gone once the account, approved, signs in: a later visit to the sign-in screen does not show it', async () => {
      const googleId = stubGoogle();
      await renderApp();
      await signInPending(googleId);
      expect(pendingNote()).toBeDefined();

      const session = { user: { email: 'sitter@example.com', name: 'Sitter', householdId: 'hh-1', role: 'Member' }, sessionToken: 'session-token', expiresInDays: 90 };
      stubSession(() => Promise.resolve(new Response(JSON.stringify(session), { status: 200 })));
      await signInWithGoogle(googleId);
      await settle();
      expect(getAuthToken()).toBe('session-token');

      // The session ends (401 from the API): back to the sign-in screen
      await act(async () => window.dispatchEvent(new Event('puppace:unauthorized')));
      for (let round = 0; round < 50 && !document.querySelector('img[alt="PupPace Logo"]'); round += 1) await settle();
      expect(pendingNote()).toBeUndefined();
    });
  });

  // App review 2026-10-16, Sign-in, and owner decision 14: the legal links left the app for English pages; jargon on the screen
  describe('legal links and wording', () => {
    const link = (text: string) => [...document.querySelectorAll('a')].find((anchor) => anchor.textContent === text)!;

    it.each([
      ['Politique de confidentialité', '/privacy'],
      ["Conditions générales d'utilisation", '/terms'],
    ])('"%s" opens the translated page in the app, and keeps its link to the static page for Google', async (text, href) => {
      localStorage.setItem('puppace_lang_v1', 'fr');
      stubGoogle();
      await renderApp();

      expect(link(text).getAttribute('href')).toBe(href);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      await act(async () => link(text).dispatchEvent(click));

      expect(click.defaultPrevented).toBe(true);
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(text);
    });

    it('"À propos" reads in French', async () => {
      localStorage.setItem('puppace_lang_v1', 'fr');
      stubGoogle();
      await renderApp();

      const about = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-expanded') !== null)!;
      await act(async () => about.click());

      expect(pageText()).toContain('PupPace enregistre les besoins');
      expect(pageText()).not.toMatch(/records your puppy|Disclosure/);
    });

    it.each(['en', 'fr'])('the sign-in screen says "Google", never "OAuth", "Super Admin" or a person (%s)', async (lang) => {
      localStorage.setItem('puppace_lang_v1', lang);
      stubGoogle();
      await renderApp();

      expect(pageText()).toContain(lang === 'fr' ? 'Se connecter avec Google' : 'Sign in with Google');
      expect(pageText()).not.toMatch(/OAuth|super.?admin|Matthieu/i);
    });
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

  it("keeps the Admin role a sign-in returns, so a family's first member sees the invite form", async () => {
    const googleId = stubGoogle();
    const session = { user: { email: 'sitter@example.com', name: 'Sitter', householdId: 'house-sitter', role: 'Admin' }, sessionToken: 'session-token', expiresInDays: 90 };
    stubSession(() => Promise.resolve(new Response(JSON.stringify(session), { status: 200 })));
    await renderApp();

    await signInWithGoogle(googleId);
    await settle();

    expect(getStoredAuthUser()?.role).toBe('Admin');
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

// Audit S2: an account the owner revoked is told so, in its own words, and never as a request waiting for approval
describe('Revoked access', () => {
  it('a revoked sign-in says the access was removed, not "request sent", and keeps no pending note', async () => {
    const googleId = stubGoogle();
    stubSession(() => Promise.resolve(new Response(JSON.stringify({ error: 'Access removed by the owner.', code: 'revoked' }), { status: 403 })));
    await renderApp();

    await signInWithGoogle(googleId);
    await settle();

    expect(pageText()).toContain(en.auth.accessRemoved);
    expect(pageText()).not.toContain(en.auth.pendingActivation);
    expect(pendingNote()).toBeUndefined();
    expect(localStorage.getItem('puppace_pending_email')).toBeNull();
    expect(getAuthToken()).toBeNull();
    expectGoogleButtonUsable(googleId);
  });

  it('a signed-in account revoked since is sent back to the lock screen, which says why', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    stubGoogle();
    setAuthToken('app-session');
    setStoredAuthUser({ email: 'sitter@example.com', name: 'Sitter', role: 'Member' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'Session revoked', code: 'revoked' }), { status: 401 }))));

    await renderApp();

    expect(pageText()).toContain(fr.auth.accessRemoved);
    expect(pageText()).not.toContain(fr.auth.pendingActivation);
    expect(getAuthToken()).toBeNull();
  });
});

// Audit S3: after "Delete my account", nothing of the account or its household stays on the phone, and Google does not
// sign it straight back in (that would create a new sign-up)
describe('Delete my account', () => {
  const sitter = { email: 'sitter@example.com', name: 'Sitter', role: 'Member' as const };
  const puppy = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-01-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
  const householdKeys = ['puppace_active_puppy', 'puppace_cached_puppies', 'puppace_cached_caretakers', 'puppace_cached_activities_recent', 'puppace_cached_health_records'];
  const button = (text: string) => [...document.querySelectorAll('button')].filter((element) => element.textContent?.includes(text));

  it('confirms, deletes the account, clears the session and the household data kept on the phone, and shows the lock screen', async () => {
    const googleId = stubGoogle();
    setAuthToken('app-session');
    setStoredAuthUser(sitter);
    window.history.pushState({}, '', '/settings');
    const deleted: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/dashboard')) {
        const badge = { id: 'c-1', name: 'Sitter', role: 'Member', color: '#EC4899', email: sitter.email };
        return Promise.resolve(new Response(JSON.stringify({ puppies: [puppy], caretakers: [badge], activities: [], healthRecords: [] })));
      }
      if (url.startsWith('/api/users') && init?.method === 'DELETE') {
        deleted.push(url);
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<App />));
    for (let round = 0; round < 50 && button(en.settings.householdMembers).length === 0; round += 1) await settle();
    expect(localStorage.getItem('puppace_cached_puppies')).toContain('Rex');

    await act(async () => button(en.settings.householdMembers)[0].click());
    await act(async () => button(en.household.deleteMyAccount)[0].click());
    expect(pageText()).toContain(en.household.deleteMyAccountMessage);
    await act(async () => button(en.household.deleteMyAccount).at(-1)!.click());
    for (let round = 0; round < 50 && !document.querySelector('img[alt="PupPace Logo"]'); round += 1) await settle();

    expect(deleted).toEqual(['/api/users?email=sitter%40example.com']);
    expect(getAuthToken()).toBeNull();
    expect(getStoredAuthUser()).toBeNull();
    expect(householdKeys.map((key) => localStorage.getItem(key))).toEqual(householdKeys.map(() => null));
    expect(googleId.initialize).toHaveBeenCalledWith(expect.objectContaining({ auto_select: false }));
    expect(googleId.disableAutoSelect).toHaveBeenCalled();
  });
});

// Audit M1 and S1: an invite waits on the invitee's dashboard; nobody joins a household without tapping Join
describe('Invite card', () => {
  const jane = { email: 'jane.doe@example.com', name: 'Jane Doe', role: 'Admin' as const };
  const puppy = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-01-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
  const oldBadge = { id: 'c-old', name: 'Jane alone', role: 'Member', color: '#EC4899', email: jane.email };
  const newBadge = { id: 'c-new', name: 'Jane', role: 'Member', color: '#10B981', email: jane.email };
  const button = (text: string) => [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === text);

  /** Signed in alone in an empty household, with one invite; `joinAnswer` answers Join. */
  async function renderWithInvite(invite: { householdName: string | null }, joinAnswer = () => new Response(JSON.stringify({ success: true }))) {
    stubGoogle();
    setAuthToken('app-session');
    setStoredAuthUser(jane);
    let hasJoined = false;
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
      if (url.startsWith('/api/dashboard')) {
        const payload = hasJoined
          ? { puppies: [puppy], caretakers: [newBadge], activities: [], healthRecords: [], invites: [] }
          : { puppies: [], caretakers: [oldBadge], activities: [], healthRecords: [], invites: [{ id: 'inv-1', invitedBy: 'Claire', ...invite }] };
        return Promise.resolve(new Response(JSON.stringify(payload)));
      }
      if (url === '/api/invites' && init?.method === 'POST') {
        const answer = joinAnswer();
        hasJoined = answer.ok;
        return Promise.resolve(answer);
      }
      if (url.startsWith('/api/invites?id=') && init?.method === 'DELETE') return Promise.resolve(new Response(JSON.stringify({ success: true })));
      if (url === '/api/auth/session') {
        return Promise.resolve(new Response(JSON.stringify({ user: { ...jane, householdId: 'hh-martin', role: 'Member' }, sessionToken: 'session-after-join' })));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<App />));
    for (let round = 0; round < 50 && !button(en.dashboard.joinInvite) && !button(fr.dashboard.joinInvite); round += 1) await settle();
    return calls;
  }

  it('shows who invited, at the top of the dashboard; Join moves the account, drops the old household kept on the phone and loads the new one as a Member', async () => {
    const calls = await renderWithInvite({ householdName: null });
    expect(pageText()).toContain('Claire invited you to join their household.');
    expect(localStorage.getItem('puppace_cached_caretakers')).toContain('Jane alone');

    await act(async () => button(en.dashboard.joinInvite)!.click());
    for (let round = 0; round < 50 && !pageText().includes('Rex'); round += 1) await settle();

    expect(calls.filter((call) => call.url === '/api/invites')).toEqual([{ url: '/api/invites', method: 'POST', body: JSON.stringify({ id: 'inv-1' }) }]);
    expect(pageText()).not.toContain('Claire invited you');
    expect(pageText()).toContain('Rex');
    expect(localStorage.getItem('puppace_cached_caretakers')).not.toContain('Jane alone');
    expect(getStoredAuthUser()?.role).toBe('Member');
    expect(getAuthToken()).toBe('session-after-join');
  });

  it('a household with dogs or other members is refused: a toast says so, the invite stays and nothing moves', async () => {
    const danger = vi.spyOn(toast, 'danger').mockImplementation(() => '');
    const calls = await renderWithInvite({ householdName: null }, () => new Response(JSON.stringify({ error: 'x', code: 'inviteLeaveFirst' }), { status: 409 }));

    await act(async () => button(en.dashboard.joinInvite)!.click());
    await settle();

    expect(danger).toHaveBeenCalledWith(en.toasts.inviteLeaveFirst);
    expect(pageText()).toContain('Claire invited you to join their household.');
    expect(calls.some((call) => call.url === '/api/auth/session')).toBe(false);
    expect(getStoredAuthUser()?.role).toBe('Admin');
  });

  it('names a household the owner named, in French too; Refuser declines it and joins nothing', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    const calls = await renderWithInvite({ householdName: 'Famille Martin' });
    expect(pageText()).toContain('Claire t\'invite à rejoindre « Famille Martin ».');

    await act(async () => button(fr.dashboard.declineInvite)!.click());
    await settle();

    expect(calls.filter((call) => call.url.startsWith('/api/invites'))).toEqual([{ url: '/api/invites?id=inv-1', method: 'DELETE', body: undefined }]);
    expect(pageText()).not.toContain('Claire');
    expect(getStoredAuthUser()?.role).toBe('Admin');
  });
});
