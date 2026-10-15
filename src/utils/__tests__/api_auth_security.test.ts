import { createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken, verifyAppSessionToken, verifyAuth } from '../../../api/_auth.js';
import activitiesHandler from '../../../api/activities.js';
import dogsHandler from '../../../api/dogs.js';
import householdsHandler from '../../../api/households.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

// Hermetic DB: rows are served per table (no puppy matches the ownership lookup by default),
// and every WHERE clause and insert is recorded.
const dbMock = vi.hoisted(() => ({
  whereByTable: new Map<string, SQL>(),
  rowsByTable: {} as Record<string, unknown[]>,
  usersLookupError: null as Error | null,
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
  neonConfig: { fetchConnectionCache: false },
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
            if (tableName === 'users' && dbMock.usersLookupError) return Promise.reject(dbMock.usersLookupError);
            return Promise.resolve(dbMock.rowsByTable[tableName] ?? []);
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
      expect(dbMock.delete).toHaveBeenCalledTimes(2);
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
      ['a negative goal', 'POST', { id: 'dog-new', name: 'Rex', birthDate: '2026-05-01', dailyFoodGramGoal: -5 }],
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
});
