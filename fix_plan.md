# 🛠️ PupPace — Complete Fix Plan

**Scope**: All findings from full-stack codebase audit and technical review
**Codebase**: [/Users/matthieu/project/puppy-tracker](file:///Users/matthieu/project/puppy-tracker)

---

## Phase 1: Server-Side Authentication & API Integration (Fixes Tasks 1.1 - 1.9)

### Task 1.1: Install `google-auth-library`
```bash
cd /Users/matthieu/project/puppy-tracker
npm install google-auth-library
```

### Task 1.2: Create auth middleware `api/_auth.ts`
Create [api/_auth.ts](file:///Users/matthieu/project/puppy-tracker/api/_auth.ts):
```typescript
import { OAuth2Client } from 'google-auth-library';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { usersTable } from '../src/db/schema';
import type { VercelRequest } from '@vercel/node';

const client = new OAuth2Client();

export interface AuthContext {
  email: string;
  name: string;
  householdId: string;
  role: string;
}

export async function verifyAuth(req: VercelRequest): Promise<AuthContext> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing Authorization header' };
  }

  const token = authHeader.slice(7);
  const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID;

  // Verify Google JWT
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw { status: 401, message: 'Invalid token payload' };
  }

  // Database user lookup
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
  const db = drizzle(sql);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, payload.email.toLowerCase()));

  if (!user) {
    throw { status: 403, message: 'User not registered. Ask Super Admin for access.' };
  }
  if (user.status !== 'ACTIVE') {
    throw { status: 403, message: 'Account pending activation by Super Admin.' };
  }

  return {
    email: user.email,
    name: user.name,
    householdId: user.householdId,
    role: user.role,
  };
}
```

### Task 1.3: Add auth to every API handler
For each handler in `api/` (`dogs.ts`, `activities.ts`, `households.ts`, `users.ts`):
1. Import `verifyAuth` from `./_auth`.
2. Remove client-provided `X-Household-ID` parsing.
3. Call `const auth = await verifyAuth(req);` and use `auth.householdId`.

### Task 1.4: Role checks on destructive operations
In `api/dogs.ts` and `api/users.ts`, verify `auth.role === 'Admin' || auth.role === 'SuperAdmin'` before executing DELETE handlers.

### Task 1.5: Send JWT from frontend
In `src/utils/storage.ts`:
- Maintain `_authToken` state in memory via `setAuthToken(token)`.
- Include `Authorization: Bearer ${_authToken}` in `householdHeaders()`.

### Task 1.6: SSO Token lifecycle
In `src/App.tsx`:
- Pass Google JWT credential to `handleUnlockWithSSO(email, name, token)`.
- Store token in memory and `localStorage` on successful login.

### Task 1.7: Remove unused password authentication
Clean up password input forms and mock password handlers in `src/components/AuthLockScreen.tsx` and `src/App.tsx`.

### Task 1.8: Database user registration flow
Route new user registration requests through `/api/users` with `PENDING_APPROVAL` status.

### Task 1.9: Migrate user management to Database API
Update `src/views/AdminView.tsx` and `api/users.ts` to execute user list fetching, status activation, and deletion directly via PostgreSQL rather than local storage.

---

## Phase 2: CORS & Environment Rules (Tasks 2.1 - 2.4)

- Filter git history for exposed `.env` credentials if necessary.
- Enforce explicit origin headers (`Access-Control-Allow-Origin: https://puppace.vercel.app`) in API handlers instead of wildcard `*`.
- Remove default `'FAMILY-COCKER-2026'` fallback string from API handlers.

---

## Phase 3: Data Integrity & Health Persistence (Tasks 3.1 - 3.4)

### Task 3.1: Health Records DB Table & API
Add `healthRecordsTable` to `src/db/schema.ts`, push schema updates, create `api/health-records.ts`, and update `src/views/CarnetDeSanteView.tsx` to read/write health records via DB endpoints.

### Task 3.2: Merge strategy on initial sync
In `src/App.tsx`, update `initRestApiSync` to perform a non-destructive merge of local memory state with remote DB records on app load.

### Task 3.3: Optimized POST operations
In `src/utils/storage.ts`, track processed dog IDs (`_knownDogIds`) to eliminate redundant HTTP requests when saving puppies.

### Task 3.4: Global toast & error handler
Create `src/utils/toast.ts` and `src/components/Toast.tsx` to provide visual notifications for failed API transactions and network issues.

---

## Phase 4: i18n Dictionary Expansion & Migration (Tasks 4.1 - 4.4)

- Add missing keys to `src/i18n/en.ts` and `src/i18n/fr.ts`.
- Replace hardcoded UI strings across components (`AuthLockScreen`, `QuickLogModal`, `ActivityTimeline`, `AdminView`, `CarnetDeSanteView`, `CareGuideView`, `HouseholdSettingsView`).
- Clean up unused translation keys.

---

## Phase 5: Dead Code Removal (Tasks 5.1 - 5.2)

Remove unimported components (`AdminDashboard.tsx`, `CareGuideModal.tsx`, `PuppyProfileModal.tsx`, `AddPuppyModal.tsx`, `SharePackModal.tsx`) and clean up package dependencies.

---

## Phase 6: UI & State Enhancements (Tasks 6.1 - 6.3)

- Add startup loading state in `App.tsx`.
- Wire `Toast` notification container into main layout.
- Add confirmation toasts upon event logging.

---

## Phase 7: Types Alignment & Zod Validation (Tasks 7.1 - 7.2)

- Align `Activity` and `PuppyProfile` TypeScript types in `src/types/index.ts` with Drizzle DB definitions.
- Apply Zod schema validation to request payloads in serverless API routes.

---

## Phase 8: Accessibility & Build Configuration (Tasks 8.1 - 8.5)

- Update `index.html` viewport meta tags to ensure pinch-to-zoom accessibility.
- Add `aria-label` tags to icon buttons in `src/components/Navbar.tsx`.
- Add OpenGraph meta properties to `index.html`.
- Configure dev proxy in `vite.config.ts`.
- Convert PWA manifest icons to transparent PNG format.
