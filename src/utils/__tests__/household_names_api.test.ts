import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken } from '../../../api/_auth.js';
import householdsHandler from '../../../api/households.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

// Hermetic DB: rows are filtered by every `"column" = $n` of the WHERE; upserts are recorded.
const dbMock = vi.hoisted(() => ({
  households: [] as Array<Record<string, unknown>>,
  users: [] as Array<Record<string, unknown>>,
  caretakers: [] as Array<Record<string, unknown>>,
  upserts: [] as Array<{ values: Record<string, unknown>; set: Record<string, unknown> }>,
}));

vi.mock('@neondatabase/serverless', () => ({ neon: vi.fn(() => vi.fn()) }));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  const rowsOf = (table: Table) =>
    ({ households: dbMock.households, users: dbMock.users, caretakers: dbMock.caretakers })[getTableName(table)] ?? [];
  const matching = (rows: Array<Record<string, unknown>>, condition: SQL) => {
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    return rows.filter((row) =>
      [...sql.matchAll(/"(\w+)" = \$(\d+)/g)].every(([, column, index]) => {
        const field = column.replace(/_(\w)/g, (_match, letter: string) => letter.toUpperCase());
        return row[field] === params[Number(index) - 1];
      })
    );
  };
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn((fields?: Record<string, unknown>) => ({
        from: vi.fn((table: Table) => {
          // Only the selected columns, as Postgres returns them
          const pick = (rows: Array<Record<string, unknown>>) =>
            fields ? rows.map((row) => Object.fromEntries(Object.keys(fields).map((key) => [key, row[key]]))) : rows;
          return Object.assign(Promise.resolve(pick(rowsOf(table))), {
            where: (condition: SQL) => {
              const found = Promise.resolve(pick(matching(rowsOf(table), condition)));
              return Object.assign(found, { limit: (count: number) => found.then((rows) => rows.slice(0, count)) });
            },
          });
        }),
      })),
      selectDistinct: vi.fn(() => ({
        from: () => Promise.resolve([...new Set(dbMock.users.map((row) => row.householdId))].map((id) => ({ id }))),
      })),
      insert: vi.fn(() => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => ({
            returning: () => {
              dbMock.upserts.push({ values, set });
              return Promise.resolve([{ id: values.id, name: set.name }]);
            },
          }),
        }),
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

const familyAdmin = { id: 'usr-admin', email: 'admin@example.com', name: 'Family Admin', householdId: 'hh-martin', role: 'Admin', status: 'ACTIVE' };
const as = (identity: { email: string; householdId: string; role: string }, method: string, body?: unknown) => {
  const token = signAppSessionToken({ ...identity, name: 'Someone' }, 30);
  return { method, headers: { authorization: `Bearer ${token}` }, query: { all: 'true' }, body } as any;
};
const asOwner = (method: string, body?: unknown) => as({ email: SUPER_ADMIN_EMAIL, householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin' }, method, body);
const asFamilyAdmin = (method: string, body?: unknown) => as(familyAdmin, method, body);

describe("/api/households?all=true: the owner's household names", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.households = [{ id: 'hh-martin', familyPackId: 'hh-martin', name: 'Famille Martin' }];
    dbMock.users = [
      { id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin', status: 'ACTIVE' },
      familyAdmin,
      { id: 'usr-jane', email: 'jane@example.com', name: 'Jane', householdId: 'house-jane', role: 'Member', status: 'PENDING_APPROVAL' },
    ];
    dbMock.caretakers = [{ id: 'ct-1', householdId: 'hh-martin', name: 'Badge' }];
    dbMock.upserts = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("lists every household: the named ones, then the accounts' households with no name yet, each once", async () => {
    const response = createMockResponse();
    await householdsHandler(asOwner('GET'), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      households: [
        { id: 'hh-martin', name: 'Famille Martin' },
        { id: 'FAMILY-COCKER-2026', name: null },
        { id: 'house-jane', name: null },
      ],
    });
  });

  it('a family Admin asking for every household gets their own badges only', async () => {
    const response = createMockResponse();
    await householdsHandler(asFamilyAdmin('GET'), response);

    expect(response.body).toEqual({ caretakers: dbMock.caretakers });
  });

  it('the owner names a household that has no name yet: its row is created with the trimmed name', async () => {
    const response = createMockResponse();
    await householdsHandler(asOwner('PUT', { id: 'house-jane', name: '  Famille Doe ' }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'house-jane', name: 'Famille Doe' });
    expect(dbMock.upserts).toEqual([{ values: { id: 'house-jane', familyPackId: 'house-jane', name: 'Famille Doe' }, set: { name: 'Famille Doe' } }]);
  });

  it('refuses a family Admin (403), an empty name (400) and a household that does not exist (404), writing nothing', async () => {
    for (const [request, status] of [
      [asFamilyAdmin('PUT', { id: 'hh-martin', name: 'Mine now' }), 403],
      [asOwner('PUT', { id: 'hh-martin', name: '   ' }), 400],
      [asOwner('PUT', { id: 'house-nobody', name: 'Ghost' }), 404],
    ] as const) {
      const response = createMockResponse();
      await householdsHandler(request, response);
      expect(response.statusCode).toBe(status);
    }
    expect(dbMock.upserts).toEqual([]);
  });
});
