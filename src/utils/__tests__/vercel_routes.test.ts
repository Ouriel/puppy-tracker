import { describe, it, expect } from 'vitest';
import vercelConfig from '../../../vercel.json';

// The SPA fallback is the rewrite whose destination is /index.html. Vercel compiles
// `source` with path-to-regexp; this pattern has no named params, so it is the same regex.
const spaRewrite = vercelConfig.rewrites.find((rewrite) => rewrite.destination === '/index.html');
const spaPattern = new RegExp(`^${spaRewrite?.source}$`);

describe('vercel.json SPA rewrite', () => {
  it.each(['/', '/settings', '/health-passport'])('serves the app for %s', (path) => {
    expect(spaPattern.test(path)).toBe(true);
  });

  it.each(['/assets/x.js', '/sw.js', '/api/x', '/api/dashboard/typo'])('never rewrites %s to the app', (path) => {
    expect(spaPattern.test(path)).toBe(false);
  });
});
