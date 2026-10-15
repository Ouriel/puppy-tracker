import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sql, type SQL, type Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken } from '../../../api/_auth.js';
import activitiesHandler from '../../../api/activities.js';
import dogsHandler from '../../../api/dogs.js';
import usersHandler from '../../../api/users.js';
import healthRecordsHandler from '../../../api/health-records.js';
import householdsHandler from '../../../api/households.js';
import { createActivity } from '../../services/api';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// Like Postgres behind drizzle: a negative LIMIT/OFFSET fails, and drizzle's error message
// carries the SQL text and its parameters.
const dbMock = vi.hoisted(() => ({
  selectCount: 0,
  failAfterAuth: false,
  limit: null as number | null,
  offset: null as number | null,
  orderBy: [] as SQL[],
  insertedValues: [] as Array<Record<string, unknown>>,
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  const leakingError = (tableName: string) =>
    new Error(`Failed query: select "id", "household_id" from "${tableName}" where "household_id" = $1 offset $2\nparams: hh-family-123,-5`);
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => {
          const tableName = getTableName(table);
          dbMock.selectCount += 1;
          // The first select of a request is verifyAuth's users lookup.
          const isAuthLookup = dbMock.selectCount === 1;
          const rows = isAuthLookup
            ? [{ id: 'usr-1', email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Admin', status: 'ACTIVE' }]
            : tableName === 'puppies' ? [{ id: 'pup-1', householdId: 'hh-family-123' }] : [];
          const run = () => {
            const isNegative = (dbMock.limit ?? 0) < 0 || (dbMock.offset ?? 0) < 0;
            if (!isAuthLookup && (dbMock.failAfterAuth || isNegative)) return Promise.reject(leakingError(tableName));
            return Promise.resolve(rows);
          };
          const query = {
            where: () => query,
            orderBy: (...clauses: SQL[]) => { dbMock.orderBy = clauses; return query; },
            limit: (value: number) => { dbMock.limit = value; return query; },
            offset: (value: number) => { dbMock.offset = value; return query; },
            then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => run().then(resolve, reject),
          };
          return query;
        }),
      })),
      insert: vi.fn(() => ({
        values: (values: Record<string, unknown>) => {
          dbMock.insertedValues.push(values);
          return { returning: () => Promise.resolve([values]) };
        },
      })),
    })),
  };
});

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

function getRequest(query: Record<string, string> = {}, method = 'GET', body?: unknown) {
  const token = signAppSessionToken({ email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Admin' }, 30);
  return { method, headers: { authorization: `Bearer ${token}` }, query, body } as any;
}

describe('API input, error and pagination hardening', () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.selectCount = 0;
    dbMock.failAfterAuth = false;
    dbMock.limit = null;
    dbMock.offset = null;
    dbMock.orderBy = [];
    dbMock.insertedValues = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
    vi.restoreAllMocks();
  });

  it('a negative offset never reaches SQL and puts no SQL in the response body', async () => {
    const response = createMockResponse();
    await activitiesHandler(getRequest({ offset: '-5' }), response);
    expect(JSON.stringify(response.body)).not.toMatch(/select|params/i);
    expect(response.statusCode).toBe(200);
    expect(dbMock.offset ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('a negative, zero or non-numeric limit falls back to the default page size', async () => {
    for (const limit of ['-5', '0', 'abc']) {
      dbMock.selectCount = 0;
      const response = createMockResponse();
      await activitiesHandler(getRequest({ limit }), response);
      expect(response.statusCode).toBe(200);
      expect(dbMock.limit).toBe(500);
    }
  });

  it('GET /api/activities breaks a same-timestamp tie by created_at, so the log made last comes first', async () => {
    const response = createMockResponse();
    await activitiesHandler(getRequest({ puppyId: 'pup-1' }), response);
    expect(new PgDialect().sqlToQuery(sql.join(dbMock.orderBy, sql`, `)).sql).toBe('"activities"."timestamp" desc, "activities"."created_at" desc');
  });

  it('a limit above the maximum is capped at 1000', async () => {
    const response = createMockResponse();
    await activitiesHandler(getRequest({ limit: '5000' }), response);
    expect(dbMock.limit).toBe(1000);
  });

  it.each([
    ['activities', activitiesHandler, {}],
    ['dogs', dogsHandler, {}],
    ['users', usersHandler, {}],
    ['health-records', healthRecordsHandler, { puppyId: 'pup-1' }],
  ] as const)('/api/%s returns a generic 500 body and logs the real error', async (_name, handler, query) => {
    dbMock.failAfterAuth = true;
    const response = createMockResponse();
    await handler(getRequest(query), response);
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: expect.stringContaining('Failed query') }));
  });

  // N1: a browser-cached GET would hide a log made less than 70 s earlier when the app is refocused.
  it.each([
    ['activities', activitiesHandler, {}],
    ['dogs', dogsHandler, {}],
    ['users', usersHandler, {}],
    ['health-records', healthRecordsHandler, { puppyId: 'pup-1' }],
    ['households', householdsHandler, {}],
  ] as const)('GET /api/%s is sent with Cache-Control: no-store, signed in or not', async (_name, handler, query) => {
    const signedIn = createMockResponse();
    await handler(getRequest(query), signedIn);
    expect(signedIn.statusCode).toBe(200);
    expect(new Map(signedIn.setHeader.mock.calls).get('Cache-Control')).toBe('no-store');

    const signedOut = createMockResponse();
    await handler({ method: 'GET', headers: {}, query } as any, signedOut);
    expect(signedOut.statusCode).toBe(401);
    expect(new Map(signedOut.setHeader.mock.calls).get('Cache-Control')).toBe('no-store');
  });

  it.each(['POST', 'PUT'])('%s /api/activities with an unparseable timestamp returns 400', async (method) => {
    const response = createMockResponse();
    const body = { id: 'act-1', puppyId: 'pup-1', type: 'pee', timestamp: 'not-a-date', loggedBy: 'Daria' };
    await activitiesHandler(getRequest({}, method, body), response);
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Invalid activity payload');
  });

  // 31: in the handler, not in the zod object: PUT parses ActivityInputSchema.partial()
  it.each(['POST', 'PUT'])('%s /api/activities refuses a medication without a name', async (method) => {
    for (const medicationName of [undefined, null, '', '   ']) {
      dbMock.selectCount = 0;
      const response = createMockResponse();
      const body = { id: 'act-1', puppyId: 'pup-1', type: 'medication', timestamp: '2026-10-13T08:00:00.000Z', medicationName };
      await activitiesHandler(getRequest({}, method, body), response);
      expect(response.statusCode, JSON.stringify(medicationName)).toBe(400);
      expect(response.body.error).toBe('medicationName is required');
    }
  });

  it('POST /api/activities saves a named medication', async () => {
    const response = createMockResponse();
    const body = { puppyId: 'pup-1', type: 'medication', timestamp: '2026-10-13T08:00:00.000Z', medicationName: 'Credelio' };
    await activitiesHandler(getRequest({}, 'POST', body), response);
    expect(response.statusCode).toBe(201);
    expect(dbMock.insertedValues[0].medicationName).toBe('Credelio');
  });

  describe('new ids are random UUIDs (S7)', () => {
    it('POST /api/activities without an id stores act-<uuid>', async () => {
      const response = createMockResponse();
      const body = { puppyId: 'pup-1', type: 'pee', timestamp: '2026-10-13T08:00:00.000Z', loggedBy: 'Daria' };
      await activitiesHandler(getRequest({}, 'POST', body), response);
      expect(response.statusCode).toBe(201);
      expect(dbMock.insertedValues[0].id).toMatch(new RegExp(`^act-${UUID}$`));
    });

    it('POST /api/activities keeps an existing client id untouched', async () => {
      const response = createMockResponse();
      const body = { id: 'act-1754000000000', puppyId: 'pup-1', type: 'pee', timestamp: '2026-10-13T08:00:00.000Z' };
      await activitiesHandler(getRequest({}, 'POST', body), response);
      expect(dbMock.insertedValues[0].id).toBe('act-1754000000000');
    });

    it('POST /api/users for a new email stores usr-<uuid>', async () => {
      const response = createMockResponse();
      await usersHandler(getRequest({}, 'POST', { email: 'new.member@example.com', name: 'New' }), response);
      expect(response.statusCode).toBe(201);
      expect(dbMock.insertedValues[0].id).toMatch(new RegExp(`^usr-${UUID}$`));
    });

    it('services/api createActivity sends act-<uuid> when the activity has no id', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 201 })));
      vi.stubGlobal('fetch', fetchMock);
      try {
        await createActivity({ puppyId: 'pup-1', type: 'pee', timestamp: '2026-10-13T08:00:00.000Z', loggedBy: 'Daria' });
        const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
        expect(sent.id).toMatch(new RegExp(`^act-${UUID}$`));
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
