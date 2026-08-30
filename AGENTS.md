# AGENTS.md — PupPace

## Quick Context

PupPace — Smart Household Puppy Activity Tracker & Potty Predictor. React 19 + Vite + TypeScript + TailwindCSS + Drizzle ORM / Neon PostgreSQL. Strict TypeScript, Zod everywhere.

## Before Making Changes

1. `npx tsc -b` — must pass clean with 0 errors
2. `npm test` — Vitest suite (181 tests across 21 files), all tests must pass
3. Check `src/types/index.ts` before defining any type locally

## Critical Rules

### Agent Instruction Files Standard

- `AGENTS.md` is the canonical open standard for repository and workspace guidelines.
- When maintaining or updating project rules, edit `AGENTS.md`. Maintain `CLAUDE.md -> AGENTS.md` as a relative symlink (`ln -sf AGENTS.md CLAUDE.md`) for backward compatibility with Anthropic CLI.

### Database & Drizzle ORM Timestamp Alignment

- Database timestamp columns use `timestamp('col', { withTimezone: true, mode: 'date' })` in `src/db/schema.ts`.
- Server API handlers (`api/activities.ts`) format Date objects into standard **ISO 8601 strings** (`.toISOString()`) before returning `res.json()`.
- NEVER return raw PostgreSQL space-separated driver strings (`'2026-07-28 05:52:00+00'`) to client components; V8 engines reject raw PostgreSQL strings as `Invalid Date`.

### CSV Export & Printable Report Standards

- **UTF-8 BOM Prefix**: Always prepend `\uFEFF` to generated CSV content so Microsoft Excel and Apple Numbers parse Unicode / French accents (`é`, `è`, `ê`, `à`) without character corruption.
- **Uniform Quoting & Escaping**: Pass both headers and row cells through `escapeCsvField`. Always `.trim()` values before quoting.
- **Separate Date & Time Columns**: Never export combined locale timestamp strings (e.g. `"8/19/2026, 8:45:00 AM"`). Split into distinct ISO `Date` (`YYYY-MM-DD`) and 24h `Time` (`HH:mm`) columns to enable spreadsheet filtering, sorting, and charts.
- **Dedicated Columns for Mixed Records**: When exporting heterogeneous records into a single CSV (e.g. Health Passport vaccines, dewormings, weights), never overload columns (avoid `Clinic / Logged By`). Provide dedicated, unambiguous columns (`Veterinary Clinic`, `Logged By`).
- **Client-Side Print Reports**: Use lightweight, responsive HTML templates with `@page { size: A4; margin: 15mm; }` via `window.open()` + `window.print()` instead of heavy client PDF libraries.
- **DOM Test Environment**: Tag DOM-dependent Vitest files with `// @vitest-environment jsdom`. Verify BOM presence via raw bytes `new Uint8Array(await blob.arrayBuffer())` (`0xEF, 0xBB, 0xBF`), as WHATWG `blob.text()` strips the BOM.

### User Identity & Security

- `loggedBy` is strictly bound to the authenticated `currentUser` state (`setCurrentUser(res.user.name)`).
- QuickLogModal renders `loggedBy` as a read-only, locked input showing the active user's name. Users cannot log events under another family member's name.

### Health Passport & Protocols

- Veterinary protocols and product schedules are data-driven from `src/data/healthProtocols.json`.
- All-in-one monthly chewable tablets (Credelio Plus, Nexgard Spectra, Simparica Trio) auto-calculate +1 month due dates.
- Bravecto auto-calculates +3 months (12 weeks). Milbemax/Drontal auto-calculates monthly (<6m) or quarterly (>=6m).
- Older historical vaccine or deworming entries that have subsequent entries logged on/after their booster date display **`✅ Renouvelé / Effectué`** (Fulfilled) instead of overdue alerts.

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

- Every test must exercise real code — zero placeholder assertions (181/181 tests passing across 21 test files).
- Multi-day 30-day realistic dataset test suite (`src/utils/__tests__/realistic_dataset.test.ts`, `predictions.test.ts`, and `night_mode_and_age_transitions.test.ts`) verifies predictions, sleep bounds, age-graduated gastrocolic reflex maturation, and protocols.

### Predictive Engine & Statistical Standards

- **10-Day Half-Life Decay**: `calculateLearnedIntervalMinutes` uses a 10-day exponential half-life ($e^{-\Delta t / 10\text{d}}$) to steadily reflect puppy maturation without getting distorted by short 3–4 day vacation disruptions or weekend trips.
- **Capacity-Aware Pee Estimation (70th Percentile)**: Potty logs are right-censored by human walking opportunities. For Daytime Pee intervals, the engine estimates the 70th percentile of daytime intervals to filter out short opportunistic walks and capture true biological retention capacity.
- **Continuous 24/7 Poop Transit (50th Percentile / Median)**: Defecation is bolus-driven; the engine maintains the median to track true gastrointestinal transit time without delaying alerts.
- **Dynamic Diurnal Meal Pacing**: The food engine divides the remaining waking hours until bedtime (`wakingHoursLeft / (remainingMeals + 1)`). When split meals or treats result in `todayMeals.length >= targetMeals` before the 90% daily gram goal is met, format as `Remaining portion (spaced ~X.Xh)` (in French: `Portion restante (espacée de ~X.Xh)`).
- **Symmetric Pre-Bed Void Awareness (`isPreBedPottyDone`)**: When an expected void lands in night hours, roll over to morning only if the puppy already emptied their bladder/bowels in the pre-bed window ($\ge \text{bedtime} - 2\text{h}$). Otherwise, preserve tonight's pre-bed outing.

### Safe Database Inspection

- Safe DB Inspection Script: `npm run db:inspect` (or `npx tsx scripts/inspect_db.ts`) — inspects tables, row counts, puppy profiles, live prediction engine diagnostics, and recent activity trail with location, stool consistency, food grams, caretakers, and notes.

## Key Files

| File                                  | Role                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/types/index.ts`                  | Canonical domain interfaces (`Activity`, `PuppyProfile`, `PredictionResult`)         |
| `src/db/schema.ts`                    | Single source of truth Drizzle ORM database tables                                    |
| `api/dashboard.ts`                    | Backend-for-Frontend (BFF) single-roundtrip boot endpoint (dogs + caretakers + acts + health records) |
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

- **Single Boot Roundtrip (`/api/dashboard`)**: The initial dashboard view loads via `GET /api/dashboard`, executing puppies, caretakers, recent activities, **and health records** in one single concurrent `Promise.all` (4 queries). Eliminates cold-start waterfalls — DogHealthSummary receives health records as props, never fetches independently.
- **Deferred Session Extension**: `exchangeSessionToken()` runs 3 seconds after dashboard renders (via `setTimeout`), avoiding a 2nd concurrent Vercel function cold start during the critical boot path.
- **Skeleton Shell Loading State**: During data fetch, App.tsx renders a skeleton shell (navbar + 3 card placeholders + timeline rows) instead of a full-screen spinner, improving perceived LCP.
- **QuickLogModal Prefetch**: The QuickLogModal chunk is prefetched 2 seconds after mount via dynamic `import()`, eliminating the INP spike on first "+" button tap.
- `src/services/api.ts` maintains an `inflightRequests` map to de-duplicate simultaneous requests for identical URLs across mounting components.
- Within the in-memory TTL window (60s), serve from cache directly without spawning redundant background `fetch()` requests on every tab switch.
- Clear cache synchronously on mutations (`createActivity`, `updateActivity`, `deleteActivity`, `createDog`, etc.).

### HeroUI CSS Performance

- `src/index.css` uses a **targeted `@source` directive** scanning only the 8 HeroUI components used in the app (`button,card,chip,input,modal,select,listbox,toast`). Never use the wildcard `@source "../node_modules/@heroui/theme/dist/**/*"` — it pulls in ~40+ component stylesheets (611KB render-blocking CSS).

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
- Don't use `@source` wildcards for HeroUI theme scanning — list only the components actually imported
- Don't use per-request `getDb()` in API handlers — use module-level `neon()`/`drizzle()` for connection reuse across warm invocations
