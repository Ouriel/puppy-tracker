import { registerSW } from 'virtual:pwa-register';

// Now if the page is hidden, else the next time it is: from visible, the next change is to hidden
function whenHidden(action: () => void) {
  if (document.visibilityState === 'hidden') action();
  else document.addEventListener('visibilitychange', action, { once: true });
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
