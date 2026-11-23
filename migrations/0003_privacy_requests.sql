-- 0003_privacy_requests: the privacy policy's request form (owner decision 2026-11-22: a form, not an email address).
-- POST /api/privacy-requests stores a request from /privacy (anyone, no sign-in); the owner lists them and marks
-- them answered in the Admin panel. A request answered more than a year ago is deleted when the owner opens the list.
-- Additive: a new table, no existing row changes. No index: a handful of rows; the hourly cap counts them all.
-- Run it on production before merging the code that writes to it (the form would fail without it).
-- Rollback: roll the code back first, then
--   DROP TABLE IF EXISTS privacy_requests;
--   Requests not answered yet are lost: answer them or copy them out first.
-- Applied to preview: 2026-11-22
-- Applied to production: 2026-11-23 (no backup branch: a new empty table touches no row; counts unchanged)

CREATE TABLE IF NOT EXISTS privacy_requests (
  id text PRIMARY KEY,
  email text NOT NULL,
  kind text NOT NULL,
  message text,
  lang text NOT NULL DEFAULT 'en',
  created_at timestamp with time zone DEFAULT now(),
  handled_at timestamp with time zone
);
