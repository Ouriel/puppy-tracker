import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import handler from '../../../api/dashboard.js';
import { signAppSessionToken } from '../../../api/_auth.js';
import { calculatePredictions } from '../predictions';

// Mock Neon & Drizzle DB queries so handler tests run hermetically without external network
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

const mockPuppies = [
  { id: 'pup-1', householdId: 'hh-123', name: 'Pistache', breed: 'Cocker', birthDate: '2026-04-03' },
];
const mockCaretakers = [
  { id: 'ct-1', householdId: 'hh-123', name: 'Sam', role: 'Husband' },
];
const mockActivities = [
  {
    id: 'act-1',
    householdId: 'hh-123',
    puppyId: 'pup-1',
    type: 'pee',
    timestamp: new Date('2026-08-30T10:00:00.000Z'),
    loggedBy: 'Sam',
  },
];
const mockHealthRecords = [
  {
    id: 'hr-1',
    householdId: 'hh-123',
    puppyId: 'pup-1',
    type: 'vaccination',
    name: 'Rabies',
    date: '2026-08-01',
  },
];

function rowsByTable(): Record<string, unknown[]> {
  return {
    users: [{ id: 'usr-1', email: 'sam@example.com', name: 'Sam', householdId: 'hh-123', role: 'Husband', status: 'ACTIVE' }],
    puppies: mockPuppies,
    caretakers: mockCaretakers,
    activities: dbMock.activities ?? mockActivities,
    health_records: mockHealthRecords,
  };
}

// WHERE clause received by each table's query, to check household scoping; activity rows to serve instead of the default.
const dbMock = vi.hoisted(() => ({ whereByTable: new Map<string, SQL>(), wheres: [] as SQL[], batchSizes: [] as number[], activities: null as unknown[] | null }));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName, getTableColumns } = await import('drizzle-orm');
  const { PgDialect } = await import('drizzle-orm/pg-core');
  const dialect = new PgDialect();
  // Like Postgres: rows come back in insertion order, sorted only by the query's ORDER BY.
  const sortRows = (table: Table, rows: any[], clauses: SQL[]) => {
    const columns = Object.entries(getTableColumns(table));
    const sortKeys = clauses.map((clause) => {
      const [, columnName, direction] = dialect.sqlToQuery(clause).sql.match(/"(\w+)" (asc|desc)$/)!;
      const [key] = columns.find(([, column]) => column.name === columnName)!;
      return { key, sign: direction === 'desc' ? -1 : 1 };
    });
    return [...rows].sort((rowA, rowB) => {
      for (const { key, sign } of sortKeys) {
        const difference = Number(rowA[key]) - Number(rowB[key]);
        if (difference) return sign * difference;
      }
      return 0;
    });
  };
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => {
          const tableName = getTableName(table);
          let orderClauses: SQL[] = [];
          let whereParams: unknown[] = [];
          // Like the WHERE clause: a query for type 'weight' gets only the weight rows
          const matchesType = (row: any) => !whereParams.includes('weight') || row.type === 'weight';
          const rows = () => sortRows(table, rowsByTable()[tableName].filter(matchesType), orderClauses);
          const queryChain: any = {
            where: vi.fn((condition: SQL) => {
              dbMock.whereByTable.set(tableName, condition);
              dbMock.wheres.push(condition);
              whereParams = dialect.sqlToQuery(condition).params;
              return queryChain;
            }),
            orderBy: vi.fn((...clauses: SQL[]) => {
              orderClauses = clauses;
              return queryChain;
            }),
            limit: vi.fn(() => Promise.resolve(rows())),
            then: (resolve: any) => resolve(rows()),
          };
          return queryChain;
        }),
      })),
      batch: vi.fn((queries: any[]) => {
        dbMock.batchSizes.push(queries.length);
        return Promise.all(queries);
      }),
    })),
  };
});

describe('Dashboard API Serverless Handler Unit Tests', () => {
  const originalEnv = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.activities = null;
    dbMock.wheres = [];
    dbMock.batchSizes = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalEnv;
  });

  function createMockResponse() {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: null,
      status: vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn((data: any) => {
        res.body = data;
        return res;
      }),
      setHeader: vi.fn((key: string, value: string) => {
        res.headers[key.toLowerCase()] = value;
        return res;
      }),
      end: vi.fn(() => res),
    };
    return res;
  }

  it('handles OPTIONS preflight with status 200 and end()', async () => {
    const req: any = {
      method: 'OPTIONS',
      headers: {},
      query: {},
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('rejects unsupported HTTP methods (POST, PUT, DELETE) with 405 Method Not Allowed', async () => {
    const req: any = {
      method: 'POST',
      headers: {},
      query: {},
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });

  it('rejects requests with missing Authorization header with status 401', async () => {
    const req: any = {
      method: 'GET',
      headers: {},
      query: {},
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: 'Missing Authorization header' });
  });

  it('rejects requests with invalid or tampered Authorization token with status 401', async () => {
    // Not an app session token, so verifyAuth falls back to Google's tokeninfo endpoint: stub it.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_token' }), { status: 400 })
    );
    try {
      const req: any = {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid.token.signature',
        },
        query: {},
      };
      const res = createMockResponse();

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('authenticates valid session token and serves dashboard payload with healthRecords', async () => {
    const validToken = signAppSessionToken({
      email: 'sam@example.com',
      name: 'Sam',
      householdId: 'hh-123',
      role: 'Husband',
    }, 30);

    const req: any = {
      method: 'GET',
      headers: {
        authorization: `Bearer ${validToken}`,
      },
      query: {
        puppyId: 'pup-1',
        days: '14',
      },
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      puppies: mockPuppies,
      deletedPuppies: [],
      caretakers: mockCaretakers,
      activities: [{ ...mockActivities[0], timestamp: '2026-08-30T10:00:00.000Z' }],
      healthRecords: mockHealthRecords,
      weightActivities: [],
    });

    // Every query is scoped to the household carried by the session token
    const dialect = new PgDialect();
    for (const tableName of ['puppies', 'caretakers', 'activities', 'health_records']) {
      const condition = dbMock.whereByTable.get(tableName);
      expect(condition).toBeDefined();
      const query = dialect.sqlToQuery(condition!);
      expect(query.sql).toContain(`"${tableName}"."household_id" = $1`);
      expect(query.params[0]).toBe('hh-123');
    }
  });

  it('two poops in the same minute: the one logged last comes first, so a diarrhoea stool logged after a normal one gives the digestive alert', async () => {
    const sameMinute = new Date('2026-08-30T10:00:00.000Z');
    const poop = (id: string, stoolConsistency: string, createdAt: string) => ({
      id, householdId: 'hh-123', puppyId: 'pup-1', type: 'poop', timestamp: sameMinute, loggedBy: 'Sam', stoolConsistency, createdAt: new Date(createdAt),
    });
    dbMock.activities = [poop('act-normal', 'normal', '2026-08-30T10:00:20.000Z'), poop('act-diarrhea', 'diarrhea', '2026-08-30T10:00:50.000Z')];
    const token = signAppSessionToken({ email: 'sam@example.com', name: 'Sam', householdId: 'hh-123', role: 'Husband' }, 30);
    const res = createMockResponse();

    await handler({ method: 'GET', headers: { authorization: `Bearer ${token}` }, query: { puppyId: 'pup-1', days: '14' } } as any, res);

    const puppy = { id: 'pup-1', name: 'Pistache', breed: 'Cocker', birthDate: '2026-04-03', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
    const predictions = calculatePredictions(res.body.activities, puppy, new Date('2026-08-30T10:30:00.000Z'), 'Europe/Paris');
    expect(predictions.poopReason).toBe('Digestive alert: frequent checks recommended');
    expect(res.body.activities.map((activity: { id: string }) => activity.id)).toEqual(['act-diarrhea', 'act-normal']);
  });

  it('sorts by timestamp first: a back-dated log entered last still comes after newer logs', async () => {
    const log = (id: string, timestamp: string, createdAt: string) => ({
      id, householdId: 'hh-123', puppyId: 'pup-1', type: 'pee', timestamp: new Date(timestamp), loggedBy: 'Sam', createdAt: new Date(createdAt),
    });
    dbMock.activities = [
      log('act-new', '2026-08-30T10:00:00.000Z', '2026-08-30T10:00:05.000Z'),
      log('act-backdated', '2026-08-30T08:00:00.000Z', '2026-08-30T10:30:00.000Z'),
    ];
    const token = signAppSessionToken({ email: 'sam@example.com', name: 'Sam', householdId: 'hh-123', role: 'Husband' }, 30);
    const res = createMockResponse();

    await handler({ method: 'GET', headers: { authorization: `Bearer ${token}` }, query: { puppyId: 'pup-1', days: '14' } } as any, res);

    expect(res.body.activities.map((activity: { id: string }) => activity.id)).toEqual(['act-new', 'act-backdated']);
  });

  it('sends every weight event of the dog, whatever its date, in the same single batch (Phase 5c)', async () => {
    const event = (id: string, type: string, timestamp: string, weightKg?: number) => ({
      id, householdId: 'hh-123', puppyId: 'pup-1', type, timestamp: new Date(timestamp), loggedBy: 'Sam', weightKg, createdAt: new Date(timestamp),
    });
    dbMock.activities = [
      event('act-pee', 'pee', '2026-08-30T10:00:00.000Z'),
      event('act-weight-old', 'weight', '2026-05-10T10:00:00.000Z', 4.4),
      event('act-weight-new', 'weight', '2026-08-20T10:00:00.000Z', 9.1),
    ];
    const token = signAppSessionToken({ email: 'sam@example.com', name: 'Sam', householdId: 'hh-123', role: 'Husband' }, 30);
    const res = createMockResponse();

    await handler({ method: 'GET', headers: { authorization: `Bearer ${token}` }, query: { puppyId: 'pup-1', days: '14' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dbMock.batchSizes).toEqual([5]);
    expect(res.body.weightActivities.map((activity: { id: string; timestamp: string }) => [activity.id, activity.timestamp])).toEqual([
      ['act-weight-new', '2026-08-20T10:00:00.000Z'],
      ['act-weight-old', '2026-05-10T10:00:00.000Z'],
    ]);
    // The weight query: this household and dog, type 'weight', no date bound
    const weightQuery = dbMock.wheres.map((condition) => new PgDialect().sqlToQuery(condition)).find((query) => query.params.includes('weight'))!;
    expect(weightQuery.sql).toContain('"activities"."household_id" = $1');
    expect(weightQuery.sql).toContain('"activities"."puppy_id"');
    expect(weightQuery.sql).not.toContain('"activities"."timestamp"');
    expect(weightQuery.params).toEqual(['hh-123', 'weight', 'pup-1']);
  });
});
