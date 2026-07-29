# CLAUDE.md — PupPace

## Quick Context

PupPace — Smart Household Puppy Activity Tracker & Potty Predictor. React + Vite + TypeScript + TailwindCSS + Drizzle ORM / PostgreSQL. Strict TypeScript, Zod everywhere.

## Before Making Changes

1. `npx tsc -b` — must pass clean with 0 errors
2. `npm test` — Vitest suite, all tests must pass
3. Check `src/types/index.ts` before defining any type locally

## Critical Rules

### Types & Validation

- Canonical types live in `src/types/index.ts` (Activity, PuppyProfile, Caretaker, UserAccount, PredictionResult) — import from there, never redefine locally.
- Server-side input validation via Zod schemas (`src/utils/schemas.ts`).
- Client-side API calls go through `src/services/api.ts` — typed helpers with response validation.
- Never parse API responses without validation.

### React & Code Style

- `useEffect` ONLY for: DOM event subscriptions, timers, initial data fetch.
- NEVER `useEffect` for: derived state, reacting to state changes, event side effects — put logic in event handlers.
- Declaration order: `useState` → hooks → variables → `useMemo` → `useCallback` → `useEffect`.
- No abbreviated parameter names: `(event)` not `(e)`, `(item)` not `(i)`, `(puppy)` not `(p)`, `(activity)` not `(a)`.

### UI & Aesthetics

- Modern, rich design aesthetics (dark mode, HSL gradients, glassmorphism, micro-animations).
- Scalable dropdowns for multi-language selection (`en`, `fr`).
- Clean English technical URL routing (`/`, `/health-passport`, `/settings`, `/care-guide`, `/admin`).

### Testing

- Every test must exercise real code — zero placeholder assertions (`13/13 tests passing`).
- Test pure functions: predictions, health schedules, storage helpers, i18n key parity.

### Performance & Data Fetching

- Parallelize all multi-endpoint REST calls with `Promise.all` — never stack sequential `await` calls.
- In-memory SWR caching in `src/services/api.ts` for 0ms tab navigation. Pre-warm cache on initial boot.

### Database & Drizzle ORM

- ZERO runtime DDL (`CREATE TABLE IF NOT EXISTS`) in API handlers — runtime queries are strictly business logic (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
- Canonical schemas live in `src/db/schema.ts`. Migrations are generated via `npx drizzle-kit generate` into `drizzle/`.

### Deployment & Workflow

- NEVER run `sleep` or poll Vercel after `git push`. Commit, push, and immediately inform the user.
- **Research Directives**: When asked to research, analyze, or compare options, ONLY present the findings, trade-offs, and options to the user. DO NOT write, edit, or push code without presenting options and getting explicit user approval.

## Key Files

| File                         | Role                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `src/types/index.ts`         | Canonical domain interfaces (`Activity`, `PuppyProfile`, `PredictionResult`)         |
| `src/db/schema.ts`           | Single source of truth Drizzle ORM database tables                                    |
| `src/services/api.ts`        | SWR-cached REST API client & fetch helpers                                            |
| `src/i18n/en.ts` & `fr.ts`   | English & French localization dictionaries                                           |
| `src/utils/predictions.ts`   | Adaptive AI algorithm for next potty & meal predictions                              |
| `src/views/HouseholdSettingsView.tsx` | Combined Chiens & Membres configuration view                              |
| `src/views/CarnetDeSanteView.tsx`     | French & International veterinary health protocol passport                          |

## Common Mistakes to Avoid

- Don't add useEffect to react to state changes — put logic in the event handler that causes the change
- Don't execute inline DDL (`CREATE TABLE IF NOT EXISTS`) inside serverless handlers — schema migrations belong in `src/db/schema.ts` and `drizzle/`
- Don't stack sequential `await` calls in data loaders — use `Promise.all` for parallel fetching
- Don't define types locally when they exist in `src/types/index.ts`
- Don't use `(e) =>` or `(p) =>` — spell out parameter names (`(event) =>`, `(puppy) =>`, `(activity) =>`)
- Don't run `sleep` commands or poll deployment CLI after `git push` — inform the user immediately
- Don't write tests that assert `null === null` or `true === true` — exercise real domain code
- Don't write or commit code when asked to research — present options and wait for explicit user choice first
