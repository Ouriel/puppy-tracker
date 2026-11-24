-- 0004_invites: an invite waits for the invitee's yes (security audit M1 and S1, owner: "go for all").
-- POST /api/users stores an invite here instead of creating, activating or moving an account; the invitee sees it on
-- the dashboard and joins (POST /api/invites) or declines (DELETE /api/invites). An answered invite is deleted, and so
-- is one older than 90 days at the next invite anyone sends.
-- Additive: a new table, no existing row changes. The unique index makes a repeated invite update the same row
-- (ON CONFLICT), and its first column, email, serves the dashboard's and the sign-in's lookups.
-- Run it on production before merging the code that writes to it (every invite would fail without it).
-- Rollback: roll the code back first, then
--   DROP TABLE IF EXISTS invites;
--   Invites not answered yet are lost: the inviter sends them again.
-- Applied to preview: not yet
-- Applied to production: not yet

CREATE TABLE IF NOT EXISTS invites (
  id text PRIMARY KEY,
  email text NOT NULL,
  household_id text NOT NULL,
  role text NOT NULL DEFAULT 'Member',
  invited_by text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_email_household ON invites (email, household_id);
