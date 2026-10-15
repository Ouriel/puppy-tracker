import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import dogsHandler from '../../../api/dogs.js';
import dashboardHandler from '../../../api/dashboard.js';
import activitiesHandler from '../../../api/activities.js';
import healthRecordsHandler from '../../../api/health-records.js';
import { signAppSessionToken } from '../../../api/_auth.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

type Row = Record<string, unknown>;

// One shared in-memory database for every handler: rows per table, and the tables a DELETE reached
const store = vi.hoisted(() => ({ rows: {} as Record<string, Row[]>, deletedFrom: [] as string[] }));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName, getTableColumns } = await import('drizzle-orm');
  const { PgDialect } = await import('drizzle-orm/pg-core');
  const dialect = new PgDialect();
  // Like Postgres for the conditions these handlers send: "col" = $n, "col" is null, "col" is not null (others match every row)
  const matcher = (table: Table, condition?: SQL) => {
    if (!condition) return () => true;
    const { sql, params } = dialect.sqlToQuery(condition);
    const keyOf = Object.fromEntries(Object.entries(getTableColumns(table)).map(([key, column]) => [column.name, key]));
    const checks = [...sql.matchAll(/"(\w+)" (?:= \$(\d+)|(is null)|(is not null))/g)].map(
      ([, column, index, isNull, isNotNull]) =>
        (row: Row) => {
          const value = row[keyOf[column]];
          if (isNull) return value == null;
          if (isNotNull) return value != null;
          return value === params[Number(index) - 1];
        }
    );
    return (row: Row) => checks.every((check) => check(row));
  };
  const rowsOf = (table: Table) => store.rows[getTableName(table)];
  const answer = <T,>(run: () => T) => ({
    returning: () => Promise.resolve(run()),
    onConflictDoNothing: () => ({ returning: () => Promise.resolve(run()) }),
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
  });
  return {
    drizzle: vi.fn(() => ({
      select: () => ({
        from: (table: Table) => {
          let condition: SQL | undefined;
          const chain: any = {
            where: (where: SQL) => {
              condition = where;
              return chain;
            },
            orderBy: () => chain,
            limit: () => chain,
            offset: () => chain,
            ...answer(() => rowsOf(table).filter(matcher(table, condition)).map((row) => ({ ...row }))),
          };
          return chain;
        },
      }),
      update: (table: Table) => ({
        set: (values: Row) => ({
          where: (condition: SQL) =>
            answer(() =>
              rowsOf(table)
                .filter(matcher(table, condition))
                .map((row) => ({ ...Object.assign(row, Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))) }))
            ),
        }),
      }),
      insert: (table: Table) => ({
        values: (values: Row) =>
          answer(() => {
            rowsOf(table).push({ ...values });
            return [{ ...values }];
          }),
      }),
      delete: (table: Table) => ({
        where: (condition: SQL) =>
          answer(() => {
            store.deletedFrom.push(getTableName(table));
            store.rows[getTableName(table)] = rowsOf(table).filter((row) => !matcher(table, condition)(row));
          }),
      }),
      batch: (queries: unknown[]) => Promise.all(queries),
    })),
  };
});

process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
const ownerToken = () => signAppSessionToken({ email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'hh-1', role: 'SuperAdmin' }, 30);
const memberToken = () => signAppSessionToken({ email: 'member@example.com', name: 'Sam', householdId: 'hh-1', role: 'Member' }, 30);

async function call(
  handler: (request: any, response: any) => Promise<unknown>,
  token: string,
  method: string,
  { query = {}, body }: { query?: Record<string, string>; body?: unknown } = {}
) {
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
  await handler({ method, headers: { authorization: `Bearer ${token}` }, query, body }, response);
  return response;
}

const dog = (id: string) => store.rows.puppies.find((puppy) => puppy.id === id)!;
const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);

beforeEach(() => {
  store.deletedFrom = [];
  store.rows = {
    users: [{ id: 'usr-1', email: 'member@example.com', name: 'Sam', householdId: 'hh-1', role: 'Member', status: 'ACTIVE' }],
    puppies: [
      { id: 'dog-1', householdId: 'hh-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-05-01', deletedAt: null },
      { id: 'dog-2', householdId: 'hh-1', name: 'Mia', breed: 'Poodle', birthDate: '2026-04-01', deletedAt: null },
      { id: 'dog-other-deleted', householdId: 'hh-2', name: 'Kiwi', breed: 'Pug', birthDate: '2026-03-01', deletedAt: new Date('2026-10-01T10:00:00Z') },
      { id: 'dog-other', householdId: 'hh-2', name: 'Oslo', breed: 'Husky', birthDate: '2026-02-01', deletedAt: null },
    ],
    caretakers: [{ id: 'ct-1', householdId: 'hh-1', name: 'Sam', role: 'Member', color: '#6366f1', email: 'member@example.com' }],
    activities: [
      { id: 'act-1', householdId: 'hh-1', puppyId: 'dog-1', type: 'pee', timestamp: new Date(), loggedBy: 'Sam', createdAt: new Date() },
    ],
    health_records: [{ id: 'hr-1', householdId: 'hh-1', puppyId: 'dog-1', type: 'vaccination', name: 'Rage', date: '2026-08-01' }],
  };
});

describe('restorable dog delete (backlog item 20)', () => {
  it("the owner's delete marks the dog deleted and keeps its row, its logs and its health records", async () => {
    const response = await call(dogsHandler, ownerToken(), 'DELETE', { query: { id: 'dog-1' } });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true, deletedId: 'dog-1' });
    expect(dog('dog-1').deletedAt).toBeInstanceOf(Date);
    expect(dog('dog-2').deletedAt).toBeNull();
    expect(store.deletedFrom).toEqual([]);
    expect(ids(store.rows.activities as Array<{ id: string }>)).toEqual(['act-1']);
    expect(ids(store.rows.health_records as Array<{ id: string }>)).toEqual(['hr-1']);
  });

  it("a member's delete is still refused (403) and the dog stays", async () => {
    const response = await call(dogsHandler, memberToken(), 'DELETE', { query: { id: 'dog-1' } });

    expect(response.statusCode).toBe(403);
    expect(dog('dog-1').deletedAt).toBeNull();
    expect(store.deletedFrom).toEqual([]);
  });

  it('a deleted dog is absent from the dashboard and GET /api/dogs; only the owner gets it, in deletedPuppies', async () => {
    dog('dog-1').deletedAt = new Date('2026-10-15T10:00:00Z');

    const memberDashboard = await call(dashboardHandler, memberToken(), 'GET');
    const ownerDashboard = await call(dashboardHandler, ownerToken(), 'GET');
    const list = await call(dogsHandler, memberToken(), 'GET');
    const single = await call(dogsHandler, memberToken(), 'GET', { query: { id: 'dog-1' } });

    expect(ids(memberDashboard.body.puppies)).toEqual(['dog-2']);
    expect(memberDashboard.body.deletedPuppies).toEqual([]);
    expect(ids(ownerDashboard.body.puppies)).toEqual(['dog-2']);
    expect(ids(ownerDashboard.body.deletedPuppies)).toEqual(['dog-1']);
    expect(ids(list.body)).toEqual(['dog-2']);
    expect(single.statusCode).toBe(404);
  });

  it('a log or a health record for a deleted dog is refused with 404, and nothing is saved', async () => {
    dog('dog-1').deletedAt = new Date('2026-10-15T10:00:00Z');

    const log = await call(activitiesHandler, memberToken(), 'POST', {
      body: { puppyId: 'dog-1', type: 'pee', timestamp: new Date().toISOString() },
    });
    const record = await call(healthRecordsHandler, memberToken(), 'POST', {
      body: { puppyId: 'dog-1', type: 'vaccination', name: 'Rage', date: '2026-10-01' },
    });

    expect([log.statusCode, record.statusCode]).toEqual([404, 404]);
    expect(store.rows.activities).toHaveLength(1);
    expect(store.rows.health_records).toHaveLength(1);
  });

  it('only the owner restores a dog, and it comes back with its logs and health records', async () => {
    dog('dog-1').deletedAt = new Date('2026-10-15T10:00:00Z');

    const byMember = await call(dogsHandler, memberToken(), 'PUT', { query: { id: 'dog-1', restore: 'true' } });
    expect(byMember.statusCode).toBe(403);
    expect(dog('dog-1').deletedAt).toBeInstanceOf(Date);

    const unknown = await call(dogsHandler, ownerToken(), 'PUT', { query: { id: 'dog-404', restore: 'true' } });
    expect(unknown.statusCode).toBe(404);

    const byOwner = await call(dogsHandler, ownerToken(), 'PUT', { query: { id: 'dog-1', restore: 'true' } });
    expect(byOwner.statusCode).toBe(200);
    expect(byOwner.body).toMatchObject({ id: 'dog-1', name: 'Rex', deletedAt: null });

    const dashboard = await call(dashboardHandler, memberToken(), 'GET', { query: { puppyId: 'dog-1' } });
    expect(ids(dashboard.body.puppies)).toEqual(['dog-1', 'dog-2']);
    expect(ids(dashboard.body.activities)).toEqual(['act-1']);
    expect(ids(dashboard.body.healthRecords)).toEqual(['hr-1']);
    const log = await call(activitiesHandler, memberToken(), 'POST', { body: { puppyId: 'dog-1', type: 'pee' } });
    expect(log.statusCode).toBe(201);
  });

  it("the owner can neither restore nor delete another household's dog", async () => {
    const restore = await call(dogsHandler, ownerToken(), 'PUT', { query: { id: 'dog-other-deleted', restore: 'true' } });
    await call(dogsHandler, ownerToken(), 'DELETE', { query: { id: 'dog-other' } });

    expect(restore.statusCode).toBe(404);
    expect(dog('dog-other-deleted').deletedAt).toBeInstanceOf(Date);
    expect(dog('dog-other').deletedAt).toBeNull();
  });

  it('a deleted dog cannot be edited, by PUT or by the POST upsert: 404 and nothing changes', async () => {
    dog('dog-1').deletedAt = new Date('2026-10-15T10:00:00Z');

    const edit = await call(dogsHandler, memberToken(), 'PUT', { body: { id: 'dog-1', name: 'Renamed' } });
    const upsert = await call(dogsHandler, memberToken(), 'POST', {
      body: { id: 'dog-1', name: 'Renamed', breed: 'Beagle', birthDate: '2026-05-01' },
    });

    expect([edit.statusCode, upsert.statusCode]).toEqual([404, 404]);
    expect(dog('dog-1')).toMatchObject({ name: 'Rex', deletedAt: new Date('2026-10-15T10:00:00Z') });
    expect(store.rows.puppies.filter((puppy) => puppy.id === 'dog-1')).toHaveLength(1);
  });
});
