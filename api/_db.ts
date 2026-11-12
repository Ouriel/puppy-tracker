/**
 * The database a function connects to. A Vercel preview deployment uses its own Neon branch
 * (PREVIEW_POSTGRES_URL, set for the Preview environment only), so previews never write to production:
 * without it a preview gets no database and fails, never POSTGRES_URL or DATABASE_URL.
 * Production and development never read it, even if it is set there by mistake.
 * getSessionSecret (api/_auth.ts) keeps hashing POSTGRES_URL, so sessions are unchanged.
 */
export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.VERCEL_ENV === 'preview') return env.PREVIEW_POSTGRES_URL || '';
  return env.POSTGRES_URL || env.DATABASE_URL || '';
}
