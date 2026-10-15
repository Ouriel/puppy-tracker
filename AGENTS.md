# AGENTS.md — PupPace

## Quick Context

PupPace — Smart Household Puppy Activity Tracker & Potty Predictor. React 19 + Vite + TypeScript + TailwindCSS + Drizzle ORM / Neon PostgreSQL. Strict TypeScript, Zod everywhere.

## Before Making Changes

1. `npx tsc -b` — must pass clean with 0 errors
2. `npm test` — Vitest suite (194 tests across 22 files), all tests must pass
3. Check `src/types/index.ts` before defining any type locally

## Critical Rules

### Agent Instruction Files Standard

- `AGENTS.md` is the canonical open standard for repository and workspace guidelines.
- When maintaining or updating project rules, edit `AGENTS.md`. Maintain `CLAUDE.md -> AGENTS.md` as a relative symlink (`ln -sf AGENTS.md CLAUDE.md`) for backward compatibility with Anthropic CLI.

### Database & Drizzle ORM Timestamp Alignment

- Every API function connects through `getDatabaseUrl()` (`api/_db.ts`): a Vercel **preview** deployment uses the Neon `preview` branch (`PREVIEW_POSTGRES_URL`, set for the Preview environment only); production and development never read it. Sessions are signed with `SESSION_SECRET` (or `AUTH_SECRET`), else with a key hashed from `POSTGRES_URL`; with a secret set, a token signed with that hashed key is still accepted and renewed with the secret (`verifyAppSessionToken`; remove the fallback 90 days after the secret went live in production, 2027-01-20 if live by 2026-10-21, and keep the production `POSTGRES_URL` value byte-identical until then). Neither key reads `PREVIEW_POSTGRES_URL`, so sessions do not depend on it.
- Database timestamp columns use `timestamp('col', { withTimezone: true, mode: 'date' })` in `src/db/schema.ts`.
- Server API handlers (`api/activities.ts`) format Date objects into standard **ISO 8601 strings** (`.toISOString()`) before returning `res.json()`.
- NEVER return raw PostgreSQL space-separated driver strings (`'2026-07-28 05:52:00+00'`) to client components; V8 engines reject raw PostgreSQL strings as `Invalid Date`.

### CSV Export & Printable Report Standards

- **UTF-8 BOM Prefix**: Always prepend `\uFEFF` to generated CSV content so Microsoft Excel and Apple Numbers parse Unicode / French accents (`é`, `è`, `ê`, `à`) without character corruption.
- **Uniform Quoting & Escaping**: Pass both headers and row cells through `escapeCsvField`. Always `.trim()` values before quoting.
- **Separate Date & Time Columns**: Never export combined locale timestamp strings (e.g. `"8/19/2026, 8:45:00 AM"`). Split into distinct ISO `Date` (`YYYY-MM-DD`) and 24h `Time` (`HH:mm`) columns to enable spreadsheet filtering, sorting, and charts.
- **Dedicated Columns for Mixed Records**: When exporting heterogeneous records into a single CSV (e.g. Health Passport vaccines, dewormings, weights), never overload columns (avoid `Clinic / Logged By`). Provide dedicated, unambiguous columns (`Veterinary Clinic`, `Logged By`).
- **Activity Export = The Feed's Window**: CSV and print cover the days the feed shows (7 by default, more after "load more"); the print states "Du … au …" / "From … to …" and no daily goal (past goals are not stored).
- **Client-Side Print Reports**: Use lightweight, responsive HTML templates with `@page { size: A4; margin: 15mm; }` via `window.open()` + `window.print()` instead of heavy client PDF libraries.
- **DOM Test Environment**: Tag DOM-dependent Vitest files with `// @vitest-environment jsdom`. Verify BOM presence via raw bytes `new Uint8Array(await blob.arrayBuffer())` (`0xEF, 0xBB, 0xBF`), as WHATWG `blob.text()` strips the BOM.

### User Identity & Security

- `loggedBy` is the signed-in user, resolved by `getCurrentCaretakerName` (`src/utils/caretakers.ts`): the badge carrying the user's email (`findLinkedCaretaker`), else a badge without an email whose name is exactly the account name (ignoring case), else the account name. The client (`useCaretakers.currentUser`) and `POST /api/activities` both use it; the server ignores the body's `loggedBy`, and `PUT` never changes it.
- An account with no linked badge gets one on its first log (owner decision 2026-10-15): `POST /api/activities` creates it in the account's household, linked to the lower-cased email and named like an invite badge (`buildInviteBadge`), stores that name as `loggedBy` and returns the log. Its id is derived from the household and email, so two first logs at once make one badge: the primary key is the only unique index on `caretakers` (there is no unique household + email constraint). When that id is a badge since unlinked from the email, the new badge gets a random id. When the saved `loggedBy` is a name no badge on the client carries, the client reloads the badges (`logActivity` in `App.tsx`); until that first log, the log form shows the account name.
- The Members tab's active chip and delete guard use the same rule. A badge email is an identity: names and emails are unique per household, and only an admin links a badge to someone else's email, renames a badge linked to someone else, or unlinks a badge, a member's own included (else their next log creates a second badge) (`api/households.ts`). A member can link an unlinked badge to their own login ("This is me"). Invites, approvals and Admin panel moves into the owner's household create the badge with the invited email. Only the owner (SuperAdmin) moves an account between households: an invite of an account living elsewhere gets 409 and needs `confirmMove` (`api/users.ts`); approving into another household asks first (client only), and so does the Admin panel's household select on an active account.
- QuickLogModal shows `loggedBy` as a read-only line, "Logged by <name>" ("Enregistré par <name>"): the signed-in user for a new log, the original author in an edit. There is no input for it, so users cannot log events under another family member's name.

### Health Passport & Protocols

- Veterinary protocols and product schedules are data-driven from `src/data/healthProtocols.json`.
- All-in-one monthly chewable tablets (Credelio Plus, Nexgard Spectra, Simparica Trio) auto-calculate +1 month due dates.
- Bravecto auto-calculates +3 months (12 weeks). Age-based wormers (Milbemax/Drontal) use the dog's age **on the dose day**: every 2 weeks under 12 weeks, monthly until 6 months, then quarterly.
- Vaccine boosters use the dog's age **on the injection day** (`calculateNextVaccineBooster(date, name, birthDate)`): a CHPPi-family dose before 16 weeks +1 month, a dose from 16 weeks to before 6 months the 1st birthday, a dose at 6 months or later (e.g. an early annual booster) the adult rule: CHPPi + L4 yearly and CHPPi sans L4 / Vanguard CPV every 3 years from 16 months. Other vaccines: `defaultBoosterMonths`.
- Months are added on calendar (UTC) dates, capped at the month end (31 Jan + 1 month = 28 Feb), so the clock change never shifts a date.
- Dates: not after today, next date not before it (`getHealthRecordDateError`; the API allows tomorrow UTC and checks in the handler, since PUT parses `.partial()`). Edit forms keep the stored next date; once the date or product changes, they offer "Suggested: <date>" (one tap applies it).
- Older historical vaccine or deworming entries that have a later entry of the same vaccine, or of a vaccine that covers it, display **`✅ Renouvelé / Effectué`** (Fulfilled) instead of overdue alerts. "Same vaccine" = the record `name` resolved to its `healthProtocols.json` vaccine (`type` only says vaccination/deworming); coverage is `VACCINE_COVERS` in `src/utils/health.ts` (CHPPi + L4 covers CHPPi sans L4, L4 and Vanguard CPV; CHPPi sans L4 covers Vanguard CPV); `VACCINE_RENEWED_BY` adds the part that sets a combo's booster date (an L4-only booster renews CHPPi + L4, the usual adult schedule); any later deworming renews a deworming. A same-day entry of another vaccine (e.g. Rage with CHPPi) never renews it.

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

- Modern, rich design aesthetics (dark mode, HSL gradients, glassmorphism, micro-animations).
- Scalable dropdowns for multi-language selection (`en`, `fr`).
- Clean English technical URL routing (`/`, `/health-passport`, `/settings`, `/care-guide`, `/admin`).

### Testing & Verification

- Every test must exercise real code — zero placeholder assertions (244/244 tests passing across 25 test files).
- Multi-day 30-day realistic dataset test suite (`src/utils/__tests__/realistic_dataset.test.ts`, `predictions.test.ts`, `night_mode_and_age_transitions.test.ts`, and `weight_growth_engine.test.ts`) verifies predictions, sleep bounds, age-graduated gastrocolic reflex maturation, and protocols.

### Predictive Engine & Statistical Standards

- **10-Day Half-Life Decay**: `calculateLearnedIntervalMinutes` uses a 10-day exponential half-life ($e^{-\Delta t / 10\text{d}}$) to steadily reflect puppy maturation without getting distorted by short 3–4 day vacation disruptions or weekend trips.
- **Capacity-Aware Pee Estimation (70th Percentile)**: Potty logs are right-censored by human walking opportunities. For Daytime Pee intervals, the engine estimates the 70th percentile of daytime intervals to filter out short opportunistic walks and capture true biological retention capacity.
- **Continuous 24/7 Poop Transit (50th Percentile / Median)**: Defecation is bolus-driven; the engine maintains the median to track true gastrointestinal transit time without delaying alerts.
- **Dynamic Diurnal Meal Pacing**: The food engine divides the remaining waking hours until bedtime (`wakingHoursLeft / (remainingMeals + 1)`). When split meals or treats result in `todayMeals.length >= targetMeals` before the 90% daily gram goal is met, format as `Remaining portion (spaced ~X.Xh)` (in French: `Portion restante (espacée de ~X.Xh)`).
- **Interval-Driven Potty & Night Mode (`shouldPreservePreBedPotty`)**: Pee and poop predictions start from learned intervals ($T_{\text{last}} + \text{interval}$). When the standard expectation lands in deep night hours ($> \text{bedtime} + \text{interval}/2$), predictions roll over to morning wakeup. If it expires before that ($\le \text{bedtime} + \text{interval}/2$), tonight's pre-bed outing is preserved: for pee until $\text{bedtime} + \text{interval}/2$, for poop only until $\text{bedtime} + 60\text{m}$ (half its ~11 h interval would keep an overdue card until about 04:00).

### Canine Weight Prediction & WALTHAM Growth Engine Standards

- **WALTHAM™ 5-Category Growth Curves (*Salt et al., PLOS ONE 2017*)**: Categorizes canine development into 5 adult size tiers (I: <6.5kg, II: 6.5–9kg, III: 9–16kg, IV: 16–30kg, V: 30–45kg) interpolated with smooth Hermite splines across clinical anchors.
- **Timestamp-Synchronized Regression**: Evaluates each weigh-in log at the puppy's exact age on the day of the log ($t_{\text{log}} = (\text{timestamp}_{\text{log}} - \text{birthDate}) / 7\text{d}$), eliminating prediction decay when days or weeks elapse between weigh-ins.
- **Multi-Point Exponential Time-Weighting**: Weights historical logs with a 30-day exponential half-life ($w_i = e^{-\Delta t / 30\text{d}}$), dynamically blending 15–35% breed baseline with 65–85% empirical trajectory depending on data density ($\ge 6$ logs achieves 85% empirical weight).
- **Gompertz Growth Velocity Derivative ($dW/dt$)**: Computes physiologically authentic daily weight gain ($dW/dt = W(t) \cdot B \cdot e^{-B(t-M)}$), yielding 50–65 g/day for 5-month medium puppies (e.g. Balma at ~53 g/day) rather than stagnant linear estimates.
- **One Weight Timeline**: Every weigh-in is its own weight event (`activities` row, `type='weight'`), a vet visit's included, and nothing is merged (`getUnifiedWeightEntries`). The vaccine and deworming add forms save an optional weight as a weight event (12:00 Paris on the record date, or now if that is still ahead; a record dated after today with a weight is refused; notes = vaccine or product name), never in `health_records.weight_at_time` (a legacy backup the app does not read). The vet badge marks a weight event whose notes are a `healthProtocols.json` vaccine or antiparasitic name. Weight boxes start empty with a "Last weigh-in" hint and never offer the profile weight or the model estimate.

### Safe Database Inspection

- Safe DB Inspection Script: `npm run db:inspect` (or `npx tsx scripts/inspect_db.ts`) — inspects tables, row counts, puppy profiles, live prediction engine diagnostics, and recent activity trail with location, stool consistency, food grams, caretakers, and notes.

### Preview Data

- Vercel preview deployments read the Neon `preview` branch, a child of production `main`. Never write to `main`.
- Refresh it from production: Neon console > Branches > `preview` > Reset from parent (or `neon branches reset preview --parent`, adding `--project-id` when the CLI has no linked project). It replaces everything on `preview`, the demo data included: re-run the seed after.
- Demo data: `scripts/preview-seed.sql`, one `DO $$ ... $$` block. Run it in the Neon SQL editor with `preview` selected, or `psql "$PREVIEW_POSTGRES_URL" -f scripts/preview-seed.sql`. It adds a puppy (Pistache) and an account waiting for approval to the real household, plus 'Famille Martin (demo)' (2 dogs, an Admin, members, an unlinked badge, an account without a badge) and 'Famille Dupont (demo)', with `v_days` (default 30) days of logs and health passports, relative to now (Europe/Paris). Logs stop at the run time: re-run the seed at the start of each test session.
- Rerunnable: every seed id starts with `seed-`; the block first deletes the seed and what the app attached to seeded households or dogs, and never touches other rows.
- Guard: the block raises before any write unless `md5(neon.branch_id)` is the `preview` branch's (fails closed: production, other branches, non-Neon hosts). A reset from parent keeps the branch id; a recreated `preview` branch needs the new hash in the guard. Keep it.

## Key Files

| File                                  | Role                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/types/index.ts`                  | Canonical domain interfaces (`Activity`, `PuppyProfile`, `PredictionResult`)         |
| `src/db/schema.ts`                    | Single source of truth Drizzle ORM database tables                                    |
| `api/dashboard.ts`                    | Backend-for-Frontend (BFF) single-roundtrip boot endpoint (dogs + caretakers + recent acts + health records + every weight event of the dog) |
| `src/data/healthProtocols.json`       | Dataset for vaccine types, antiparasitics (Credelio Plus, etc.), and ESCCAP rules     |
| `src/services/api.ts`                 | SWR-cached REST API client & fetch helpers                                            |
| `scripts/inspect_db.ts`               | Safe database inspection & live prediction engine diagnostics script                    |
| `src/i18n/en.ts` & `fr.ts`            | English & French localization dictionaries                                           |
| `src/utils/predictions.ts`            | Predictive engine (learned intervals, age-graduated gastrocolic reflex, sleep bounds)   |
| `src/views/HouseholdSettingsView.tsx` | Combined Chiens & Membres configuration view with inline member name editing           |
| `src/views/CarnetDeSanteView.tsx`      | French & International veterinary health protocol passport                          |

### Global React Context for App-Wide State (i18n & Theme)

- App-wide state (language, theme, active tenant) must be provided via a root React Context (`I18nProvider`) wrapped at `main.tsx`.
- Never use local `useState(getStoredLanguage)` in individual components; this causes desynchronized state and fails to re-render sibling components upon language switch.

### API Caching, In-Flight Deduplication & BFF Boot Discipline

- **Single Boot Roundtrip with Single-Pipe Batching (`/api/dashboard`)**: The initial dashboard view loads via `GET /api/dashboard`, executing puppies, caretakers, recent activities, **health records and every weight event of the dog (no date bound)** in one single `db.batch([ ... ])` HTTP pipeline to Neon. Cuts DB query execution time from 77ms down to 23ms (3.3x speedup).
- **Frame-1 LocalStorage Profile & Caretaker Cache**: Puppy metadata (name, breed, birthDate, avatar) and caretakers list are cached in `localStorage`. On Frame 1 ($t = 0$), the real Navbar and dog header render instantly without waiting for network responses.
- **PWA Service Worker Precaching**: `vite-plugin-pwa` precaches immutable hashed CSS/JS assets for `< 15ms` instant shell startup on iOS/Android. Network calls to `/api/*` are strictly `NetworkOnly` to guarantee 100% fresh potty and meal data across caretakers. Updates never reload a visible page (owner decision 2026-10-15): `registerType: 'prompt'` (no `skipWaiting`, so the old precache and its lazy chunks stay until the switch), and `src/registerServiceWorker.ts` activates the waiting worker and reloads when the page is hidden (at once if it already is).
- **Deferred Session Extension**: `exchangeSessionToken()` runs 3 seconds after dashboard renders (via `setTimeout`), avoiding a 2nd concurrent Vercel function cold start during the critical boot path.
- **Skeleton Shell Loading State**: During initial data fetch, App.tsx renders the real Navbar (hydrated from cache) plus 3 card placeholder skeletons instead of a blank screen.
- **QuickLogModal Prefetch**: The QuickLogModal chunk is prefetched 2 seconds after mount via dynamic `import()`, eliminating the INP spike on first "+" button tap.
- `src/services/api.ts` maintains an `inflightRequests` map to de-duplicate simultaneous requests for identical URLs across mounting components.
- Every API response is `Cache-Control: no-store` (set once in `setCorsHeaders`). `clearApiCache()` keeps in-flight requests, so the `visibilitychange` + `focus` + `pageshow` burst of one return to the app makes one `/api/dashboard` call. A GET joins an in-flight request only if it is under 2 s old (`INFLIGHT_JOIN_MS`), so a request sent before the app went to the background, or one that hangs, is never reused. Keep both: `no-store` without that deduplication turns the burst into three function calls.
- Within the in-memory TTL window (60s), serve from cache directly without spawning redundant background `fetch()` requests on every tab switch.
- Clear cache synchronously on mutations (`createActivity`, `updateActivity`, `deleteActivity`, `createDog`, etc.), and clear the cache and in-flight GETs again when the mutation is answered: a GET sent or answered while it was in flight may miss it and is never reused.

### SQL-Side Date Filtering & Progressive Timeline Pagination

- Initial dashboard boot fetches a minimal 30-day window (`{ days: 30, limit: 300 }`), supplying 100% of data needed for the AI Prediction Engine while keeping network payloads light (~90 KB).
- Dynamic timeline expansion (`7d -> 14d -> 30d -> 90d -> 180d -> all-time`) must pass `days` to the backend so PostgreSQL executes indexed date bounds (`gte(timestamp, cutoffDate)` backed by `idx_activities_tenant_pup_time`). Never fetch all historical records over the wire when expanding a date window.

### Static Asset Compression & Responsive Mobile Localization

- All static images in `public/` must be compressed (PNGs quantized with adaptive filtering, JPGs encoded with mozjpeg, WebP generated) to keep image payloads $\le 35\text{ KB}$.
- Button labels and action text must remain concise in both English and French to avoid overflowing containers on narrow 320px–375px mobile viewports (e.g. `Charger les {days} derniers jours` instead of `Charger les journaux précédents (Les {days} derniers jours)`).

## Common Mistakes to Avoid

- Don't return raw space-separated PostgreSQL strings (`'2026-07-28 05:52:00+00'`) over API responses — serialize to ISO 8601 strings (`.toISOString()`)
- Don't add useEffect to react to state changes — put logic in the event handler that causes the change
- Don't execute inline DDL (`CREATE TABLE IF NOT EXISTS`) inside serverless handlers — schema migrations belong in `src/db/schema.ts` and `drizzle/`
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
