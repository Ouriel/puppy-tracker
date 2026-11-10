import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken } from '../../../api/_auth.js';
import householdsHandler from '../../../api/households.js';

// Hermetic DB: rows are filtered by every `"column" = $n` of the WHERE, and updates change them in place.
const dbMock = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  updatedTables: [] as string[],
  batchSizes: [] as number[],
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  const matching = (table: Table, condition: SQL) => {
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    return (dbMock.tables[getTableName(table)] ?? []).filter((row) =>
      [...sql.matchAll(/"(\w+)" = \$(\d+)/g)].every(([, column, index]) => {
        const field = column.replace(/_(\w)/g, (_match, letter: string) => letter.toUpperCase());
        return row[field] === params[Number(index) - 1];
      })
    );
  };
  // Runs once awaited, alone or in a batch, as drizzle's query builders do
  const lazy = <T,>(run: () => T) => ({
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
  });
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => ({
          where: vi.fn((condition: SQL) => Promise.resolve(matching(table, condition))),
        })),
      })),
      update: vi.fn((table: Table) => ({
        set: (values: Record<string, unknown>) => ({
          where: (condition: SQL) => {
            const run = () => {
              dbMock.updatedTables.push(getTableName(table));
              const defined = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
              return matching(table, condition).map((row) => ({ ...Object.assign(row, defined) }));
            };
            return Object.assign(lazy(run), { returning: () => lazy(run) });
          },
        }),
      })),
      batch: vi.fn((queries: unknown[]) => {
        dbMock.batchSizes.push(queries.length);
        return Promise.all(queries);
      }),
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

const leaAccount = { id: 'usr-lea', email: 'lea@example.com', name: 'Léa Martin', householdId: 'hh-martin', role: 'Member', status: 'ACTIVE' };

function putBadge(body: unknown) {
  const token = signAppSessionToken({ email: leaAccount.email, name: leaAccount.name, householdId: leaAccount.householdId, role: 'Member' }, 30);
  return { method: 'PUT', headers: { authorization: `Bearer ${token}` }, query: {}, body } as any;
}

const loggedByOf = () => Object.fromEntries(dbMock.tables.activities.map((activity) => [activity.id, activity.loggedBy]));

// loggedBy stores the badge name: the timeline finds a log's badge (its colour) by that name.
describe('PUT /api/households: renaming a badge keeps its log history', () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.tables = {
      users: [{ ...leaAccount }],
      caretakers: [
        { id: 'ct-lea', householdId: 'hh-martin', name: 'Léa', role: 'Member', color: '#EC4899', email: leaAccount.email },
        { id: 'ct-paul', householdId: 'hh-martin', name: 'Paul', role: 'Member', color: '#10B981', email: 'paul@example.com' },
      ],
      activities: [
        { id: 'act-lea', householdId: 'hh-martin', loggedBy: 'Léa' },
        { id: 'act-paul', householdId: 'hh-martin', loggedBy: 'Paul' },
        { id: 'act-other-family', householdId: 'hh-dupont', loggedBy: 'Léa' },
      ],
    };
    dbMock.updatedTables = [];
    dbMock.batchSizes = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("renames the badge's logs in the same household only, in the badge's batch", async () => {
    const response = createMockResponse();
    await householdsHandler(putBadge({ id: 'ct-lea', name: 'Léa M.' }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ id: 'ct-lea', name: 'Léa M.' });
    expect(loggedByOf()).toEqual({ 'act-lea': 'Léa M.', 'act-paul': 'Paul', 'act-other-family': 'Léa' });
    expect(dbMock.batchSizes).toEqual([2]);
  });

  it('changes no log when the name stays', async () => {
    const response = createMockResponse();
    await householdsHandler(putBadge({ id: 'ct-lea', name: 'Léa', color: '#000000' }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ id: 'ct-lea', name: 'Léa', color: '#000000' });
    expect(loggedByOf()).toEqual({ 'act-lea': 'Léa', 'act-paul': 'Paul', 'act-other-family': 'Léa' });
    expect(dbMock.updatedTables).toEqual(['caretakers']);
  });

  it('changes no log when the rename is refused (a name another badge has)', async () => {
    const response = createMockResponse();
    await householdsHandler(putBadge({ id: 'ct-lea', name: 'paul' }), response);

    expect(response.statusCode).toBe(409);
    expect(dbMock.updatedTables).toEqual([]);
  });
});
