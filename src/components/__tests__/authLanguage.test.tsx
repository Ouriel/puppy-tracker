// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AuthLockScreen } from '../AuthLockScreen';
import { I18nProvider } from '../../i18n';
import { en } from '../../i18n/en';
import { fr } from '../../i18n/fr';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('sign-in screen language', () => {
  it('its EN / FR button switches the screen to French before any sign-in, and keeps the choice', async () => {
    localStorage.setItem('puppace_lang_v1', 'en');
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<I18nProvider><AuthLockScreen onUnlockWithSSO={vi.fn()} /></I18nProvider>));
    const languageButton = container.querySelector<HTMLButtonElement>(`button[aria-label="${en.nav.changeLanguage}"]`)!;
    expect(languageButton.textContent).toBe('EN');
    expect(container.textContent).toContain(en.auth.subtitle);

    await act(async () => languageButton.click());

    expect(container.textContent).toContain(fr.auth.subtitle);
    expect(container.querySelector(`button[aria-label="${fr.nav.changeLanguage}"]`)!.textContent).toBe('FR');
    expect(localStorage.getItem('puppace_lang_v1')).toBe('fr');
  });
});
