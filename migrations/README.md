# Database migrations

Hand-written SQL, run by hand. Nothing runs these files automatically: no deploy, no script, no tool.
`src/db/schema.ts` describes the tables for the queries (drizzle-orm); these files change the database.
`src/db/__tests__/migrations.test.ts` checks that, applied in order, they build every column and index of `schema.ts`.

## Convention

- One file per change: `NNNN_short_name.sql`, numbered in order (`0001_puppies_deleted_at.sql`).
- Idempotent where possible: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, so a second run changes nothing.
- Prefer additive changes (a nullable column, an index). A change that drops or rewrites data needs the owner's explicit OK and a plan that carries the existing rows over.
- Each file starts with a comment block:

  ```sql
  -- NNNN_short_name: what it changes and why.
  -- Rollback: the SQL that undoes it (or why there is none).
  -- Applied to preview: <date>
  -- Applied to production: <date>
  ```

  Fill the two "Applied" lines by hand, in the same pull request or a follow-up one, once each run is done.
- Update `src/db/schema.ts` in the same pull request. The code that needs the change merges only after the file is applied to production.
- `0000_baseline.sql` documents the schema as of 2026-10-15. It is already applied: never run it on an existing database.

## Procedure

1. **Backup branch.** Neon console > Branches > Create branch from `main` (production), named `backup-before-NNNN`. Delete it once the change has lived a few days without trouble.
2. **Preview.** Run the file on the `preview` branch (Neon SQL editor with `preview` selected, or `psql "$PREVIEW_POSTGRES_URL" -f migrations/NNNN_short_name.sql`). Fill "Applied to preview".
3. **Check the preview deployment.** Open the pull request's preview, use what the change is for, and check that the rest still works (dashboard, a log, the health passport).
4. **Production, with the owner's OK.** Run the same file on `main`. Fill "Applied to production".
5. **Count check.** Run the same counts before and after each run, and compare: `SELECT COUNT(*) FROM puppies;` and the same for `activities`, `health_records`, `caretakers`, `users`, `households`. An additive change leaves every count unchanged. Check the new column or index with `information_schema.columns` or `pg_indexes`.
6. Merge the code that needs the change.

A preview "Reset from parent" copies production again: a file run on preview only is gone after it. Run it again, then re-run the demo seed (`scripts/preview-seed.sql`).
