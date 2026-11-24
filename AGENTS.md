# AGENTS.md — PupPace

## Quick Context

PupPace — Smart Household Puppy Activity Tracker & Potty Predictor. React 19 + Vite + TypeScript + TailwindCSS + Drizzle ORM / Neon PostgreSQL. Strict TypeScript, Zod everywhere.

## Before Making Changes

1. `npx tsc -b` — must pass clean with 0 errors
2. `npm test` — Vitest suite, all tests must pass
3. Check `src/types/index.ts` before defining any type locally

## Critical Rules

### Agent Instruction Files Standard

- `AGENTS.md` is the canonical open standard for repository and workspace guidelines.
- When maintaining or updating project rules, edit `AGENTS.md`. Maintain `CLAUDE.md -> AGENTS.md` as a relative symlink (`ln -sf AGENTS.md CLAUDE.md`) for backward compatibility with Anthropic CLI.

### Database & Drizzle ORM Timestamp Alignment

- Every API function connects through `getDatabaseUrl()` (`api/_db.ts`): a Vercel **preview** deployment uses the Neon `preview` branch (`PREVIEW_POSTGRES_URL`, set for the Preview environment only; without it a preview gets no database, never `POSTGRES_URL`); production and development never read it. Sessions are signed with `SESSION_SECRET` (or `AUTH_SECRET`), else with a key hashed from `POSTGRES_URL`; with a secret set, a token signed with that hashed key is still accepted and renewed with the secret (`verifyAppSessionToken`; remove the fallback 90 days after the secret went live in production, 2027-01-20 if live by 2026-10-21, and keep the production `POSTGRES_URL` value byte-identical until then). Neither key reads `PREVIEW_POSTGRES_URL`, so sessions do not depend on it.
- Database timestamp columns use `timestamp('col', { withTimezone: true, mode: 'date' })` in `src/db/schema.ts`.
- Schema changes are hand-written SQL run by hand: a numbered file in `migrations/` (`NNNN_short_name.sql`, idempotent where possible, rollback and "Applied to preview / production" lines in its header; procedure in `migrations/README.md`), plus `src/db/schema.ts` in the same pull request. No drizzle-kit, nothing applies them automatically. Code that needs a new column merges only once its file is applied to production. `0000_baseline.sql` documents the schema as of 2026-10-15 and is never run on an existing database; `src/db/__tests__/migrations.test.ts` checks the files build every column and index of `schema.ts`.
- A dog with `puppies.deleted_at` set is deleted (`DELETE /api/dogs`): every read and edit of `puppies` skips it (`api/dogs.ts`, whose `PUT` and `POST` upsert answer 404 for it, `api/dashboard.ts`, the dog check of `POST /api/activities` and `POST /api/health-records`, which answer 404), its logs and health records stay, and only the owner and the household's `Admin` get it (`deletedPuppies` in `/api/dashboard`) and restore it (`PUT /api/dogs?id=…&restore=true`). A new query on `puppies` must skip it too.
- Deleting and restoring a dog and deleting a badge are for the owner (by email) and the household's `Admin` (the role `verifyAuth` reads from the `users` row), never a Member: `canDeleteHouseholdData` (`api/_auth.ts`). Each stays scoped to the caller's household. Settings shows those delete buttons only to a session whose role is `SuperAdmin` or `Admin`.
- Server API handlers (`api/activities.ts`) format Date objects into standard **ISO 8601 strings** (`.toISOString()`) before returning `res.json()`.
- NEVER return raw PostgreSQL space-separated driver strings (`'2026-01-15 08:00:00+00'`) to client components; V8 engines reject raw PostgreSQL strings as `Invalid Date`.

### CSV Export & Printable Report Standards

- **UTF-8 BOM Prefix**: Always prepend `\uFEFF` to generated CSV content so Microsoft Excel and Apple Numbers parse Unicode / French accents (`é`, `è`, `ê`, `à`) without character corruption.
- **Uniform Quoting & Escaping**: Pass both headers and row cells through `escapeCsvField`. Always `.trim()` values before quoting.
- **Separate Date & Time Columns**: Never export combined locale timestamp strings (e.g. `"8/19/2026, 8:45:00 AM"`). Split into distinct ISO `Date` (`YYYY-MM-DD`) and 24h `Time` (`HH:mm`) columns to enable spreadsheet filtering, sorting, and charts.
- **Dedicated Columns for Mixed Records**: When exporting heterogeneous records into a single CSV (e.g. Health Passport vaccines, dewormings, weights), never overload columns (avoid `Clinic / Logged by`). Provide dedicated, unambiguous columns (`Veterinary clinic`, `Logged by`).
- **Activity Export = The Feed's Window**: CSV and print cover the days the feed shows (7 by default, more after "load more"), without the logs marked not saved; the print states "Du … au …" / "From … to …" and no daily goal (past goals are not stored).
- **Client-Side Print Reports**: Use lightweight, responsive HTML templates with `@page { size: A4; margin: … }` via `window.open()` + `window.print()` instead of heavy client PDF libraries. The health passport print is one A4 page (`printHealthPassportReport`): each section is capped (`PRINT_CAPS`), every cell holds one line and a note one line under its row; after a layout change, print the worst case (every section over its cap, every note 2000 characters) from Chrome and check it is still one page.
- **DOM Test Environment**: Tag DOM-dependent Vitest files with `// @vitest-environment jsdom`. Verify BOM presence via raw bytes `new Uint8Array(await blob.arrayBuffer())` (`0xEF, 0xBB, 0xBF`), as WHATWG `blob.text()` strips the BOM.

### User Identity & Security

- `loggedBy` is the signed-in user, resolved by `getCurrentCaretakerName` (`src/utils/caretakers.ts`): the badge carrying the user's email (`findLinkedCaretaker`), else a badge without an email whose name is exactly the account name (ignoring case), else the account name. The client (`useCaretakers.currentUser`) and `POST /api/activities` both use it; the server ignores the body's `loggedBy`, and `PUT` never changes it. Renaming a badge renames the household's logs stored under its old name, in the same `db.batch` (`PUT /api/households`); a new column storing a badge name joins that batch.
- An account with no linked badge gets one on its first log (owner decision 2026-10-15): `POST /api/activities` creates it in the account's household, linked to the lower-cased email and named like an invite badge (`buildInviteBadge`), stores that name as `loggedBy` and returns the log. Its id is derived from the household and email, so two first logs at once make one badge: the primary key is the only unique index on `caretakers` (there is no unique household + email constraint). When that id is a badge since unlinked from the email, the new badge gets a random id. When the saved `loggedBy` is a name no badge on the client carries, the client reloads the badges (`logActivity` in `App.tsx`); until that first log, the log form shows the account name.
- Households are named by the owner only, in the Admin panel (`PUT /api/households?all=true` creates the `households` row on the first name; `GET ?all=true` lists the named ones and every account's household, `name: null` until named, shown as "<Admin's name>'s household"). Only the owner sees these names, and an invitee sees the name of the household an invite is for. The owner's invite can create a household (`newHouseholdName` on `POST /api/users`): its row and an `Admin` invite into it are written in one `db.batch`, and the invitee's badge comes with their first log.
- The Members tab's active chip and delete guard use the same rule. A badge email is an identity: names and emails are unique per household, and only an admin links a badge to someone else's email, renames a badge linked to someone else, or unlinks a badge, a member's own included (else their next log creates a second badge) (`api/households.ts`). A member can link an unlinked badge to their own login ("This is me"). The owner's approval of a sign-up that stays alone in its own household makes it that family's Admin (owner decision 2026-10-15, `PUT /api/users`); an Admin approved or moved into another household becomes a Member there. The owner and an Admin invite from the Members tab (the owner also from the Admin panel, into any household or a new one); an Admin invites only Members, only into their own household (403 otherwise). Invites into the inviter's household, approvals and Admin panel moves into the owner's household create the badge with the invited email. Only the owner (SuperAdmin) moves an account between households, from the Admin panel; approving into another household asks first (client only; the server answers 409 when the account is no longer pending, a stale Admin panel row), and so does the Admin panel's household select on an active account.
- An invite never creates, activates or moves an account (security audit M1 and S1). `POST /api/users` stores a row in `invites` (email, household, role, `invited_by`: one per email and household, a repeat updates it), writes nothing for an email already in that household or for the owner's, ignores `status`, and always answers `201 { email }`, so it never tells whether an account exists. Each invite it writes deletes the invites older than 90 days. The invitee sees it at the top of the dashboard (`invites` in `/api/dashboard`, `InviteCard`) and answers with `api/invites.ts`: `POST {id}` joins (the account's household and role become the invite's; the invite and the old household's badges, invites and row are deleted, in one `db.batch`; 409 `inviteLeaveFirst` while that household has another account or any dog, deleted ones included), `DELETE ?id=` declines. Another email's invite answers 404, and the owner never joins (403). After a join the client clears the household data kept on the phone (`clearStoredHouseholdData`, `clearApiCache`), reads its session again for the new role and loads the new household. A first Google sign-in with an invite creates the account `ACTIVE`, the `Admin` of a new household of its own (`verifyAuth`); a `PENDING_APPROVAL` account with an invite is activated the same way at its next sign-in, never a `REVOKED` one.
- Account `status`: `ACTIVE`, `PENDING_APPROVAL` (a sign-up waiting for approval) or `REVOKED` (the owner's Revoke). Only the owner sets or clears `REVOKED`, and only the owner changes `status` through `PUT /api/users` (an Admin's request gets 403); an invite never reactivates a `REVOKED` account (it changes no account, and sign-in keeps refusing a revoked one, invite or not). `verifyAuth` refuses a non-active account at sign-in (403) and on every request (401) with a `code`, `revoked` or `pending`: the lock screen says the access was removed for `revoked` and never stores it as a pending sign-in (`puppace_pending_email`). The Admin panel lists revoked accounts under "Revoked accounts" (only when there are some) with "Restore access" (`ACTIVE`, same household and role).
- Every account deletion (its own from Settings > Members, the owner's, an Admin's) runs `deleteAccount` (`api/users.ts`) in one `db.batch`: the users row, the invites addressed to its email and the household's badges carrying it; when no other account remains in the household, also all of its `puppies` (deleted ones too), `activities`, `health_records`, `caretakers`, `invites` and its `households` row. Anyone but the owner deletes their own account (`DELETE /api/users` with their own email; the account is read from the session); the owner's account is never deleted (403). After a self-delete the client clears the session and the household data cached on the phone (`clearStoredHouseholdData`), and the lock screen turns Google's auto-select off, so the deleted account is not signed straight back in as a new sign-up. A new table holding household data joins that batch.
- QuickLogModal shows `loggedBy` as a read-only line, "Logged by <name>" ("Enregistré par <name>"): the signed-in user for a new log, the original author in an edit. There is no input for it, so users cannot log events under another family member's name.
- Security headers live in `vercel.json` (`src/utils/__tests__/security_headers.test.ts` checks them). CSP is Report-Only until checked on production; then switch the header name (`Content-Security-Policy-Report-Only` to `Content-Security-Policy`, in the test too). The service worker serves page loads from its precache, with the headers each page was cached with: a commit that changes these headers (the switch, a rollback, a new origin) must also change `index.html` (a comment will do), or installed apps keep the old ones (`/privacy` and `/terms` keep them until they change). Check on an installed app after a reload, not only in a fresh tab. No inline `<script>` or `on*=` handler in any page, print windows included (an about:blank window inherits the app's CSP); a new external URL needs its origin in the policy.
- Every endpoint that adds rows, a new one included, checks a household limit before its insert: one `db.$count` scoped to `auth.householdId` against `HOUSEHOLD_LIMITS` (`src/utils/schemas.ts`), answering `sendLimitReached` (429 `{ code: 'limitReached' }`) and writing nothing.
- The per-IP rate limit lives in Vercel, not in code: Firewall rule "API rate limit" (paths starting `/api/`, 120 requests per 60 s per IP, fixed window, 429); `vercel firewall rules list --project <id>` shows it, and Hobby includes 1M rate-limited requests a month.

- `public/privacy.html` is the full GDPR policy, in English then French (`#fr`); the in-app `PrivacyPolicyModal` is its summary and links to it. It states facts checked on 2026-11-22: data in Frankfurt (Vercel `fra1`, Neon `aws-eu-central-1`), Neon restore history 6 h, Vercel Hobby runtime logs 1 h, no cookie set by the app's code, Vercel Web Analytics and Speed Insights. A change to what is stored, a provider, a region or a retention updates both halves in the same pull request. The page shows no email address (owner decision 2026-11-22): requests go through its form (a plain HTML form, one per language, posting to `POST /api/privacy-requests`, no sign-in; a hidden `website` trap field and at most `HOURLY_REQUEST_CAP` requests an hour), stored in `privacy_requests` and answered by the owner from the Admin panel ("Mark as answered"); a request answered over a year ago is deleted when the owner opens that list. Only the owner reads them (`GET` and `PUT`).

### Health Passport & Protocols

- Veterinary protocols and product schedules are data-driven from `src/data/healthProtocols.json`.
- One word per kind of antiparasitic, from its product's `category` (owner, 2026-11-22): `t.health.treatments` ("Vermifuge", "Antipuces et antitiques", "Tout-en-un", "Vermifuge et antipuces") on the "À faire" line, the passport tag and the print, `treatmentsInline` in sentences (the calendar title, "Prochaine prise (vermifuge)", the product list). The product list's lines are built from them and the schedule, in the app's language (`getAntiparasiticLabel`): the JSON holds no label. Advocate and Stronghold (`worms_fleas`) kill fleas but not ticks: they renew the worm dose only. A due line whose product covers more than is due opens its "Fait" form with no product picked.
- All-in-one monthly chewable tablets (Credelio Plus, Nexgard Spectra, Simparica Trio) auto-calculate +1 month due dates.
- Bravecto auto-calculates +12 weeks (`intervalWeeks`, its label's protection; 3 calendar months would be about 13). Age-based wormers (Milbemax/Milpro/Drontal) use the dog's age **on the dose day**: every 2 weeks under 12 weeks, monthly until 6 months, then quarterly.
- Vaccine boosters use the dog's age **on the injection day** (`calculateNextVaccineBooster(date, name, birthDate)`): a CHPPi-family dose before 16 weeks +1 month, a dose from 16 weeks to before 6 months the 1st birthday, a dose at 6 months or later (e.g. an early annual booster) the adult rule: CHPPi + L4 yearly and CHPPi sans L4 / Vanguard CPV every 3 years from 16 months. Other vaccines: `defaultBoosterMonths`.
- Months are added on calendar (UTC) dates, capped at the month end (31 Jan + 1 month = 28 Feb), so the clock change never shifts a date. The 6- and 16-month age thresholds are calendar months too (`addMonths(birthDate, 16)`), never average 30.4-day months.
- Dates: not after today, next date not before it (`getHealthRecordDateError`; the API allows tomorrow UTC and checks in the handler, since PUT parses `.partial()`). Edit forms keep the stored next date; once the date or product changes, they offer "Suggested: <date>" (one tap applies it).
- Older historical vaccine or deworming entries that have a later entry of the same vaccine, or of a vaccine that covers it, are renewed (`fulfilled`): the passport shows them as one grey history line (the latest 3, then "Historique (n)"), never an overdue alert. "À faire" (`getNextDue`, one `HealthDueList` on the passport and the dashboard card) lists every other entry with a next date, overdue first. On screen a protocol vaccine shows its display-only `shortName` ("CHPPi + L4"; `shortNameEn` in English; `formerNames` lists earlier protocol names still stored, matched exactly); the stored `name` stays the renewal key (an "Autre…" entry stores the name typed), the picker and edit forms keep the full brand list, and the print shows the short name with the vet's sticker (a vaccine's `productName` is the product typed from it: shown, printed and exported, never the renewal key or the calendar title). "Same vaccine" = the record `name` resolved to its `healthProtocols.json` vaccine (`type` only says vaccination/deworming); coverage is `VACCINE_COVERS` in `src/utils/health.ts` (CHPPi + L4 covers CHPPi sans L4, L4 and Vanguard CPV; CHPPi sans L4 covers Vanguard CPV); `VACCINE_RENEWED_BY` adds the part that sets a combo's booster date (an L4-only booster renews CHPPi + L4, the usual adult schedule); a deworming is renewed only once later doses cover all it protects from (`getOpenProtections`: each product's `category` in `healthProtocols.json`, worms and/or fleas and ticks), so a wormer (Milpro) and a flea and tick product (Bravecto) given apart keep one "À faire" line each, labelled with what is due ("Vermifuge · Milpro"), and an all-in-one (Credelio Plus) stays due for worms after a Bravecto until a wormer follows (owner, 2026-11-22); an "Autre…" product only by a later dose of the same name, and it renews no other. A same-day entry of another vaccine (e.g. Rage with CHPPi) never renews it.

### Types & Validation

- Canonical types live in `src/types/index.ts` (`Activity`, `PuppyProfile`, `Caretaker`, `UserAccount`, `PredictionResult`, `HealthRecord`) — import from there, never redefine locally.
- Server-side input validation via Zod schemas (`src/utils/schemas.ts`).
- Client-side API calls go through `src/services/api.ts` — typed helpers with SWR caching.

### React & Code Style

- `useEffect` ONLY for: DOM event subscriptions, timers, initial data fetch, or synchronizing external calculated states.
- NEVER `useEffect` for: derived state or event side effects that belong in event handlers.
- Declaration order: `useState` → hooks → variables → `useMemo` → `useCallback` → `useEffect`.
- No abbreviated parameter names: `(event)` not `(e)`, `(item)` not `(i)`, `(puppy)` not `(p)`, `(activity)` not `(a)`.

### UI & Aesthetics

- Modern, rich design aesthetics (HSL gradients, glassmorphism, micro-animations), dark only: `index.html` sets `class="dark" data-theme="dark"` (HeroUI's dark theme) and `color-scheme: dark`; there is no light mode. HeroUI's colour tokens are mapped once, in the `.dark` block of `src/index.css`: indigo-600 is the one primary (a HeroUI `variant="primary"` Button needs no `bg-indigo-*`), red the one danger. The same file outlines every HeroUI card (`.card`: a border and no padding of its own, so its content pads itself), gives buttons 12 px corners and makes inputs full width.
- Scalable dropdowns for multi-language selection (`en`, `fr`).
- Clean English technical URL routing (`/`, `/health-passport`, `/settings`).

### Testing & Verification

- Every test must exercise real code — zero placeholder assertions.
- Multi-day 30-day realistic dataset test suite (`src/utils/__tests__/realistic_dataset.test.ts`, `predictions.test.ts`, `night_mode_and_age_transitions.test.ts`, and `weight_growth_engine.test.ts`) verifies predictions, sleep bounds, age-graduated gastrocolic reflex maturation, and protocols.

### Predictive Engine & Statistical Standards

- **10-Day Time-Constant Decay**: `calculateLearnedIntervalMinutes` uses a 10-day exponential time constant ($e^{-\Delta t / 10\text{d}}$, half-life about 7 days) to steadily reflect puppy maturation without getting distorted by short 3–4 day vacation disruptions or weekend trips.
- **Capacity-Aware Pee Estimation (70th Percentile)**: Potty logs are right-censored by human walking opportunities. For Daytime Pee intervals, the engine estimates the 70th percentile of daytime intervals to filter out short opportunistic walks and capture true biological retention capacity. The learned interval stays between 30 min and (age in months + 1) h, never above 8 h (`PEE_INTERVAL_CEILING_HOURS`, a healthy adult's daytime maximum; overnight holding is night mode's job, with no such cap).
- **Continuous 24/7 Poop Transit (50th Percentile / Median)**: Defecation is bolus-driven; the engine maintains the median to track true gastrointestinal transit time without delaying alerts.
- **Learned Meal Times, by Rank**: a meal's number is its order in the day, on the meal card and in learning. `detectMealSchedule` learns one usual time per meal of the day (`targetMeals` entries, `mealSchedule` on the predictions and the Daily schedule card), never from clock windows: the weighted median of each meal's time over the finished days (today once complete) with exactly `targetMeals` meals. Days with another count are not read, so a missed log or an extra meal never moves a usual time. With no such day, or when the days usually have more meals (the meals per day were just cut, 4 to 3 to 2 as a puppy grows): the first and last meals from the days with 2 or more meals, else wake-up and 2.5 h before bedtime (vets: 2-3 h); the meals between sit evenly. Meal k+1 is due at its usual time; after a late meal, at the usual gap shortened by the share of the time left until bedtime (`predictNextFood`). Food types are not read: no log stores one (2026-11-09). When split meals or treats result in `todayMeals.length >= targetMeals` before the 90% daily gram goal is met, format as `Remaining portion (spaced ~X.Xh)`, shown as the app's duration (`translatePredictionReason`): `Remaining portion (spaced ~2h 30m)`, in French `Portion restante (espacée de ~X h XX)`, e.g. `~2 h 30`.
- **Interval-Driven Potty & Night Mode (`shouldPreservePreBedPotty`)**: Pee and poop predictions start from learned intervals ($T_{\text{last}} + \text{interval}$). When the standard expectation lands in deep night hours ($> \text{bedtime} + \text{interval}/2$), predictions roll over to the morning wakeup; the pee card of a puppy under 2.5 months rolls over to one break a night, 4 h after its last pee, when that is before 05:00 and 45 min or more before wakeup (kept 30 min as due now, until 05:00 at the latest, never red); once a pee is logged at or after the night's break (`findNightBreakIndex`: the first pee or poop from 22:00 to 05:00 3 h 40 to 4 h 30 after the previous pee, the card's break window; on a day the dog was under 2.5 months `detectSleepSchedule` does not take it or the logs after it as the bedtime; not at 4 months: older puppies' late walks fall in that window and the learned bedtime locks hours early), the morning wakeup. If it expires before that ($\le \text{bedtime} + \text{interval}/2$), tonight's pre-bed outing is preserved: for pee until $\text{bedtime} + \min(\text{interval}/2, 90\text{m})$ (half a long interval would keep an overdue card until about bedtime + 4 h), for poop only until $\text{bedtime} + 60\text{m}$ (half its ~11 h interval would keep an overdue card until about 04:00). The 90 m cap is for the pre-bed card only: a post-meal pee reminder after bedtime keeps the uncapped window, until $\text{bedtime} + \text{interval}/2$ (`isPostMealReminder` in `predictNextPee`).

### Canine Weight Prediction & WALTHAM Growth Engine Standards

- **WALTHAM™ 5-Category Growth Curves (*Salt et al., PLOS ONE 2017*)**: Categorizes canine development into 5 adult size tiers (I: <6.5kg, II: 6.5–9kg, III: 9–16kg, IV: 16–30kg, V: 30–45kg) interpolated with a monotone cubic (PCHIP) across clinical anchors, so the implied daily gain never stops at an anchor.
- **Timestamp-Synchronized Regression**: Evaluates each weigh-in log at the puppy's exact age on the day of the log ($t_{\text{log}} = (\text{timestamp}_{\text{log}} - \text{birthDate}) / 7\text{d}$), eliminating prediction decay when days or weeks elapse between weigh-ins. Weigh-ins before 4 weeks stay out of the adult projection (the curve says nothing there); with none left, the breed baseline.
- **Multi-Point Exponential Time-Weighting**: Weights historical logs with a 30-day exponential time constant ($w_i = e^{-\Delta t / 30\text{d}}$, half-life about 21 days), dynamically blending 15–35% breed baseline with 65–85% empirical trajectory depending on data density ($\ge 6$ logs achieves 85% empirical weight).
- **Measured Pace, No Model Velocity**: No model daily gain is computed. The screens show the measured pace (`getMeasuredPace`, least squares over the 28 days up to the last weigh-in, reaching back to the latest weigh-in 7 or more days before the last when those span less than a week), and today's estimate moves along the dog's own track (last × f(today) / f(last)).
- **One Weight Timeline**: Every weigh-in is its own weight event (`activities` row, `type='weight'`), a vet visit's included, and nothing is merged (`getUnifiedWeightEntries`). No vet/home distinction anywhere (owner decision 2026-10-16). The vaccine and deworming add forms save an optional weight as a weight event (12:00 Paris on the record date, or now if that is still ahead; a record dated after today with a weight is refused; no note), never in `health_records.weight_at_time` (legacy: the API drops it from any request, `migrations/0002` empties the weights a weight event holds). Weight boxes start empty with a "Last weigh-in" hint and never offer the profile weight or the model estimate.

### Safe Database Inspection

- Safe DB Inspection Script: `npm run db:inspect` (or `npx tsx scripts/inspect_db.ts`) — inspects tables, row counts, puppy profiles, live prediction engine diagnostics, and recent activity trail with location, stool consistency, food grams, caretakers, and notes.

### Preview Data

- Vercel preview deployments read the Neon `preview` branch, a child of production `main`. Never write to `main`.
- Refresh it from production: Neon console > Branches > `preview` > Reset from parent (or `neon branches reset preview --parent`, adding `--project-id` when the CLI has no linked project). It replaces everything on `preview` with production's real data: run the seed right after, since it anonymises that copy first.
- Anonymised: the seed first turns every real name, email and free text on `preview` into fictional ones (Membre 1, membre-1@example.com, Badge 1, Note anonymisée, Clinique vétérinaire; other households' names and dogs too), renaming each log's author with its badge. Only the owner's own account and badge (the account whose role is `SuperAdmin`) and his household's dogs keep their names; privacy requests get `demande-n@example.com`, invites `invite-n@example.com`. The privacy policy relies on this: it does not mention the test copy.
- Demo data: `scripts/preview-seed.sql`, one `DO $$ ... $$` block. Run it in the Neon SQL editor with `preview` selected, or `psql "$PREVIEW_POSTGRES_URL" -f scripts/preview-seed.sql`. It adds a puppy (Pistache) and an account waiting for approval to the real household, plus 'Famille Martin (demo)' (2 dogs, an Admin, members, an unlinked badge, an account without a badge) and 'Famille Dupont (demo)', with `v_days` (default 30) days of logs and health passports, relative to now (Europe/Paris). Logs stop at the run time: re-run the seed at the start of each test session.
- Rerunnable: every seed id starts with `seed-`; the block first deletes the seed and what the app attached to seeded households or dogs, and never touches other rows.
- Guard: the block raises before any write unless `md5(neon.branch_id)` is the `preview` branch's (fails closed: production, other branches, non-Neon hosts). A reset from parent keeps the branch id; a recreated `preview` branch needs the new hash in the guard. Keep it.

### Neon CLI

- Never run `neon link`, `neon checkout`, `neon init` or `neon env pull` without the owner's OK: they overwrite `POSTGRES_URL` in `.env` / `.env.local`.
- Never run `neon mcp` or `neon init -y`: the Neon MCP is the owner's claude.ai connector, and these add a duplicate server with an API key in `~/.claude.json`.

### Dependencies

- `overrides` in `package.json` forces `undici` `^6.29.1` under `@vercel/node`, which pins 5.28.4 (3 security alerts, fixed in 6.29.1). The app imports only types from `@vercel/node` and Vercel builds the functions with its own runtime, so the forced version runs only in `vercel dev`. Remove the override once `@vercel/node` depends on `undici` 6.29.1 or later: kept longer, it would hold a newer `undici` back.

### Sync with TipsyTap

- PupPace and the owner's other app, TipsyTap (`Ouriel/drinks-counter`), share engineering only: CI/CD, workflows, rulesets, dependency strategy, testing, architecture patterns. Never features, product behaviour, data retention or UX: each app decides those with the owner.

## Key Files

| File                                  | Role                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/types/index.ts`                  | Canonical domain interfaces (`Activity`, `PuppyProfile`, `PredictionResult`)         |
| `src/db/schema.ts`                    | Single source of truth Drizzle ORM database tables                                    |
| `api/dashboard.ts`                    | Backend-for-Frontend (BFF) single-roundtrip boot endpoint (dogs + caretakers + recent acts + health records + every weight and medication event of the dog + the signed-in email's invites) |
| `src/data/healthProtocols.json`       | Dataset for vaccine types, antiparasitics (Credelio Plus, etc.), and ESCCAP rules     |
| `src/services/api.ts`                 | SWR-cached REST API client & fetch helpers                                            |
| `scripts/inspect_db.ts`               | Safe database inspection & live prediction engine diagnostics script                    |
| `src/i18n/en.ts` & `fr.ts`            | English & French localization dictionaries                                           |
| `src/utils/predictions.ts`            | Predictive engine (learned intervals, age-graduated gastrocolic reflex, sleep bounds)   |
| `src/views/SettingsView.tsx`          | Settings tabs: dogs (`PuppiesView`), members and badges (`HouseholdView`), accounts for the owner only (`AdminView`) |
| `src/views/CarnetDeSanteView.tsx`      | French & International veterinary health protocol passport                          |

### Global React Context for App-Wide State (i18n)

- App-wide state must be provided via a root React Context wrapped at `main.tsx`. Today that is `I18nProvider`, which holds the language only (no theme or active tenant).
- Never use local `useState(getStoredLanguage)` in individual components; this causes desynchronized state and fails to re-render sibling components upon language switch.

### API Caching, In-Flight Deduplication & BFF Boot Discipline

- **Single Boot Roundtrip with Single-Pipe Batching (`/api/dashboard`)**: The initial dashboard view loads via `GET /api/dashboard`, executing puppies, caretakers, recent activities, **health records, every weight and medication event of the dog (no date bound) and the invites addressed to the signed-in email** in one single `db.batch([ ... ])` HTTP pipeline to Neon. Cuts DB query execution time from 77ms down to 23ms (3.3x speedup).
- **Frame-1 LocalStorage Profile & Caretaker Cache**: Puppy metadata (name, breed, birthDate, avatar), the caretakers list, the shown dog's recent logs (written by each dashboard answer, then by each add, edit or delete the server took, which keeps the answer's `savedAt` and leaves out logs not saved: `storeAcceptedChange`) and the household's health records (`getStoredHealthRecords`, written by each dashboard answer and passport change) are cached in `localStorage`. On Frame 1 ($t = 0$), the real Navbar, dog header and "To do" lists render instantly without waiting for network responses.
- **PWA Service Worker Precaching**: `vite-plugin-pwa` precaches immutable hashed CSS/JS assets for `< 15ms` instant shell startup on iOS/Android. Network calls to `/api/*` are strictly `NetworkOnly` to guarantee 100% fresh potty and meal data across caretakers. Updates never reload a visible page (owner decision 2026-10-15): `registerType: 'prompt'` (no `skipWaiting`, so the old precache and its lazy chunks stay until the switch), and `src/registerServiceWorker.ts` activates the waiting worker and reloads when the page is hidden (at once if it already is). Logs not sent and an open `QuickLogModal` live only in the page, so they hold the update (`holdUpdate`, from `App.tsx` and the modal): it waits for the first hide once nothing holds it.
- **Deferred Session Extension**: `exchangeSessionToken()` runs 3 seconds after dashboard renders (via `setTimeout`), avoiding a 2nd concurrent Vercel function cold start during the critical boot path.
- **Skeleton Shell Loading State**: During initial data fetch, App.tsx renders the real Navbar (hydrated from cache) plus 3 card placeholder skeletons instead of a blank screen.
- **QuickLogModal Prefetch**: The QuickLogModal chunk is prefetched 2 seconds after mount via dynamic `import()`, eliminating the INP spike on first "+" button tap.
- `src/services/api.ts` maintains an `inflightRequests` map to de-duplicate simultaneous requests for identical URLs across mounting components.
- Every API response is `Cache-Control: no-store` (set once in `setCorsHeaders`). `clearApiCache()` keeps in-flight requests, so the `visibilitychange` + `focus` + `pageshow` burst of one return to the app makes one `/api/dashboard` call. A GET joins an in-flight request only if it is under 2 s old (`INFLIGHT_JOIN_MS`), so a request sent before the app went to the background, or one that hangs, is never reused. Keep both: `no-store` without that deduplication turns the burst into three function calls.
- Within the in-memory TTL window (60s), serve from cache directly without spawning redundant background `fetch()` requests on every tab switch.
- Clear cache synchronously on mutations (`createActivity`, `updateActivity`, `deleteActivity`, `createDog`, etc.), and clear the cache and in-flight GETs again when the mutation is answered: a GET sent or answered while it was in flight may miss it and is never reused.

### SQL-Side Date Filtering & Progressive Timeline Pagination

- Initial dashboard boot fetches a 14-day window (`days=14`, `limit 300`: `fetchDashboard`, `RECENT_LOGS_DAYS` in `useActivities.ts`), keeping network payloads light.
- Dynamic timeline expansion (`7d -> 14d -> 30d -> 90d -> 180d -> all-time`) must pass `days` to the backend so PostgreSQL executes indexed date bounds (`gte(timestamp, cutoffDate)` backed by `idx_activities_tenant_pup_time`). Never fetch all historical records over the wire when expanding a date window.

### Static Asset Compression & Responsive Mobile Localization

- All static images in `public/` must be compressed (PNGs quantized with adaptive filtering, JPGs encoded with mozjpeg, WebP generated) to keep image payloads $\le 35\text{ KB}$. Known exception: `public/icons/icon-512.png` is about 66 KB.
- Button labels and action text must remain concise in both English and French to avoid overflowing containers on narrow 320px–375px mobile viewports (e.g. `Charger les {days} derniers jours` instead of `Charger les journaux précédents (Les {days} derniers jours)`).

## Common Mistakes to Avoid

- Don't return raw space-separated PostgreSQL strings (`'2026-01-15 08:00:00+00'`) over API responses — serialize to ISO 8601 strings (`.toISOString()`)
- Don't add useEffect to react to state changes — put logic in the event handler that causes the change
- Don't execute inline DDL (`CREATE TABLE IF NOT EXISTS`) inside serverless handlers — schema changes belong in `src/db/schema.ts` and a numbered SQL file in `migrations/`
- Don't stack sequential `await` calls in data loaders — use `Promise.all` for parallel fetching
- Don't spawn background `fetch()` revalidations on every cache hit — use clean TTL and in-flight promise deduplication
- Don't fetch monolithic 365-day datasets on boot when the initial view only needs 7–30 days — filter via SQL `days` parameter
- Don't define types locally when they exist in `src/types/index.ts`
- Don't use `(e) =>` or `(p) =>` — spell out parameter names (`(event) =>`, `(puppy) =>`, `(activity) =>`)
- Don't run `sleep` commands or poll deployment CLI after `git push` — inform the user immediately
- Don't write tests that assert `null === null` or `true === true` — exercise real domain code
- Don't write or commit code when asked to research — present options and wait for explicit user choice first
- Don't add secondary `useEffect` fetches in dashboard components — fold data into the BFF `/api/dashboard` `Promise.all`
- Don't use per-request `getDb()` in API handlers — use module-level `neon()`/`drizzle()` for connection reuse across warm invocations

<!-- caveman-begin -->
Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan-lite|wenyan-full|wenyan-ultra
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
<!-- caveman-end -->
