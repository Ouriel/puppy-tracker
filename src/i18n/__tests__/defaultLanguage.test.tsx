// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
