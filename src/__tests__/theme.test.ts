// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import indexHtml from '../../index.html?raw';
import { readFileSync } from 'node:fs';

const page = new DOMParser().parseFromString(indexHtml, 'text/html');
// Read from disk: Vitest turns every CSS import, ?raw included, into an empty string
const indexCss = readFileSync(`${import.meta.dirname}/../index.css`, 'utf8');

/** The declarations of the first rule written exactly as `selector {`, as { property: value } */
function declarations(selector: string): Record<string, string> {
  const start = indexCss.indexOf(`${selector} {`);
  expect(start, `index.css has a "${selector}" rule`).toBeGreaterThanOrEqual(0);
  const body = indexCss.slice(indexCss.indexOf('{', start) + 1, indexCss.indexOf('}', start));
  return Object.fromEntries(
    body.split(';').map((declaration) => declaration.split(':').map((part) => part.trim())).filter(([property]) => property),
  );
}

describe('index.html', () => {
  it('is dark only: HeroUI gets its dark theme and native controls a dark color scheme', () => {
    expect(page.documentElement.classList.contains('dark')).toBe(true);
    expect(page.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(page.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');
  });

  it('#root clips what is too wide, so the page can never be scrolled sideways', () => {
    const root = page.getElementById('root')!;
    expect(root.classList.contains('overflow-x-clip')).toBe(true);
    expect(root.classList.contains('overflow-x-hidden')).toBe(false);
  });
});

describe('index.css', () => {
  it("maps HeroUI's primary, focus and danger to the palette colours the app's own classes use (one indigo-600, one red)", () => {
    const theme = declarations('.dark');
    expect(theme['--accent']).toBe('var(--color-indigo-600)');
    expect(theme['--focus']).toBe('var(--color-indigo-500)');
    expect(theme['--danger']).toBe('var(--color-red-600)');
    // No hand-copied hex that can drift from Tailwind's palette; white text is the only literal
    const literals = Object.values(theme).filter((value) => value.startsWith('#'));
    expect(literals.every((value) => value === '#fff')).toBe(true);
  });

  it("keeps Google's sign-in iframes in a light color scheme, so the dark page does not paint them white", () => {
    expect(declarations('iframe[src*="accounts.google.com"]')['color-scheme']).toBe('light');
  });
});
