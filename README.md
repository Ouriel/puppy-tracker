<div align="center">
  <img src="public/puppace_logo.webp" alt="PupPace logo" width="110" />

  # PupPace

  **A family app to track a puppy's pees, poops, meals, weight and health passport, and guess what comes next.**

  [puppace.vercel.app](https://puppace.vercel.app) · installable web app · English and French
</div>

React 19 · Vite 8 · HeroUI v3 · Tailwind 4 · Vercel serverless functions · Neon Postgres (Drizzle) · Google sign-in · Vitest

---

**Part 1, for the family:** [What it does](#what-it-does) · [Signing in](#signing-in-and-families) · [Dashboard](#dashboard) · [Logging](#logging-an-event) · [History](#history) · [Health passport](#health-passport) · [Settings](#settings) · [Phone, offline, updates](#phone-install-offline-and-updates)

**Part 2, for developers:** [Architecture](#architecture) · [Auth](#auth-and-permissions) · [Data model](#data-model) · [Caching](#caching-and-freshness) · [Local setup](#local-setup) · [Scripts](#scripts) · [Testing](#testing) · [CI/CD](#cicd) · [Known limitations](#known-limitations)

---

# Part 1: using the app

## What it does

- **Log** pees, poops, meals, weigh-ins and medication in one tap or one short form. Every log shows who made it.
- **Predict** the next pee, poop and meal from the dog's own history, with a countdown and a colour: calm, soon (amber), overdue (red).
- **Keep a health passport**: vaccines and dewormings with suggested booster dates, one weight timeline with an adult-weight estimate, and exports for the vet.
- **Share** it: everyone in the family signs in with Google and sees the same dogs and logs.

## Signing in and families

- Sign in with Google. The first sign-in of a new person creates an account **waiting for approval**, in a new household of its own; the app shows "pending activation" until the owner approves it.
- The owner can also **invite** someone by email in advance (Settings > Household Members). An invited person lands directly in the owner's family.
- Several families can use the same app: each household sees only its own dogs, logs and members. Only the owner moves an account from one household to another, and always after a confirmation.
- A session lasts 90 days and is renewed each time the app is opened. A removed or revoked account is sent back to the sign-in screen on its next request.

## Dashboard

Three cards, one per need, for the selected dog (pick the dog in the top bar).

| | Pee | Poop | Meal |
|---|---|---|---|
| Shows | countdown, clock time, ± margin, today's count, time since the last one, the reason | same | grams eaten / goal and meals (n of target), time since the last meal, the reason |
| One-tap buttons | Peed Outside · Accident | Pooped Outside · Accident | Feed Meal Now (*suggested g*): opens the form on Meal |
| Soon (amber) | 20 min before | 30 min before | 15 min before breakfast, 30 min before other meals |

A one-tap log is timed at the tap and stored under your name. A second log of the same type for the same dog within 5 seconds (a double tap, or Save pressed twice) is ignored ("Already logged").

### How the guesses work

Everything is learned from the dog's own logs; recent days count more than old ones.

- **Pee**: the usual daytime gap between two pees (gaps of 45 min to 8 h on the same day), read at the 70th percentile so short "just in case" walks don't shorten it. Kept between 30 min and 6 h. Before there is enough history: 1 hour per month of age, from 1 h to 4 h.
- **Poop**: the median gap between poops (1.5 h to 24 h), kept between 3 h and 24 h; 6 h before there is history. The first poop of the day is expected a learned delay after the first morning pee.
- **After a meal**: puppies under 3.5 months always get a post-meal potty reminder. From 3.5 months they get it only if their logs show they usually go soon after eating (at least 40 % of meals, 50 % from 5 months); with fewer than 3 meals logged, the reminder stays on until 5 months. The card then also shows a "Baseline" line: the time without the meal. A dog that peed (or pooped) in the 30 min before eating gets no pee (or poop) reminder.
- **Stool**: diarrhoea or soft stool (or a note saying liquid/diarrhoea) switches the poop card to hourly checks for 12 h, night included. A hard stool pauses the poop card (badge calm) for 8 h or more.
- **Meals**: meals per day and the daily gram goal come from the dog's profile. Breakfast is the learned breakfast time (07:30 until 3 meals are logged), but not earlier than 15 min after the first morning pee. The next meals are spread over the hours left before bedtime, at least 2.5 h apart.
- **Goal reached**: at 90 % of the gram goal (or, for a dog without a gram goal, once all meals are logged), the card says "Daily goal reached" and points to tomorrow's breakfast. If all meals are logged but grams are short, a "Remaining portion" reminder appears; it never turns red.
- **Suggested grams**: what is left of today's goal divided by the meals left. Once the goal is reached, the button shows no grams.
- A log dated more than one minute in the future is ignored by the guesses and by today's meal total (today's pee and poop counts still include it).

### Night mode and the 04:00 day

- Bedtime and wake-up time are learned from the last 14 days (the last log of the evening, the first log after 05:00). Until there are 5 logs: 22:00 and 07:00.
- Between bedtime and wake-up the cards point to the **morning outing** and never turn red (the pee card turns amber in the last 20 min), except for a pre-bed outing still on the card (below) or the hourly stool checks (above). A puppy under 2.5 months also gets one mid-night pee break, 4 h after its last pee.
- Logging something after 04:00 (or after wake-up time minus 3 h, whichever is later) ends night mode early.
- A pee due before bedtime + half the usual gap stays on the card as tonight's pre-bed outing until that time; a poop until bedtime + 1 h. Later than that, the card moves to the morning. A missed meal stays on the card until bedtime + 1 h.
- **A day runs from 04:00 to 04:00**, everywhere in the app: a pee at 01:30 counts for the evening before, in the cards, the totals and the history.

### Health summary

Below the cards: last weigh-in, estimated current weight and adult weight range; the learned daily routine (bedtime, wake-up, meal times and portions); the vaccine due first among those no later shot renewed, and the latest deworming, each with its name, next date, status and, until it is overdue, an "Add to calendar" button (a dash, no status and no button when it has no next date). "View full health passport" opens the passport.

The cards refresh every minute, and the data reloads each time you come back to the app.

## Logging an event

The **+** button (top bar) opens the form on Pee; the meal, weigh and medication buttons open it on their type. The form keeps what you typed until you save or cancel.

| Field | Rule |
|---|---|
| Type | Pee, Poop, Meal, Weight, Medication |
| Place (pee, poop) | Outside (default) or Accident indoors |
| Consistency (poop) | Hard, Normal (default), Diarrhoea |
| Grams (meal) | Required and above 0: a 0 g meal is refused. Exception: a dog with **no gram goal** may save a meal with the box empty (no grams stored). Starts with the suggested grams, empty once today's goal is reached. |
| Weight | Required, 0.3 to 100 kg. The box starts empty, with "Last weigh-in: X kg on date" under it, and a warning when the value is more than double or less than half of it (a misplaced comma). |
| Medication | Name required |
| Decimals | Comma or dot (`10,4` or `10.4`) |
| Date and time | Required, now by default. Past dates are fine (weights are often entered late); more than 5 minutes in the future is refused. |
| Notes | Optional; emptying a note in an edit deletes it |
| Logged by | Read-only line: you for a new log, the original author for an edit. The server sets it from your login; nobody can log under someone else's name. |

The form checks everything before it closes, and closes only once the log is saved. If the save fails (or the phone is offline), the form stays open with what was typed and says "Not saved, try again", with a red message saying why.

Your logs are stored under your **badge** (Settings > Household Members) linked to your login. If you have none yet, your first log creates one for you.

## History

- The feed shows the last **7 days**, one collapsed card per day (04:00 to 04:00) with the meals, pees, poops and accidents of that day. "Expand all" opens them.
- "Load more" goes to 14, 30, 90, 180 days, then everything.
- Today's meal total is compared to today's goal. Past days show plain totals ("240 g · 3 meals"), since past goals are not stored.
- Each log can be edited (same rules as the form) or deleted. The badge colour shows who logged it.
- A one-tap log that could not be saved stays, marked "Not saved", with **Retry** (sends it again, never twice) and **Discard** instead of edit and delete; its day stays open.
- **Export**: CSV or a printable report of exactly the days shown. The report prints its period ("From … to …"). The CSV has separate date and time columns and opens with accents intact in Excel and Numbers. Its date is the app's 04:00 day, so a log at 01:30 carries the previous day's date.

## Health passport

Open it from the health summary, or at `/health-passport`.

**Weight timeline.** Every weigh-in is its own entry, home or vet, nothing merged; each one can be edited or deleted. "Log Weight" opens the log form on Weight. Weigh-ins entered with a vaccine or deworming carry a vet badge. The chart compares them with a growth curve for the breed and size, and estimates the adult weight: the breed's standard weight (by sex), or the weight you typed for Other / Mixed / Unknown breeds, blended with the dog's own weigh-ins (the more weigh-ins, the more they count).

**Vaccines.** The add form starts on the last vaccine given (or CHPPi + L4), today's date and the last clinic used, and suggests the next booster from the dog's **age on the injection day** (French practice):

| Vaccine | Suggested next date |
|---|---|
| CHPPi family, dose before 16 weeks | +1 month |
| CHPPi family, dose from 16 weeks to before 6 months | the dog's 1st birthday |
| CHPPi + L4, dose at 6 months or later | +1 year |
| CHPPi without L4, or parvo only, at 6 months or later | +1 year; +3 years from 16 months of age |
| Rabies, L4, kennel cough, piroplasmosis, leishmaniasis | +1 year |

**Dewormings.** Credelio Plus is pre-selected. Monthly products (Credelio Plus, Nexgard Spectra, Simparica Trio, Advocate, Stronghold) suggest +1 month; Bravecto +3 months. Age-based wormers (Milbemax, Drontal, Panacur...) use the age **on the dose day**: every 2 weeks under 12 weeks, monthly until 6 months, then every 3 months.

**Rules for both:**
- Each entry can be edited or deleted.
- Dates: not after today; the next date not before the given date. Months land on the same day, capped at the end of the month (31 Jan + 1 month = 28 Feb).
- An optional weight box saves a separate weigh-in (12:00 Paris time on that date, or now if noon is still ahead).
- Editing keeps the stored next date (often set by the vet). If you change the date or the product, the form offers "Suggested: date", one tap to apply.
- Status: up to date; due soon (14 days, the due day included); overdue (from the next day); or **Completed** ("Effectué") once a later dose of the same vaccine, or of a vaccine that contains it, is logged (an L4 booster also completes CHPPi + L4). A different vaccine given the same day never completes it. Any later deworming completes a deworming. An entry with no next date shows a dash and no status.
- **Add to calendar** (the calendar button next to the next date, also on the health summary): downloads a calendar file (.ics) with one all-day event on that date, "Rex: Credelio Plus due" ("Rex : Credelio Plus à faire"), the date given and the clinic, and reminders at 09:00 the day before and on the day. Added again, most calendars keep one event per entry and date. No button without a next date, once Completed, or once overdue (its reminders would be in the past). Not yet tried on a phone: Safari on iPhone is reported to open "Add to Calendar"; in the home-screen app, a download is reported to open a screen with no way back (close the app and reopen it), so prefer Safari, which needs its own sign-in. Elsewhere, open the downloaded file; if no calendar app takes it, import it at calendar.google.com on a computer.

**Medication.** The medication logs, with add and delete buttons.

**Export.** A printable passport (vaccines, dewormings, weigh-ins; print it to PDF) or the same as CSV, in the app's language. Medication logs are not exported.

## Settings

**Dog Profiles.** Name, breed (English and French names; "Other" with a custom name), sex, birth date (required, not in the future), daily gram goal (10 to 2000 g, or tick "No gram goal" to count meals only), meals per day (1 to 6; for a new dog, set from its age: 4 under 3 months, 3 under 6 months, then 2), notes. The expected adult weight box appears only for Other, Mixed and Unknown breeds. Any family member can add or edit a dog; only the owner can delete one.

**Household Members.** Each person has a badge (name and colour) that colours their logs. Anyone in the family can add a badge.
- Names and linked emails are unique within a family.
- Your badge is the one carrying your email; failing that, a badge without an email whose name is exactly your Google account name. It shows the "Active" chip and has no delete button.
- **This is me**: tick it on a badge without an email to link it to your login (when no badge carries your email yet).
- Only the owner (or an admin) renames a badge linked to someone else, or unlinks a badge. Only the owner deletes badges.
- **Invite** (owner): pre-approve an email. It joins your family with a badge already linked to it. If that person already has an account in another family, the app asks before moving them.

**Super-Admin Panel** (owner only): every account, pending ones first. Approve (the person stays in their own household unless you pick another, which asks first), move to another household, revoke (back to pending), delete, or pre-approve an email into a chosen household.

## Phone install, offline and updates

- **Install**: open the site in the phone's browser and use "Add to Home Screen". It opens full screen like an app.
- **Offline**: the app still opens and shows the last data it loaded (dogs, badges, recent logs), with "Offline, data from HH:mm" (the time of that load) on the dashboard; vaccines, dewormings and older weigh-ins need a connection. Logging needs a connection, and there is no offline queue: a one-tap log made offline stays in the history marked "Not saved" for Retry, and a log typed in the form stays in the form. Failed changes say so in the app's language ("No connection, nothing was saved" when offline).
- **Updates**: after a new version is published, the next time the app is opened it downloads it in the background. It never reloads while you are using it: it switches to the new version (one reload) once you leave the app, so the next time you look, it is up to date.
- **Languages**: English and French. A new phone gets French when it is set to French; the EN/FR button in the top bar switches, and the choice is remembered. The cards' explanations are translated too.

---

# Part 2: developers

Read [`AGENTS.md`](AGENTS.md) for the coding rules (types, Zod, React style, data-model and export rules).

## Architecture

```
Browser (React SPA, PWA)  ──/api/*──▶  Vercel functions (api/*.ts)  ──HTTP──▶  Neon Postgres (Drizzle, neon-http)
 src/App.tsx, views, hooks              every handler: verifyAuth, then
 src/utils/predictions.ts (engine)      queries scoped to auth.householdId
```

- **SPA**: three routes, `/`, `/health-passport`, `/settings` (history API). Passport, settings, sign-in and the log form are lazy chunks; the log form chunk is prefetched 2 s after the dashboard is ready.
- **Predictions run in the browser** (`src/utils/predictions.ts`), from the logs loaded on the device. The server only stores and returns rows.
- **BFF**: `GET /api/dashboard?puppyId=&days=` returns, in one Neon batch: the household's dogs and badges, the dog's logs of the last `days` (default 14, max 90, at most 300 rows), the household's health records, and **every** weight event of the dog (weigh-ins are weeks apart). The app calls it at boot and on every return to the foreground. Switching dogs loads that dog's logs from `/api/activities`; the passport and the health summary share its health records (the passport calls `/api/health-records?puppyId=` only while `/api/dashboard` fails).
- Other endpoints: `api/activities.ts`, `api/dogs.ts`, `api/health-records.ts`, `api/households.ts` (badges), `api/users.ts` (accounts), `api/auth/session.ts`.
- `vercel.json`: `npm ci` install, SPA rewrite (except `/api/` and files), `/privacy` and `/terms` static pages, long cache on `/assets/`.
- Vercel Web Analytics and Speed Insights are on; the URLs they send are reduced to the route.

## Auth and permissions

1. The sign-in screen loads Google Identity Services and gets a Google ID token.
2. `POST /api/auth/session` verifies it with Google's tokeninfo endpoint (audience = our client id, verified email), creates the `users` row on first sign-in (owner: active, in the main household; anyone else: `PENDING_APPROVAL` in a new household), and returns an **app session token** (HMAC-SHA256 JWT, 90 days). A pending account gets 403 and no token.
3. The client sends it as `Authorization: Bearer`. On every request, `verifyAuth` (`api/_auth.ts`) checks the signature and expiry, then **re-reads the user row** (except for the owner): a missing or non-active account gets 401, a database error stays a 500. Household and role come from the row, not the token (the owner's household comes from the token).
4. The client renews the token 3 s after each app start. A 401 (or 401/403 on renewal) clears it and shows the sign-in screen; a 5xx keeps the session.
5. Every endpoint also accepts a Google ID token directly (same check as step 2). The app relies on it in one case: when the session exchange fails for the owner, it keeps the Google ID token as the session, which Google expires after about an hour.

- **Owner** = the SuperAdmin, recognised by email only, never by a role claim. Only the owner deletes dogs and badges, sees the Super-Admin Panel, and moves accounts between households.
- Every other active account (role `Member`) logs, edits and deletes logs and health records, and adds or edits dogs and badges in its household, within the badge rules of `api/households.ts`.
- `loggedBy` is never taken from the request: `POST /api/activities` resolves it from the account's linked badge (`findLinkedCaretaker`), creating the badge on the first log; `PUT` never changes it.

## Data model

`src/db/schema.ts`; every table but `households` carries `household_id`; there are **no foreign keys**.

| Table | Holds |
|---|---|
| `users` | Google accounts: email (unique), name, role, status (`ACTIVE` / `PENDING_APPROVAL`), household |
| `households` | optional display names for household ids |
| `puppies` | dog profile: breed, birth date, sex, daily gram goal (0 = no gram goal), meals per day, expected adult weight (custom breeds) |
| `caretakers` | badges: name, colour, optional linked email |
| `activities` | one row per log: `type` (pee, poop, food, weight, medication; the API also accepts `walk`, which the app never sends), timestamp (timestamptz), `logged_by` (badge name), potty place, stool, grams, weight, medication name, notes |
| `health_records` | vaccinations and dewormings: name/product, date, next date, clinic, batch. `weight_at_time` is a legacy column the app no longer reads: weigh-ins are `activities` rows of type `weight`. |

APIs return timestamps as ISO strings. Inputs are validated with Zod (`src/utils/schemas.ts`). Schema changes go in `src/db/schema.ts` with a migration in `drizzle/`, and must carry existing production data over.

## Caching and freshness

| Layer | Rule |
|---|---|
| API responses | `Cache-Control: no-store` on every response (`setCorsHeaders`) |
| Service worker | precaches the app shell; `/api/*` is network-only |
| Client GET cache | 60 s in memory; cleared on every write and on each return to the app |
| In-flight dedupe | identical GETs started less than 2 s apart share one request, so the visibility/focus/pageshow burst of one return makes one `/api/dashboard` call |
| localStorage | dogs, badges, active dog, the active dog's recent logs (≤ 300), session and language: paints the first frame before the network answers |
| Writes | logs, badges and dog edits are optimistic, rolled back with a toast on failure; a one-tap log is kept instead, marked not saved, and Retry (on the row or in its toast) resends it under its `act-<uuid>` id (POST is idempotent on it); the log form keeps one id while open, so Save again after a lost answer stores it once. Toasts come from `errorKey` (`src/services/api.ts`): no answer is `offline`, the three badge refusals of `api/households.ts` send a `code` with their own message, anything else is `errorGeneric` ("Not saved, try again." for a kept log, which is not reverted). A dashboard answer that may predate a pending write only adds rows. |

## Local setup

Requirements: Node 24 (as CI), npm.

```bash
npm ci
cp .env.example .env.local   # then fill in the values below
npm test
```

| Variable | Used by | Purpose |
|---|---|---|
| `POSTGRES_URL` or `DATABASE_URL` | API, drizzle-kit, `db:inspect` (`DATABASE_URL`) | Postgres connection |
| `PREVIEW_POSTGRES_URL` | API, only when `VERCEL_ENV=preview` | the preview database |
| `SESSION_SECRET` or `AUTH_SECRET` | API | session signing key: a random value (e.g. `openssl rand -base64 32`), Sensitive, Production only (Preview and Development, if set, get other values). Without it, the key is derived from `POSTGRES_URL`. With it, a token signed with the derived key still works, and its renewal at the next app start is signed with `SESSION_SECRET`. That fallback goes 90 days after the secret went live (2027-01-20 if live by 2026-10-21); until then keep the production `POSTGRES_URL` value byte-identical (no password rotation, no variable re-created with another value), or devices not opened since are signed out. Never remove or change the secret, and never roll production back to a deployment built without it: every session renewed since would be refused. Keep a copy: Vercel cannot show a Sensitive value again. |
| `VITE_GOOGLE_CLIENT_ID` (or `GOOGLE_CLIENT_ID` on the server) | sign-in screen, API | Google OAuth client id |
| `SUPER_ADMIN_EMAIL` | API | the owner's email. The browser cannot read it and always uses the default in `src/utils/auth.ts`: set it only to that same value, or the API and the app disagree on who the owner is. |

`npm run dev` serves the front end with Vite and proxies `/api` to `http://localhost:3000`, where the functions must run (for example with the Vercel CLI, `vercel dev`). **Never point a local run at the production database**: create a Neon branch and use its URL, and check the database URL the functions actually get (a `vercel dev` run can also pull the project's Development variables). Google sign-in only works on origins registered in the OAuth client.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (API proxied to port 3000) |
| `npm run build` | `tsc -b` type check, then `vite build` (with the service worker) |
| `npm test` | Vitest, with `TZ=Europe/Paris` pinned: the engine's expectations are in Paris time |
| `npm run lint` | oxlint |
| `npm run preview` | serve the built app |
| `npm run db:inspect` | read-only report on the database in `DATABASE_URL`: table counts, dogs, a live prediction diagnostic, recent logs |
| `npm run db:generate` / `db:migrate` / `db:push` | drizzle-kit. Do not run `db:push` or `db:migrate` against production. |

## Testing

- **Golden snapshot** (`src/utils/__tests__/predictions_golden.test.ts`): replays fixed scenarios on a grid of Paris times and snapshots everything `calculatePredictions` returns. Any engine change shows up as a diff: review and explain every moved line, then update with `TZ=Europe/Paris npx vitest run src/utils/__tests__/predictions_golden.test.ts -u`. A pure refactor leaves it unchanged.
- **Pure functions**: predictions, dates, health rules, weight, exports, schemas, form validation; date-dependent tests freeze the clock (`vi.setSystemTime`).
- **API handlers**: run against a mocked Neon/Drizzle, no network.
- **Components and hooks**: rendered in jsdom (`// @vitest-environment jsdom`) with `react-dom`, no Testing Library.
- Rule: every test exercises real code; no assertion against a local copy of production logic.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): on pushes to `main` and `feature/**`, pull requests to `main`, every Monday 06:00 UTC, and on demand. Node 24: `npm ci`, lint, build, test. The job id `ci` is the required check on `main`. When it fails on a Dependabot PR, a comment pings the owner.
- **Dependabot** (`.github/dependabot.yml`): weekly (Monday) for npm and GitHub Actions. HeroUI and its React Aria peers always move in one PR; other minor and patch updates are grouped; `@types/node` majors are ignored (it follows the Node 24 runtime).
- **Auto-merge** (`.github/workflows/dependabot-automerge.yml`): turns on GitHub's native auto-merge (squash), so a Dependabot PR merges only once `ci` is green. The repository variable `AUTOMERGE_MANUAL` lists package patterns that are never auto-merged (a group stays manual if one package matches); when it is set, every other update auto-merges, majors included; when it is unset, only minor and patch do.
- **Vercel** builds every branch but Dependabot's (`git.deploymentEnabled` in `vercel.json`: no build for an unreviewed dependency, and it saves the Hobby plan's 100 deployments a day): `main` goes to production, other branches get a preview deployment.
- **Preview database**: a preview deployment reads `PREVIEW_POSTGRES_URL` (a Neon `preview` branch copied from production), so tests on a preview can save without touching production data.
- **Demo seed** (`scripts/preview-seed.sql`): demo families, members, dogs, 30 days of logs and health passports, relative to the run time, plus a demo dog and an account waiting for approval in the owner's household. Run it in the Neon SQL editor on the `preview` branch (or `psql "$PREVIEW_POSTGRES_URL" -f scripts/preview-seed.sql`) at the start of a test session. It refuses to write on any other branch, and it can be re-run: it first deletes its own `seed-` rows. After a "reset from parent" of the preview branch, run it again.

## Known limitations

- **No offline queue**: logs need a connection. A one-tap log that fails stays marked "Not saved" until Retry or Discard, but only while the app stays open: closing it loses the log.
- **Predictions use the logs loaded on the device**: the last 14 days at start, although the engine looks back up to 30 days. Pressing "Load more" in the history therefore feeds more days to the guesses and can shift them slightly.
- **The day boundary is fixed at 04:00** (not learned), and on clock-change days it moves by an hour. A dog with an unusual night (e.g. awake at night) gets odd "morning" guesses.
- **Past goals are not stored**: past days in the history show totals only.
- **Medication list in the passport** shows the medication logs loaded in the history (14 days unless "Load more").
- **Deleting a dog** removes its profile only: its logs and health records stay in the database (no foreign keys or cascade).
- **Delete buttons for dogs and badges show for every member**; the server refuses the delete to anyone but the owner, and the item comes back with an error.
- **CSV exports are comma-separated**: Excel set to French may put every column in column A.
- **`drizzle/` lags `src/db/schema.ts`**: the index `idx_health_records_household_date` is in the schema and in production but in no migration, so the next `db:generate` emits it.
- **One owner per installation**: only the owner's account approves sign-ups, deletes dogs and badges, and moves accounts. The API knows an `Admin` role, but the app never assigns it (only the demo seed does).
