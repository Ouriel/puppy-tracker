---
name: db-inspection
description: Inspect Neon PostgreSQL tables, puppy profiles, activity logs, and run prediction engine diagnostics safely without password leaks.
---

# Safe Database Inspection & Prediction Engine Diagnostics

Use this skill when you need to inspect production database state, view row counts, verify multi-tenant isolation, or test prediction engine calculations against live database records.

## Usage

Run the inspection script via NPM:

```bash
npm run db:inspect
```

Or execute directly with `tsx`:

```bash
npx tsx scripts/inspect_db.ts
```

## Security Rule

- **NEVER** hardcode database passwords, connection URIs, or tokens in source code or scripts.
- The inspection script automatically and safely loads `DATABASE_URL` from `.env.local` or environment variables.

## What It Displays

1. **Table Inventory & Row Counts**: Lists all 6 tables (`activities`, `puppies`, `households`, `users`, `caretakers`, `health_records`).
2. **Puppy Profiles**: Dumps active puppy profiles (ID, name, breed, weight, food goals).
3. **Log Statistics**: Summarizes activity logs by type (pee, poop, food, weight) and date range.
4. **Live Prediction Diagnostics**: Runs `detectSleepSchedule`, `calculateLearnedIntervalMinutes`, and `calculatePredictions` live against real database logs.
