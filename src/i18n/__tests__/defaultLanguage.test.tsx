// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLocale } from 'react-aria-components';
import { toast } from '@heroui/react';
import { AppToastProvider } from '../../components/common/AppToastProvider';
import { I18nProvider, useI18n } from '../index';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  localStorage.clear();
  vi.restoreAllMocks();
});

function LanguageProbe() {
  return <span id="lang">{useI18n().lang}</span>;
}

async function languageOnOpen(phoneLanguage: string) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(phoneLanguage);
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root!.render(<I18nProvider><LanguageProbe /></I18nProvider>));
  return container.querySelector('#lang')!.textContent;
}

describe('language on a new install', () => {
  it.each([['fr-FR', 'fr'], ['fr', 'fr'], ['en-GB', 'en'], ['de-DE', 'en']])('phone set to %s -> %s', async (phoneLanguage, expected) => {
    expect(await languageOnOpen(phoneLanguage)).toBe(expected);
  });

  it('a saved choice wins over the phone language', async () => {
    localStorage.setItem('puppace_lang_v1', 'en');
    expect(await languageOnOpen('fr-FR')).toBe('en');
  });
});

// App review 2026-10-16, 5.7: react-aria's own words (a modal's hidden Dismiss button) follow the app language, not the phone's
describe('react-aria locale', () => {
  function LocaleProbe() {
    return <span id="locale">{useLocale().locale}</span>;
  }

  it('an English phone with the app in French gives react-aria "fr-FR"', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    localStorage.setItem('puppace_lang_v1', 'fr');
    const container = document.createElement('div');
    root = createRoot(container);
    await act(async () => root!.render(<I18nProvider><LocaleProbe /></I18nProvider>));
    expect(container.querySelector('#locale')!.textContent).toBe('fr-FR');
  });

  // HeroUI's toast close button says "Close" whatever the locale: the app names it
  it('a toast\'s close button reads "Fermer" in French, on an English phone', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    localStorage.setItem('puppace_lang_v1', 'fr');
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.matchMedia ??= ((query: string) => ({
      matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<I18nProvider><AppToastProvider /></I18nProvider>));
    try {
      await act(async () => {
        toast.success('Enregistré');
      });
      const close = document.querySelector('[data-slot="toast-close"]')!;
      expect(close.getAttribute('aria-label')).toBe('Fermer');
      expect(document.body.textContent).toContain('Enregistré');
    } finally {
      await act(async () => toast.clear());
      container.remove();
    }
  });
});
