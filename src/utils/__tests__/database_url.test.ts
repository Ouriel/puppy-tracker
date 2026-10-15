import { describe, it, expect } from 'vitest';
import { getDatabaseUrl } from '../../../api/_db.js';

// Previews use their own Neon branch (Phase 6b, owner OK 2026-10-15); production must never read it.
describe('getDatabaseUrl', () => {
  const prod = 'postgres://prod.example/db';
  const previewBranch = 'postgres://preview.example/db';

  it('uses the preview branch only on a Vercel preview deployment', () => {
    expect(getDatabaseUrl({ VERCEL_ENV: 'preview', PREVIEW_POSTGRES_URL: previewBranch, POSTGRES_URL: prod })).toBe(previewBranch);
  });

  it('never uses the preview branch in production or development, even if it is set there by mistake', () => {
    expect(getDatabaseUrl({ VERCEL_ENV: 'production', PREVIEW_POSTGRES_URL: previewBranch, POSTGRES_URL: prod })).toBe(prod);
    expect(getDatabaseUrl({ VERCEL_ENV: 'development', PREVIEW_POSTGRES_URL: previewBranch, POSTGRES_URL: prod })).toBe(prod);
    expect(getDatabaseUrl({ PREVIEW_POSTGRES_URL: previewBranch, POSTGRES_URL: prod })).toBe(prod);
  });

  it('falls back to POSTGRES_URL, then DATABASE_URL, when no preview branch is set', () => {
    expect(getDatabaseUrl({ VERCEL_ENV: 'preview', POSTGRES_URL: prod })).toBe(prod);
    expect(getDatabaseUrl({ VERCEL_ENV: 'preview', DATABASE_URL: prod })).toBe(prod);
    expect(getDatabaseUrl({})).toBe('');
  });
});
