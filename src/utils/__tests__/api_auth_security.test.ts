import { createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken, verifyAppSessionToken, verifyAuth } from '../../../api/_auth.js';
import activitiesHandler from '../../../api/activities.js';
import dogsHandler from '../../../api/dogs.js';
import householdsHandler from '../../../api/households.js';
import sessionHandler from '../../../api/auth/session.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

// The handlers read the database URL at import, as in production (api/auth/session.ts skipped its lookup without one)
vi.hoisted(() => {
  process.env.POSTGRES_URL ??= 'postgres://example.invalid/db';
});

// Hermetic DB: rows are served per table (no puppy matches the ownership lookup by default),
// and every WHERE clause and insert is recorded.
const dbMock = vi.hoisted(() => ({
  whereByTable: new Map<string, SQL>(),
  rowsByTable: {} as Record<string, unknown[]>,
  usersLookupError: null as Error | null,
  // Every select in the order sent, with how many selects had answered when it was sent
  selects: [] as Array<{ table: string; answeredBefore: number }>,
  answered: 0,
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => ({
          where: vi.fn((condition: SQL) => {
            const tableName = getTableName(table);
            dbMock.whereByTable.set(tableName, condition);
            dbMock.selects.push({ table: tableName, answeredBefore: dbMock.answered });
            const answer = tableName === 'users' && dbMock.usersLookupError
              ? Promise.reject(dbMock.usersLookupError)
              : Promise.resolve(dbMock.rowsByTable[tableName] ?? []);
            answer.then(() => { dbMock.answered += 1; }, () => {});
            return answer;
          }),
        })),
      })),
      insert: dbMock.insert,
      update: dbMock.update,
      delete: dbMock.delete,
    })),
  };
});

// The users row behind the tokens below: verifyAuth re-reads it on every request (S1).
const activeUserRow = {
  id: 'usr-1',
  email: 'user@example.com',
  name: 'Matthieu',
  householdId: 'hh-family-123',
  role: 'Husband',
  status: 'ACTIVE',
};

function createMockResponse() {
  const response: any = {
    statusCode: 200,
    body: null,
    setHeader: vi.fn(),
    end: vi.fn(() => response),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: vi.fn((data: unknown) => {
      response.body = data;
      return response;
    }),
  };
  return response;
}

function bearerRequest(token: string, method = 'GET', body?: unknown, query: Record<string, string> = {}) {
  return { method, headers: { authorization: `Bearer ${token}` }, query, body } as any;
}

describe('API Security & Session Token Validation Test Suite', () => {
  const originalEnv = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.whereByTable.clear();
    dbMock.usersLookupError = null;
    dbMock.selects = [];
    dbMock.answered = 0;
    dbMock.rowsByTable = { users: [activeUserRow] };
    dbMock.insert.mockReset();
    dbMock.insert.mockImplementation(() => ({
      values: (values: unknown) => ({ returning: () => Promise.resolve([values]) }),
    }));
    dbMock.update.mockReset();
    dbMock.update.mockImplementation(() => ({
      set: (values: unknown) => ({ where: () => ({ returning: () => Promise.resolve([values]) }) }),
    }));
    dbMock.delete.mockReset();
    dbMock.delete.mockImplementation(() => ({ where: () => Promise.resolve() }));
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalEnv;
  });

  it('generates and cryptographically verifies a valid App Session Token', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Husband',
    };

    const token = signAppSessionToken(payload, 30);
    expect(token).toBeDefined();
    expect(token.split('.').length).toBe(3);

    const verified = verifyAppSessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe('user@example.com');
    expect(verified?.householdId).toBe('hh-family-123');
    expect(verified?.role).toBe('Husband');
  });

  it('rejects tampered tokens with invalid signatures', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Member',
    };

    const token = signAppSessionToken(payload, 30);
    const [header, , signature] = token.split('.');

    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, role: 'SuperAdmin' })
    ).toString('base64url');

    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
    const result = verifyAppSessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it('rejects expired tokens', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Member',
    };

    // Generate token with negative expiration (-1 day)
    const token = signAppSessionToken(payload, -1);
    const result = verifyAppSessionToken(token);
    expect(result).toBeNull();
  });

  it('prevents privilege escalation by spoofing SuperAdmin role in non-admin email token', () => {
    const payload = {
      email: 'hacker@random-domain.com',
      name: 'Attacker',
      householdId: 'hh-123',
      role: 'SuperAdmin',
    };

    const token = signAppSessionToken(payload, 30);
    const verified = verifyAppSessionToken(token);

    expect(verified).not.toBeNull();
    // Non-superadmin email MUST be downgraded to Member
    expect(verified?.role).toBe('Member');
  });

  it('rejects an activity POST for a puppy outside the token household with 403', async () => {
    const token = signAppSessionToken(
      { email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Husband' },
      30
    );
    const request = {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      query: {},
      body: { puppyId: 'pup-other-household', type: 'pee', timestamp: '2026-08-17T12:00:00.000Z' },
    } as any;
    const response: any = {
      statusCode: 200,
      body: null,
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        response.statusCode = code;
        return response;
      }),
      json: vi.fn((data: unknown) => {
        response.body = data;
        return response;
      }),
    };

    await activitiesHandler(request, response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Puppy not found in your household' });
    expect(dbMock.insert).not.toHaveBeenCalled();
    // The ownership lookup is scoped to the requested puppy AND the household carried by the token
    const ownershipQuery = new PgDialect().sqlToQuery(dbMock.whereByTable.get('puppies')!);
    expect(ownershipQuery.sql).toBe('("puppies"."id" = $1 and "puppies"."household_id" = $2)');
    expect(ownershipQuery.params).toEqual(['pup-other-household', 'hh-family-123']);
  });

  describe('verifyAuth Request Middleware', () => {
    it('authenticates valid Bearer App Session Token on 0ms fast path', async () => {
      const payload = {
        email: 'user@example.com',
        name: 'Matthieu',
        householdId: 'hh-family-123',
        role: 'Husband',
      };
      const token = signAppSessionToken(payload, 30);
      const mockReq = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const auth = await verifyAuth(mockReq);
      expect(auth).toBeDefined();
      expect(auth.email).toBe('user@example.com');
      expect(auth.householdId).toBe('hh-family-123');
    });

    it('rejects requests with missing Authorization header with status 401', async () => {
      const mockReq = {
        headers: {},
      } as any;

      await expect(verifyAuth(mockReq)).rejects.toEqual({
        status: 401,
        message: 'Missing Authorization header',
      });
    });

    it('rejects requests with non-Bearer Authorization header with status 401', async () => {
      const mockReq = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      } as any;

      await expect(verifyAuth(mockReq)).rejects.toEqual({
        status: 401,
        message: 'Missing Authorization header',
      });
    });
  });
  describe('S1: every request re-reads the users row', () => {
    const memberToken = () =>
      signAppSessionToken({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Husband' }, 30);

    it('(1a) rejects a valid token whose email has no users row with 401', async () => {
      dbMock.rowsByTable.users = [];
      const response = createMockResponse();

      await dogsHandler(bearerRequest(memberToken()), response);

      expect(response.statusCode).toBe(401);
      const lookup = new PgDialect().sqlToQuery(dbMock.whereByTable.get('users')!);
      expect(lookup.sql).toBe('"users"."email" = $1');
      expect(lookup.params).toEqual(['user@example.com']);
    });

    it('rejects a valid token whose users row is not ACTIVE with 401', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, status: 'PENDING_APPROVAL' }];

      await expect(verifyAuth(bearerRequest(memberToken()))).rejects.toMatchObject({ status: 401 });
    });

    it('(1c) returns 500, not 401, when the users lookup fails (a Neon cold start must not log anyone out)', async () => {
      dbMock.usersLookupError = new Error('fetch failed');
      const response = createMockResponse();

      await dogsHandler(bearerRequest(memberToken()), response);

      expect(response.statusCode).toBe(500);
      // The driver error (SQL text, columns, the caller's email) never reaches the client.
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('takes householdId and role from the users row, not from the token', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, householdId: 'hh-moved', role: 'Sitter' }];

      const auth = await verifyAuth(bearerRequest(memberToken()));

      expect(auth).toMatchObject({ email: 'user@example.com', householdId: 'hh-moved', role: 'Sitter' });
    });

    it('never grants SuperAdmin from a users row role when the email is not the SuperAdmin email', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role: 'SuperAdmin' }];

      const auth = await verifyAuth(bearerRequest(memberToken()));

      expect(auth.role).toBe('Member');
    });

    it('exempts the SuperAdmin email from the users-row check', async () => {
      dbMock.rowsByTable.users = [];
      const token = signAppSessionToken(
        { email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin' },
        30
      );

      const auth = await verifyAuth(bearerRequest(token));

      expect(auth).toMatchObject({ householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin' });
    });

    it('does not exempt a token that only claims the SuperAdmin role', async () => {
      dbMock.rowsByTable.users = [];
      const token = signAppSessionToken(
        { email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'SuperAdmin' },
        30
      );

      await expect(verifyAuth(bearerRequest(token))).rejects.toMatchObject({ status: 401 });
    });
  });

  // Improvement backlog 32: one Neon round trip less at each app start and each log
  describe('database round trips', () => {
    const memberToken = () =>
      signAppSessionToken({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Husband' }, 30);
    const usersLookups = () => dbMock.selects.filter((select) => select.table === 'users').length;

    it('verifyAuth takes the name from the users row, not from the token', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, name: 'Matthieu J.' }];

      expect((await verifyAuth(bearerRequest(memberToken()))).name).toBe('Matthieu J.');
    });

    it('POST /api/auth/session refreshes the name, household and role from a single users lookup', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, name: 'Matthieu J.', householdId: 'hh-moved', role: 'Sitter' }];
      const response = createMockResponse();

      await sessionHandler(bearerRequest(memberToken(), 'POST'), response);

      const refreshed = { email: 'user@example.com', name: 'Matthieu J.', householdId: 'hh-moved', role: 'Sitter' };
      expect(response.statusCode).toBe(200);
      expect(response.body.user).toEqual(refreshed);
      expect(verifyAppSessionToken(response.body.sessionToken)).toEqual(refreshed);
      expect(usersLookups()).toBe(1);
    });

    it("POST /api/auth/session still refreshes the owner's household and name (verifyAuth skips the owner's users row)", async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, email: SUPER_ADMIN_EMAIL, name: 'Owner Renamed', householdId: 'hh-owner-moved', role: 'SuperAdmin' }];
      const ownerToken = signAppSessionToken({ email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin' }, 30);
      const response = createMockResponse();

      await sessionHandler(bearerRequest(ownerToken, 'POST'), response);

      expect(response.body.user).toEqual({ email: SUPER_ADMIN_EMAIL, name: 'Owner Renamed', householdId: 'hh-owner-moved', role: 'SuperAdmin' });
      expect(usersLookups()).toBe(1);
    });

    it('POST /api/activities sends the existing-id lookup together with the dog and badge lookups', async () => {
      dbMock.rowsByTable.puppies = [{ id: 'pup-1', householdId: 'hh-family-123' }];
      dbMock.rowsByTable.caretakers = [{ id: 'c-1', householdId: 'hh-family-123', name: 'Matthieu', role: 'Member', color: '#EC4899', email: 'user@example.com' }];
      const response = createMockResponse();

      await activitiesHandler(bearerRequest(memberToken(), 'POST', { id: 'act-1', puppyId: 'pup-1', type: 'pee' }), response);

      expect(response.statusCode).toBe(201);
      // All three go out once verifyAuth's users lookup answered, before any of them answers
      const answeredBeforeSent = Object.fromEntries(dbMock.selects.map((select) => [select.table, select.answeredBefore]));
      expect(answeredBeforeSent).toEqual({ users: 0, puppies: 1, caretakers: 1, activities: 1 });
    });

    describe('POST /api/activities with an id already stored (a log sent again)', () => {
      const stored = { id: 'act-1', householdId: 'hh-family-123', puppyId: 'pup-1', type: 'pee', loggedBy: 'Matthieu' };
      const sendAgain = async () => {
        const response = createMockResponse();
        await activitiesHandler(bearerRequest(memberToken(), 'POST', { id: 'act-1', puppyId: 'pup-1', type: 'pee' }), response);
        return response;
      };

      beforeEach(() => {
        dbMock.rowsByTable.activities = [stored];
        dbMock.rowsByTable.puppies = [{ id: 'pup-1', householdId: 'hh-family-123' }];
      });

      it('returns the stored log with 200 and saves nothing, looking only in the caller household', async () => {
        const response = await sendAgain();

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(stored);
        expect(dbMock.insert).not.toHaveBeenCalled();
        // Another household's log id must never return that household's log
        const lookup = new PgDialect().sqlToQuery(dbMock.whereByTable.get('activities')!);
        expect(lookup.sql).toBe('("activities"."id" = $1 and "activities"."household_id" = $2)');
        expect(lookup.params).toEqual(['act-1', 'hh-family-123']);
      });

      it('still answers 403 first for a dog outside the household', async () => {
        dbMock.rowsByTable.puppies = [];

        const response = await sendAgain();

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({ error: 'Puppy not found in your household' });
      });
    });
  });

  describe('S3: household roles for dog management', () => {
    const tokenFor = (role: string) =>
      signAppSessionToken({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role }, 30);

    it('(1b) lets a Member create a dog (201)', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role: 'Member' }];
      const response = createMockResponse();

      await dogsHandler(bearerRequest(tokenFor('Member'), 'POST', { id: 'dog-new', name: 'Balma', breed: 'Cocker', birthDate: '2026-05-01' }), response);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ id: 'dog-new', householdId: 'hh-family-123', name: 'Balma' });
    });

    it('(1d) forbids a Sitter from deleting a dog (403)', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role: 'Sitter' }];
      const response = createMockResponse();

      await dogsHandler(bearerRequest(tokenFor('Sitter'), 'DELETE', undefined, { id: 'dog-1' }), response);

      expect(response.statusCode).toBe(403);
      expect(dbMock.delete).not.toHaveBeenCalled();
    });

    it('lets a Member add a caretaker (201) but not remove one (403)', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role: 'Member' }];
      const postResponse = createMockResponse();
      const deleteResponse = createMockResponse();

      await householdsHandler(bearerRequest(tokenFor('Member'), 'POST', { id: 'ct-new', name: 'Daria' }), postResponse);
      await householdsHandler(bearerRequest(tokenFor('Member'), 'DELETE', undefined, { id: 'ct-1' }), deleteResponse);

      expect(postResponse.statusCode).toBe(201);
      expect(postResponse.body).toMatchObject({ id: 'ct-new', householdId: 'hh-family-123', name: 'Daria' });
      expect(deleteResponse.statusCode).toBe(403);
      expect(dbMock.delete).not.toHaveBeenCalled();
    });

    it('lets a Member edit a dog (200)', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role: 'Member' }];
      const response = createMockResponse();

      await dogsHandler(bearerRequest(tokenFor('Member'), 'PUT', { id: 'dog-1', name: 'Balma' }), response);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ name: 'Balma' });
    });

    it('lets a Member edit a caretaker (200)', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role: 'Member' }];
      dbMock.rowsByTable.caretakers = [{ id: 'ct-1', householdId: 'hh-family-123', role: 'Member' }];
      const response = createMockResponse();

      await householdsHandler(bearerRequest(tokenFor('Member'), 'PUT', { id: 'ct-1', name: 'Daria' }), response);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ name: 'Daria' });
    });

    it('forbids a Husband from deleting a dog or a caretaker: only the owner (SuperAdmin) deletes (owner decision)', async () => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role: 'Husband' }];
      const dogResponse = createMockResponse();
      const caretakerResponse = createMockResponse();

      await dogsHandler(bearerRequest(tokenFor('Husband'), 'DELETE', undefined, { id: 'dog-1' }), dogResponse);
      await householdsHandler(bearerRequest(tokenFor('Husband'), 'DELETE', undefined, { id: 'ct-1' }), caretakerResponse);

      expect(dogResponse.statusCode).toBe(403);
      expect(caretakerResponse.statusCode).toBe(403);
      expect(dbMock.delete).not.toHaveBeenCalled();
    });

    it('lets the SuperAdmin (recognised by email) delete a dog and a caretaker', async () => {
      const ownerToken = signAppSessionToken({ email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'hh-family-123', role: 'SuperAdmin' }, 30);
      const dogResponse = createMockResponse();
      const caretakerResponse = createMockResponse();

      await dogsHandler(bearerRequest(ownerToken, 'DELETE', undefined, { id: 'dog-1' }), dogResponse);
      await householdsHandler(bearerRequest(ownerToken, 'DELETE', undefined, { id: 'ct-1' }), caretakerResponse);

      expect(dogResponse.statusCode).toBe(200);
      expect(caretakerResponse.statusCode).toBe(200);
      // A dog is only marked deleted (restorable, backlog item 20); a badge is removed
      expect(dbMock.update).toHaveBeenCalledTimes(1);
      expect(dbMock.delete).toHaveBeenCalledTimes(1);
    });
  });

  // loggedBy is stored as a badge name and resolved by the badge email first, so a badge email is an identity.
  describe('badge links to a login (22): one badge per email and per name, only an admin links someone else', () => {
    const tokenFor = (role: string) =>
      signAppSessionToken({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role }, 30);
    const ownerBadge = { id: 'ct-owner', householdId: 'hh-family-123', name: 'Owner', role: 'Member', color: '#EC4899', email: 'owner@example.com' };
    const freeBadge = { id: 'ct-free', householdId: 'hh-family-123', name: 'Guest', role: 'Member', color: '#10B981', email: null };
    const myBadge = { id: 'ct-me', householdId: 'hh-family-123', name: 'Me', role: 'Member', color: '#F59E0B', email: 'user@example.com' };

    const send = async (role: string, method: 'POST' | 'PUT', body: unknown) => {
      dbMock.rowsByTable.users = [{ ...activeUserRow, role }];
      const response = createMockResponse();
      await householdsHandler(bearerRequest(tokenFor(role), method, body), response);
      return response;
    };

    it("refuses (403) a member writing their email onto someone else's badge, or someone else's email onto a new badge", async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge, freeBadge];

      expect((await send('Member', 'PUT', { id: 'ct-owner', name: 'Owner', email: 'user@example.com' })).statusCode).toBe(403);
      expect((await send('Member', 'POST', { name: 'Someone', email: 'other@example.com' })).statusCode).toBe(403);
      expect(dbMock.update).not.toHaveBeenCalled();
      expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it("refuses (409) a badge name another badge already uses, ignoring case", async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge, freeBadge];

      expect((await send('Member', 'POST', { name: 'owner', email: 'user@example.com' })).statusCode).toBe(409);
      expect((await send('Member', 'PUT', { id: 'ct-free', name: 'OWNER' })).statusCode).toBe(409);
      expect(dbMock.update).not.toHaveBeenCalled();
      expect(dbMock.insert).not.toHaveBeenCalled();
    });

    // Else a member renames Daria's badge away, takes 'Daria' for their own badge and logs as Daria.
    it("refuses (403) a member renaming a badge linked to someone else's login; their own and unlinked badges stay editable", async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge, freeBadge, myBadge];

      expect((await send('Member', 'PUT', { id: 'ct-owner', name: 'Owner (old)' })).statusCode).toBe(403);
      expect(dbMock.update).not.toHaveBeenCalled();
      expect((await send('Member', 'PUT', { id: 'ct-owner', name: 'Owner', color: '#000000' })).statusCode).toBe(200);
      expect((await send('Member', 'PUT', { id: 'ct-me', name: 'Me again' })).statusCode).toBe(200);
      expect((await send('Member', 'PUT', { id: 'ct-free', name: 'Guest 2' })).statusCode).toBe(200);
      expect((await send('Admin', 'PUT', { id: 'ct-owner', name: 'Owner (old)' })).statusCode).toBe(200);
    });

    it('still lets a member edit a badge that already shared its name before this rule, as long as the name stays', async () => {
      dbMock.rowsByTable.caretakers = [freeBadge, { ...freeBadge, id: 'ct-twin' }];

      expect((await send('Member', 'PUT', { id: 'ct-twin', name: 'Guest', color: '#000000' })).statusCode).toBe(200);
    });

    it('lets a member claim an unlinked badge ("This is me"), storing the email in lower case', async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge, freeBadge];

      const response = await send('Member', 'PUT', { id: 'ct-free', name: 'Guest', email: 'USER@example.com' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ email: 'user@example.com' });
    });

    // Else the member's next log creates a second badge and leaves this one linked to nobody (decision 2026-10-15).
    it('refuses (403) a member unlinking any badge, their own included; an admin may', async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge, myBadge];

      expect((await send('Member', 'PUT', { id: 'ct-owner', name: 'Owner', email: '' })).statusCode).toBe(403);
      expect((await send('Member', 'PUT', { id: 'ct-me', name: 'Me', email: '' })).statusCode).toBe(403);
      expect(dbMock.update).not.toHaveBeenCalled();
      const response = await send('Admin', 'PUT', { id: 'ct-me', name: 'Me', email: '' });
      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ email: null });
    });

    it('refuses (409) an email another badge already carries, even for an admin', async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge, freeBadge];

      expect((await send('Admin', 'POST', { name: 'Jane', email: 'OWNER@example.com' })).statusCode).toBe(409);
      expect((await send('Member', 'PUT', { id: 'ct-free', name: 'Guest', email: 'user@example.com' })).statusCode).toBe(200);
      dbMock.rowsByTable.caretakers = [ownerBadge, freeBadge, myBadge];
      expect((await send('Member', 'PUT', { id: 'ct-free', name: 'Guest', email: 'user@example.com' })).statusCode).toBe(409);
    });

    // The app shows its own translated message for each, not the English error
    it('names each refusal with a code: a taken name, a taken or foreign email, an admin-only change', async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge, freeBadge, myBadge];

      expect((await send('Member', 'PUT', { id: 'ct-free', name: 'OWNER' })).body).toMatchObject({ code: 'memberNameTaken' });
      expect((await send('Admin', 'POST', { name: 'Jane', email: 'OWNER@example.com' })).body).toMatchObject({ code: 'memberEmailTaken' });
      expect((await send('Member', 'POST', { name: 'Someone', email: 'other@example.com' })).body).toMatchObject({ code: 'memberEmailTaken' });
      expect((await send('Member', 'PUT', { id: 'ct-owner', name: 'Owner (old)' })).body).toMatchObject({ code: 'memberAdminOnly' });
      expect((await send('Member', 'PUT', { id: 'ct-me', name: 'Me', email: '' })).body).toMatchObject({ code: 'memberAdminOnly' });
    });

    it("lets an admin link a new badge to someone else's email (invite)", async () => {
      dbMock.rowsByTable.caretakers = [ownerBadge];

      const response = await send('Admin', 'POST', { id: 'c-1', name: 'Jane', color: '#10B981', email: 'Jane.Doe@example.com' });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ name: 'Jane', email: 'jane.doe@example.com' });
    });

    // Every Members-tab invite comes from the owner, the only token that keeps the SuperAdmin role.
    it("lets the owner (SuperAdmin) link a new badge to someone else's email (invite)", async () => {
      dbMock.rowsByTable.users = [];
      dbMock.rowsByTable.caretakers = [ownerBadge];
      const token = signAppSessionToken({ email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'hh-family-123', role: 'SuperAdmin' }, 30);
      const response = createMockResponse();

      await householdsHandler(bearerRequest(token, 'POST', { id: 'c-1', name: 'Jane', email: 'Jane.Doe@example.com' }), response);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ email: 'jane.doe@example.com' });
    });
  });

  describe('/api/dogs input rules (Settings form)', () => {
    const memberToken = () =>
      signAppSessionToken({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Member' }, 30);

    it('PUT accepts null to clear the adult weight and the sex, as the API returns them for a dog without one', async () => {
      const response = createMockResponse();

      await dogsHandler(
        bearerRequest(memberToken(), 'PUT', { id: 'dog-1', name: 'Rex', breed: 'Beagle', expectedAdultWeightKg: null, gender: null, notes: '' }),
        response
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ expectedAdultWeightKg: null, gender: null, notes: '' });
    });

    it.each([
      ['POST', { id: 'dog-new', name: 'Rex', breed: 'Beagle', birthDate: '2026-05-01', dailyFoodGramGoal: 0 }, 0],
      ['PUT', { id: 'dog-1', dailyFoodGramGoal: 0 }, 0],
      ['PUT', { id: 'dog-1', dailyFoodGramGoal: 10 }, 10],
      ['PUT', { id: 'dog-1', dailyFoodGramGoal: 2000 }, 2000],
    ])('%s stores the gram goal as sent (0 = no gram goal, count meals only): %j', async (method, body, storedGoal) => {
      const response = createMockResponse();

      await dogsHandler(bearerRequest(memberToken(), method, body), response);

      expect(response.statusCode).toBeLessThan(300);
      expect(response.body.dailyFoodGramGoal).toBe(storedGoal);
    });

    it.each([
      ['POST without a birth date', 'POST', { id: 'dog-new', name: 'Rex', breed: 'Beagle' }],
      ['POST with a future birth date', 'POST', { id: 'dog-new', name: 'Rex', breed: 'Beagle', birthDate: '2099-01-01' }],
      ['PUT with an emptied birth date', 'PUT', { id: 'dog-1', birthDate: '' }],
      ['PUT with an impossible date', 'PUT', { id: 'dog-1', birthDate: '2026-02-31' }],
      ['0 meals a day', 'PUT', { id: 'dog-1', targetMealsPerDay: 0 }],
      ['7 meals a day', 'PUT', { id: 'dog-1', targetMealsPerDay: 7 }],
      ['2.5 meals a day', 'PUT', { id: 'dog-1', targetMealsPerDay: 2.5 }],
      ['a 5 g goal', 'PUT', { id: 'dog-1', dailyFoodGramGoal: 5 }],
      ['a 2001 g goal', 'PUT', { id: 'dog-1', dailyFoodGramGoal: 2001 }],
      ['a 150.5 g goal', 'PUT', { id: 'dog-1', dailyFoodGramGoal: 150.5 }],
      ['a negative goal', 'POST', { id: 'dog-new', name: 'Rex', breed: 'Beagle', birthDate: '2026-05-01', dailyFoodGramGoal: -5 }],
      // No made-up 'Unknown' breed: the form requires one
      ['POST without a breed', 'POST', { id: 'dog-new', name: 'Rex', birthDate: '2026-05-01' }],
      ['POST with a blank breed', 'POST', { id: 'dog-new', name: 'Rex', breed: '   ', birthDate: '2026-05-01' }],
      ['PUT with a blank breed', 'PUT', { id: 'dog-1', breed: '   ' }],
      ['POST with a breed name over 80 characters', 'POST', { id: 'dog-new', name: 'Rex', breed: 'x'.repeat(81), birthDate: '2026-05-01' }],
    ])('refuses %s (400) and writes nothing', async (_case, method, body) => {
      const response = createMockResponse();

      await dogsHandler(bearerRequest(memberToken(), method, body), response);

      expect(response.statusCode).toBe(400);
      expect(dbMock.insert).not.toHaveBeenCalled();
      expect(dbMock.update).not.toHaveBeenCalled();
    });
  });

  describe('session key unchanged: tokens signed today keep working', () => {
    it('verifies a token signed with the POSTGRES_URL-derived key (SESSION_SECRET unset) for an ACTIVE user', async () => {
      delete process.env.SESSION_SECRET;
      const savedPostgresUrl = process.env.POSTGRES_URL;
      process.env.POSTGRES_URL = 'postgres://example.invalid/db';
      // Hermetic: if the token were rejected, verifyAuth would fall back to Google's tokeninfo endpoint.
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
      try {
        // Built by hand with today's derivation, independently of signAppSessionToken.
        const derivedKey = createHmac('sha256', 'puppace-salt-2026').update('postgres://example.invalid/db').digest('hex');
        const issuedAt = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(
          JSON.stringify({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Husband', exp: issuedAt + 86400, iat: issuedAt })
        ).toString('base64url');
        const signature = createHmac('sha256', derivedKey).update(`${header}.${payload}`).digest('base64url');

        const auth = await verifyAuth(bearerRequest(`${header}.${payload}.${signature}`));

        expect(auth).toEqual({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Husband' });
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
        if (savedPostgresUrl === undefined) delete process.env.POSTGRES_URL;
        else process.env.POSTGRES_URL = savedPostgresUrl;
      }
    });
  });

  // Improvement backlog 6: SESSION_SECRET signs new tokens, and a token signed with the old key
  // (derived from POSTGRES_URL) still works until its renewal, so nobody is signed out.
  describe('session key: SESSION_SECRET, with the POSTGRES_URL-derived key still accepted', () => {
    const sessionSecret = 'test-secret-key-1234567890-very-secure';
    const deriveLegacyKey = (postgresUrl: string) => createHmac('sha256', 'puppace-salt-2026').update(postgresUrl).digest('hex');
    const legacyKey = deriveLegacyKey('postgres://example.invalid/db');
    const memberClaims = { email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Husband' };
    const signatureWith = (key: string, signedPart: string) => createHmac('sha256', key).update(signedPart).digest('base64url');
    // Built by hand, independently of signAppSessionToken
    const tokenSignedWith = (key: string) => {
      const issuedAt = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ ...memberClaims, exp: issuedAt + 86400, iat: issuedAt })).toString('base64url');
      return `${header}.${payload}.${signatureWith(key, `${header}.${payload}`)}`;
    };
    const isSignedWith = (token: string, key: string) => {
      const [header, payload, signature] = token.split('.');
      return signature === signatureWith(key, `${header}.${payload}`);
    };
    // Produced by today's code (no SESSION_SECRET, POSTGRES_URL above, issued 2026-10-15 08:00 UTC, 90 days)
    const pinnedLegacyToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJuYW1lIjoiTWF0dGhpZXUiLCJob3VzZWhvbGRJZCI6ImhoLWZhbWlseS0xMjMiLCJyb2xlIjoiSHVzYmFuZCIsImV4cCI6MTc5OTgyNzIwMCwiaWF0IjoxNzkyMDUxMjAwfQ.wrLMJ3Lx_mrXGAaJw5dgFDzTWczl29GwnBTzFGRV7Gk';
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.stubEnv('POSTGRES_URL', 'postgres://example.invalid/db');
      vi.stubEnv('AUTH_SECRET', undefined);
      // Hermetic: a refused token falls back to Google's tokeninfo endpoint, which refuses it too
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
    });

    afterEach(() => {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it('without SESSION_SECRET, signs and verifies with the derived key exactly as before', () => {
      vi.stubEnv('SESSION_SECRET', undefined);
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 15, 8));
      try {
        const token = signAppSessionToken(memberClaims, 90);

        expect(token).toBe(pinnedLegacyToken);
        expect(verifyAppSessionToken(pinnedLegacyToken)).toEqual(memberClaims);
      } finally {
        dateSpy.mockRestore();
      }
    });

    it('with SESSION_SECRET, accepts a token signed with the derived key, and its renewal is signed with SESSION_SECRET only', async () => {
      const legacyToken = tokenSignedWith(legacyKey);

      expect(await verifyAuth(bearerRequest(legacyToken))).toEqual(memberClaims);

      const response = createMockResponse();
      await sessionHandler(bearerRequest(legacyToken, 'POST'), response);

      expect(response.statusCode).toBe(200);
      expect(isSignedWith(response.body.sessionToken, sessionSecret)).toBe(true);
      expect(isSignedWith(response.body.sessionToken, legacyKey)).toBe(false);
      expect(verifyAppSessionToken(response.body.sessionToken)).toEqual(memberClaims);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['with SESSION_SECRET', sessionSecret],
      ['without SESSION_SECRET', undefined],
    ])('refuses a token signed with an unrelated key (401) %s', async (_case, secret) => {
      vi.stubEnv('SESSION_SECRET', secret);
      const token = tokenSignedWith('an-unrelated-key');
      const response = createMockResponse();

      await sessionHandler(bearerRequest(token, 'POST'), response);

      expect(verifyAppSessionToken(token)).toBeNull();
      expect(response.statusCode).toBe(401);
    });

    it('in a preview (SESSION_SECRET, no POSTGRES_URL, PREVIEW_POSTGRES_URL): new tokens work, derived-key tokens are refused', async () => {
      vi.stubEnv('POSTGRES_URL', undefined);
      vi.stubEnv('VERCEL_ENV', 'preview');
      vi.stubEnv('PREVIEW_POSTGRES_URL', 'postgres://preview.example.invalid/db');
      const newToken = signAppSessionToken(memberClaims, 90);
      const legacyToken = tokenSignedWith(legacyKey);
      const response = createMockResponse();

      await sessionHandler(bearerRequest(legacyToken, 'POST'), response);

      expect(await verifyAuth(bearerRequest(newToken))).toEqual(memberClaims);
      expect(verifyAppSessionToken(legacyToken)).toBeNull();
      // The preview database URL is never a session key
      expect(verifyAppSessionToken(tokenSignedWith(deriveLegacyKey('postgres://preview.example.invalid/db')))).toBeNull();
      // Without POSTGRES_URL there is no derived key, not one derived from an empty string
      expect(verifyAppSessionToken(tokenSignedWith(deriveLegacyKey('')))).toBeNull();
      expect(response.statusCode).toBe(401);
    });

    it('with neither a secret nor POSTGRES_URL, refuses to sign and accepts no token', () => {
      vi.stubEnv('SESSION_SECRET', undefined);
      vi.stubEnv('POSTGRES_URL', undefined);

      expect(() => signAppSessionToken(memberClaims, 90)).toThrow(/SESSION_SECRET or AUTH_SECRET/);
      expect(verifyAppSessionToken(tokenSignedWith(''))).toBeNull();
      expect(verifyAppSessionToken(tokenSignedWith(deriveLegacyKey('')))).toBeNull();
    });
  });
});
