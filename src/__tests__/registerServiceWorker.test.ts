// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import viteConfigSource from '../../vite.config.ts?raw';
import { holdUpdate, registerServiceWorker } from '../registerServiceWorker';

const pwa = vi.hoisted(() => ({
  options: null as RegisterSWOptions | null,
  updateServiceWorker: vi.fn(async () => {}),
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterSWOptions) => {
    pwa.options = options;
    return pwa.updateServiceWorker;
  },
}));

let visibility: DocumentVisibilityState = 'visible';
let serviceWorker = new EventTarget();
const reload = vi.fn();

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  visibility = 'visible';
  serviceWorker = new EventTarget();
  pwa.options = null;
  pwa.updateServiceWorker.mockClear();
  reload.mockClear();
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  vi.stubGlobal('location', { ...window.location, reload });
  vi.stubGlobal('navigator', { serviceWorker });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('registerServiceWorker: an update never reloads the screen someone is looking at', () => {
  it('the new worker waits to be told (owner decision 2026-10-15): registerType prompt, no skipWaiting or clientsClaim', () => {
    // With 'autoUpdate' (or either option) the new worker takes over a visible page on its own and
    // deletes the old precache its lazy chunks load from; the tests below would still pass
    expect(viteConfigSource).toMatch(/registerType: 'prompt'/);
    expect(viteConfigSource).not.toMatch(/(skipWaiting|clientsClaim):\s*true/);
  });

  it('registers at once, so a new version starts downloading at app start', () => {
    registerServiceWorker();
    expect(pwa.options?.immediate).toBe(true);
  });

  it('a new version waiting while the app is on screen switches only when the app goes to the background', () => {
    registerServiceWorker();
    pwa.options?.onNeedRefresh?.();
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    setVisibility('hidden');
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);

    // The listener is gone after that: coming back and leaving again does not switch twice
    setVisibility('visible');
    setVisibility('hidden');
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('a new version waiting while the app is already in the background (or never shown) switches at once', () => {
    visibility = 'hidden';
    registerServiceWorker();
    pwa.options?.onNeedRefresh?.();
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('a switch made elsewhere (another tab) reloads this page only once it is in the background', () => {
    registerServiceWorker();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();

    setVisibility('hidden');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a switch while the page is in the background reloads it at once', () => {
    visibility = 'hidden';
    registerServiceWorker();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("turns off the plugin's own reload (without onNeedReload it reloads at once): controllerchange reloads instead", () => {
    visibility = 'hidden';
    registerServiceWorker();
    expect(pwa.options?.onNeedReload).toBeTypeOf('function');
    pwa.options?.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing without service worker support (plain http, old browsers)', () => {
    vi.stubGlobal('navigator', {});
    expect(() => registerServiceWorker()).not.toThrow();
  });
});

// Audit 2026-11-10: a reload in the background dropped a pee kept as not sent, or a meal note being typed, with no message
describe('registerServiceWorker: logs not sent or an open log form hold the update', () => {
  it('a hide while held neither switches nor reloads; once nothing holds it, the next hide does', () => {
    registerServiceWorker();
    const releaseForm = holdUpdate();
    const releaseUnsent = holdUpdate();
    pwa.options?.onNeedRefresh?.();
    serviceWorker.dispatchEvent(new Event('controllerchange'));

    setVisibility('hidden');
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    // The form is closed, a log is still not sent
    setVisibility('visible');
    releaseForm();
    setVisibility('hidden');
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    // Released on screen: still never a reload of a visible page
    setVisibility('visible');
    releaseUnsent();
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    setVisibility('hidden');
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a new version found while the app is held in the background waits for the next hide after the release', () => {
    visibility = 'hidden';
    const release = holdUpdate();
    registerServiceWorker();
    pwa.options?.onNeedRefresh?.();
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    release();
    setVisibility('visible');
    setVisibility('hidden');
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1);
  });
});
