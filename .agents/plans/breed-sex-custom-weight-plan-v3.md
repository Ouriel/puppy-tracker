# Implementation Plan v3 (Ponytail Ultra Edition) — Breed, Sex & Expected Weight

> Streamlined plan applying Ponytail Ultra: zero redundant columns, zero boilerplate scripts, minimal diffs.

---

## Goal

1. **Sex / Gender** (`female` / `male`): add to DB, API, UI, and fix pre-existing `PuppyProfileSchema` omission.
2. **80+ Breed Catalog**: structured data with gender-specific weights, replacing hardcoded if-chains.
3. **Custom Expected Weight**: user-defined adult weight for mixed/unknown breeds calibrating WALTHAM curves.

---

## DB & Migration

> [!IMPORTANT]
> Vercel does not auto-migrate. Apply manually via `npm run db:push`.

### 1. [`src/db/schema.ts`](file:///Users/matthieu/project/puppy-tracker/src/db/schema.ts)
Add 2 columns to `puppiesTable` (no `breedId` column needed — `findBreed(breed)` resolves existing & new entries):
```ts
gender: text('gender'), // 'female' | 'male'
expectedAdultWeightKg: doublePrecision('expected_adult_weight_kg'),
```

### 2. Migration (`drizzle/0001_*.sql`)
Run `npm run db:generate`:
```sql
ALTER TABLE "puppies" ADD COLUMN "gender" text;
ALTER TABLE "puppies" ADD COLUMN "expected_adult_weight_kg" double precision;
```
Apply to Neon: `npm run db:push`.

---

## API & Schemas

### 1. [`src/types/index.ts`](file:///Users/matthieu/project/puppy-tracker/src/types/index.ts)
Add `expectedAdultWeightKg` to `PuppyProfile` (`gender?: 'male' | 'female'` already exists at L37):
```ts
expectedAdultWeightKg?: number;
```

### 2. [`src/utils/schemas.ts`](file:///Users/matthieu/project/puppy-tracker/src/utils/schemas.ts)
Fix pre-existing bug (`gender` stripped by Zod) and add `expectedAdultWeightKg`:
```ts
export const PuppyProfileSchema: z.ZodType<PuppyProfile> = z.object({
  id: z.string(),
  householdId: z.string().optional(),
  name: z.string().min(1),
  breed: z.string(),
  birthDate: z.string(),
  weightKg: z.number(),
  dailyFoodGramGoal: z.number(),
  targetMealsPerDay: z.number(),
  avatarUrl: z.string().optional(),
  notes: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(), // Fix: was missing
  expectedAdultWeightKg: z.number().positive().optional(),
});
```

### 3. [`api/dogs.ts`](file:///Users/matthieu/project/puppy-tracker/api/dogs.ts)
Update `DogSchema` + INSERT / UPDATE:
```ts
// In DogSchema:
gender: z.enum(['female', 'male']).optional(),
expectedAdultWeightKg: z.number().positive().max(120).optional(),

// In UPDATE .set():
...(body.gender !== undefined ? { gender: body.gender } : {}),
...(body.expectedAdultWeightKg !== undefined ? { expectedAdultWeightKg: body.expectedAdultWeightKg } : {}),

// In INSERT .values():
gender: body.gender || null,
expectedAdultWeightKg: body.expectedAdultWeightKg || null,
```

---

## Breed Catalog & Weight Engine

### 1. [NEW] `src/data/breedsCatalog.ts`
Minimal, type-safe breed catalog:
```ts
export interface BreedEntry {
  id: string;
  nameEn: string;
  nameFr: string;
  femaleWeightKg: number;
  maleWeightKg: number;
  aliases: string[];
}

export const BREED_CATALOG: BreedEntry[] = [ /* ~80 breeds */ ];

export function findBreed(query: string): BreedEntry | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  return BREED_CATALOG.find((b) =>
    b.id === q ||
    b.nameEn.toLowerCase() === q ||
    b.nameFr.toLowerCase() === q ||
    b.aliases.some((a) => q.includes(a))
  );
}
```

### 2. [`src/constants/breeds.ts`](file:///Users/matthieu/project/puppy-tracker/src/constants/breeds.ts)
Derive standard list from catalog:
```ts
import { BREED_CATALOG } from '../data/breedsCatalog';
export const DOG_BREEDS = BREED_CATALOG.map((b) => b.nameEn);
```

### 3. [`src/utils/breeds.ts`](file:///Users/matthieu/project/puppy-tracker/src/utils/breeds.ts)
```ts
export function formatBreedName(rawBreed: string, lang: Language): string {
  const match = findBreed(rawBreed);
  if (match) return lang === 'fr' ? match.nameFr : match.nameEn;
  return rawBreed;
}
```

### 4. [`src/utils/weight.ts`](file:///Users/matthieu/project/puppy-tracker/src/utils/weight.ts)
Refactor `getExpectedAdultWeight`:
```ts
export function getExpectedAdultWeight(
  breed: string,
  gender?: 'male' | 'female',
  customExpectedWeight?: number
): number {
  if (customExpectedWeight && customExpectedWeight >= 1.0) return customExpectedWeight;
  const entry = findBreed(breed);
  if (entry) {
    if (gender === 'female') return entry.femaleWeightKg;
    if (gender === 'male') return entry.maleWeightKg;
    return (entry.femaleWeightKg + entry.maleWeightKg) / 2;
  }
  return 13;
}
```

Update signatures & plumbing:
- `calculateProjectedAdultWeightRange(breed, logs, age?, fallback?, gender?, customExpectedWeight?)`
- `getEffectivePuppyWeight`: pass `profile?.expectedAdultWeightKg` at L408
- Callers in [`DogHealthSummary.tsx`](file:///Users/matthieu/project/puppy-tracker/src/components/DogHealthSummary.tsx#L65) and [`WeightGrowthChart.tsx`](file:///Users/matthieu/project/puppy-tracker/src/components/WeightGrowthChart.tsx#L44): pass `profile.expectedAdultWeightKg`

---

## UI Components

### 1. [`src/views/PuppiesView.tsx`](file:///Users/matthieu/project/puppy-tracker/src/views/PuppiesView.tsx)
- State:
  ```ts
  gender: undefined as 'female' | 'male' | undefined,
  expectedAdultWeightKg: undefined as number | undefined,
  ```
- Gender toggle: `♀ Femelle` / `♂ Mâle` segmented button
- Breed selector: HeroUI `Autocomplete` with accent-insensitive filter
- Custom weight: simple `<Input type="number" step="0.5" min="1" max="100" />` shown when breed is Mixed/Other/Unknown
- Badges: `♀` / `♂` next to dog name in cards, [`DogHealthSummary.tsx`](file:///Users/matthieu/project/puppy-tracker/src/components/DogHealthSummary.tsx), and [`CarnetDeSanteView.tsx`](file:///Users/matthieu/project/puppy-tracker/src/views/CarnetDeSanteView.tsx)

### 2. [`src/index.css`](file:///Users/matthieu/project/puppy-tracker/src/index.css)
Update `@source` to include `autocomplete,popover`:
```css
@source "../node_modules/@heroui/theme/dist/components/{autocomplete,button,card,chip,input,modal,popover,select,listbox,toast}/*.{js,ts}";
```

### 3. Localization ([`en.ts`](file:///Users/matthieu/project/puppy-tracker/src/i18n/en.ts), [`fr.ts`](file:///Users/matthieu/project/puppy-tracker/src/i18n/fr.ts))
Add keys: `sex`, `female`, `male`, `expectedAdultWeight`, `expectedWeightHint`, `searchBreedPlaceholder`, `noBreedFound`. (No redundant preset tier strings).

---

## Verification Plan

1. **`src/utils/__tests__/breed_catalog.test.ts`** (~10 tests):
   - English/French resolution for top breeds
   - Aliases & case insensitivity
   - Legacy format (`"English Cocker Spaniel / Cocker Anglais"`)
   - Gender-specific weight differences
   - Custom expected weight priority & fallback
   - Schema validation (gender allowed, invalid enum rejected)
2. **`src/utils/__tests__/breed_weight_datasets.test.ts`** (~6 tests):
   - WALTHAM growth trajectories across categories I to V + custom weight mixed breed
3. **Full regression**:
   ```bash
   npx tsc -b
   npm test
   npm run build
   ```

---

## Files Changed Summary (17 files)

| File | Action | Description |
|------|--------|-------------|
| `src/data/breedsCatalog.ts` | **NEW** | Lean catalog (80+ breeds, gender weights, aliases) |
| `src/db/schema.ts` | MODIFY | Add `gender`, `expectedAdultWeightKg` |
| `drizzle/0001_*.sql` | **NEW** | Auto-generated 2-column migration |
| `src/types/index.ts` | MODIFY | Add `expectedAdultWeightKg` to `PuppyProfile` |
| `src/utils/schemas.ts` | MODIFY | Fix `gender` omission + add `expectedAdultWeightKg` |
| `api/dogs.ts` | MODIFY | Update `DogSchema` + INSERT/UPDATE |
| `src/utils/weight.ts` | MODIFY | Catalog lookup + `customExpectedWeight` param |
| `src/utils/breeds.ts` | MODIFY | Refactor `formatBreedName()` to use catalog |
| `src/constants/breeds.ts` | MODIFY | Derive `DOG_BREEDS` from catalog |
| `src/views/PuppiesView.tsx` | MODIFY | Gender toggle + Autocomplete + weight input |
| `src/components/DogHealthSummary.tsx` | MODIFY | Gender badge + pass custom weight |
| `src/components/WeightGrowthChart.tsx` | MODIFY | Pass custom weight |
| `src/views/CarnetDeSanteView.tsx` | MODIFY | Gender badge |
| `src/index.css` | MODIFY | Add `autocomplete,popover` to `@source` |
| `src/i18n/en.ts` & `fr.ts` | MODIFY | Add translation keys |
| `src/utils/__tests__/breed_catalog.test.ts` | **NEW** | Catalog, gender, custom weight tests |
| `src/utils/__tests__/breed_weight_datasets.test.ts` | **NEW** | Growth trajectory tests |
| `AGENTS.md` | MODIFY | Update test count & documentation |
