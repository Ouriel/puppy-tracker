import { registerSW } from 'virtual:pwa-register';

// Logs not sent and an open log form live only in memory: while one holds it, an update neither switches nor reloads
let holdCount = 0;

/** Holds updates until the returned release is called; once nothing holds them, the next hide switches, as before. */
export function holdUpdate(): () => void {
  holdCount += 1;
  return () => {
    holdCount -= 1;
  };
}

// Now if the page is hidden and nothing holds the update, else at the first hide after that
function whenHidden(action: () => void) {
  const runIfFree = () => {
    if (document.visibilityState !== 'hidden' || holdCount > 0) return;
    document.removeEventListener('visibilitychange', runIfFree);
    action();
  };
  document.addEventListener('visibilitychange', runIfFree);
  runIfFree();
}

// An update never reloads the screen someone is looking at (owner decision 2026-10-15): the new
// version downloads at once and waits (registerType 'prompt', so the old precache, lazy chunks
// included, stays until then), and the app switches to it when it goes to the background.
export function registerServiceWorker() {
  // Every tab of the app reloads once the new worker controls it, whichever tab activated it: the
  // plugin's onNeedReload misses a tab that saw the update as its own while another tab activated it
  navigator.serviceWorker?.addEventListener('controllerchange', () => whenHidden(() => window.location.reload()));
  const updateServiceWorker = registerSW({
    immediate: true,
    // The new worker is waiting: activate it
    onNeedRefresh: () => whenHidden(() => void updateServiceWorker()),
    // The controllerchange listener reloads; without this option the plugin reloads at once
    onNeedReload: () => {},
  });
}
