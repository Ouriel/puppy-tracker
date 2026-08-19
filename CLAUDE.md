# CLAUDE.md — PupPace

## Quick Context

PupPace — Smart Household Puppy Activity Tracker & Potty Predictor. React 19 + Vite + TypeScript + TailwindCSS + Drizzle ORM / Neon PostgreSQL. Strict TypeScript, Zod everywhere.

## Before Making Changes

1. `npx tsc -b` — must pass clean with 0 errors
2. `npm test` — Vitest suite (165 tests across 18 files), all tests must pass
3. Check `src/types/index.ts` before defining any type locally

## Critical Rules

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

- Every test must exercise real code — zero placeholder assertions (144/144 tests passing across 16 test files).
- Multi-day 30-day realistic dataset test suite (`src/utils/__tests__/realistic_dataset.test.ts` & `predictions.test.ts`) verifies predictions, sleep bounds, age-graduated gastrocolic reflex maturation, and protocols.

### Safe Database Inspection

- Safe DB Inspection Script: `npm run db:inspect` (or `npx tsx scripts/inspect_db.ts`) — inspects tables, row counts, puppy profiles, live prediction engine diagnostics, and recent activity trail with location, stool consistency, food grams, caretakers, and notes.

## Key Files

| File                                  | Role                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/types/index.ts`                  | Canonical domain interfaces (`Activity`, `PuppyProfile`, `PredictionResult`)         |
| `src/db/schema.ts`                    | Single source of truth Drizzle ORM database tables                                    |
| `src/data/healthProtocols.json`       | Dataset for vaccine types, antiparasitics (Credelio Plus, etc.), and ESCCAP rules     |
| `src/services/api.ts`                 | SWR-cached REST API client & fetch helpers                                            |
| `scripts/inspect_db.ts`               | Safe database inspection & live prediction engine diagnostics script                    |
| `src/i18n/en.ts` & `fr.ts`            | English & French localization dictionaries                                           |
| `src/utils/predictions.ts`            | Predictive engine (learned intervals, age-graduated gastrocolic reflex, sleep bounds)   |
| `src/views/HouseholdSettingsView.tsx` | Combined Chiens & Membres configuration view with inline member name editing           |
| `src/views/CarnetDeSanteView.tsx`      | French & International veterinary health protocol passport                          |

## Common Mistakes to Avoid

- Don't return raw space-separated PostgreSQL strings (`'2026-07-28 05:52:00+00'`) over API responses — serialize to ISO 8601 strings (`.toISOString()`)
- Don't add useEffect to react to state changes — put logic in the event handler that causes the change
- Don't execute inline DDL (`CREATE TABLE IF NOT EXISTS`) inside serverless handlers — schema migrations belong in `src/db/schema.ts` and `drizzle/`
- Don't stack sequential `await` calls in data loaders — use `Promise.all` for parallel fetching
- Don't define types locally when they exist in `src/types/index.ts`
- Don't use `(e) =>` or `(p) =>` — spell out parameter names (`(event) =>`, `(puppy) =>`, `(activity) =>`)
- Don't run `sleep` commands or poll deployment CLI after `git push` — inform the user immediately
- Don't write tests that assert `null === null` or `true === true` — exercise real domain code
- Don't write or commit code when asked to research — present options and wait for explicit user choice first
