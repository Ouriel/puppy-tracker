import { describe, it, expect } from 'vitest';
import vercelConfig from '../../../vercel.json';
import indexHtml from '../../../index.html?raw';

// The pages served as written, and the app's source files (tests excluded)
const staticPages = import.meta.glob<string>('../../../public/*.html', { query: '?raw', import: 'default', eager: true });
const sourceFiles = import.meta.glob<string>(['../../**/*.{ts,tsx}', '!../../**/__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const pages: Record<string, string> = { 'index.html': indexHtml, ...staticPages };

const allRoutes = vercelConfig.headers.find((block) => block.source === '/(.*)');
const header = (key: string) => allRoutes?.headers.find((entry) => entry.key === key)?.value;

const policy = new Map(
  (header('Content-Security-Policy-Report-Only') ?? '').split(';').map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources] as const;
  })
);

// A bare origin allows any path on it, a path ending in "/" what is under it, any other path only itself
function allows(directive: string, url: string): boolean {
  const target = new URL(url);
  return (policy.get(directive) ?? []).some((source) => {
    if (!source.startsWith('https://')) return false;
    const allowed = new URL(source);
    if (allowed.origin !== target.origin) return false;
    if (source === allowed.origin) return true;
    return source.endsWith('/') ? target.pathname.startsWith(allowed.pathname) : target.pathname === allowed.pathname;
  });
}

// Google Calendar's new-event page, opened by the Add to calendar button on Android
const OPENED_PAGES = ['https://calendar.google.com/calendar/render'];

describe('vercel.json security headers', () => {
  it.each(['/', '/settings', '/privacy', '/terms', '/sw.js', '/assets/index.js', '/api/dashboard'])('apply to %s', (path) => {
    expect(new RegExp(`^${allRoutes?.source}$`).test(path)).toBe(true);
  });

  it('enforce nosniff, the referrer policy and no framing', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('X-Frame-Options')).toBe('DENY');
  });

  it('only report the Content-Security-Policy until it is checked on production', () => {
    expect(header('Content-Security-Policy')).toBeUndefined();
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'self'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
  });

  it('run no inline or eval script; inline styles stay allowed', () => {
    // script-src-elem and script-src-attr override script-src: none of them may allow an 'unsafe-...' source
    const scriptDirectives = [...policy.keys()].filter((name) => name.startsWith('script-src'));
    expect(scriptDirectives).toContain('script-src');
    const unsafe = scriptDirectives.flatMap((name) =>
      policy.get(name)!.filter((source) => source.includes('unsafe')).map((source) => `${name} ${source}`)
    );
    expect(unsafe).toEqual([]);
    // The print windows and the /privacy and /terms pages carry <style> blocks and style attributes
    expect(policy.get('style-src')).toContain("'unsafe-inline'");
  });

  // Widening a source (https:, *, *.google.com) would keep every other test green
  it('name each source exactly: a keyword, a full https URL with no wildcard, data: and blob: for images only', () => {
    const loose = [...policy].flatMap(([name, sources]) =>
      sources
        .filter((source) => !/^'[a-z-]+'$/.test(source))
        .filter((source) => !(name === 'img-src' && (source === 'data:' || source === 'blob:')))
        .filter((source) => !/^https:\/\/[^*]+$/.test(source))
        .map((source) => `${name} ${source}`)
    );
    expect(loose).toEqual([]);
  });

  it('allow Google sign-in', () => {
    expect(allows('script-src', 'https://accounts.google.com/gsi/client')).toBe(true);
    expect(allows('style-src', 'https://accounts.google.com/gsi/style')).toBe(true);
    expect(allows('frame-src', 'https://accounts.google.com/gsi/button')).toBe(true);
    expect(allows('connect-src', 'https://accounts.google.com/gsi/status')).toBe(true);
  });

  it('allow every external URL the pages and the app reference', () => {
    const referenced = [...Object.values(pages), ...Object.values(sourceFiles)]
      .flatMap((content) => content.match(/https:\/\/[^\s"'`<>)]+/g) ?? [])
      // The app's own origin is 'self'
      .filter((url) => new URL(url).origin !== 'https://puppace.vercel.app')
      // Pages the app opens in a new tab (window.open) are navigations, which CSP does not govern
      .filter((url) => !OPENED_PAGES.some((page) => url.startsWith(page)));
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((url) => ![...policy.keys()].some((directive) => allows(directive, url)))).toEqual([]);
  });

  // A stylesheet or script in index.html holds up the app's start until its host answers
  it('index.html loads nothing from another host', () => {
    expect(indexHtml.match(/<(?:link|script)\b[^>]*https:\/\/[^>]*>/gi) ?? []).toEqual([]);
  });

  it.each(Object.keys(pages))('%s runs no inline script or event handler', (page) => {
    expect(pages[page]).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i);
    expect(pages[page]).not.toMatch(/\son[a-z]+\s*=/i);
  });
});
