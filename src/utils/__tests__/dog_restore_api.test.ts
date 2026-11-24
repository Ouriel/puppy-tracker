import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import dogsHandler from '../../../api/dogs.js';
import dashboardHandler from '../../../api/dashboard.js';
import activitiesHandler from '../../../api/activities.js';
import healthRecordsHandler from '../../../api/health-records.js';
import householdsHandler from '../../../api/households.js';
import { signAppSessionToken } from '../../../api/_auth.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';
import { HOUSEHOLD_LIMITS } from '../schemas.js';

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
  // Like Postgres for the conditions these handlers send: "col" = $n, "col" >= $n (a date), "col" is null, "col" is not null
  // (others match every row)
  const matcher = (table: Table, condition?: SQL) => {
    if (!condition) return () => true;
    const { sql, params } = dialect.sqlToQuery(condition);
    const keyOf = Object.fromEntries(Object.entries(getTableColumns(table)).map(([key, column]) => [column.name, key]));
    const checks = [...sql.matchAll(/"(\w+)" (?:(=|>=) \$(\d+)|(is null)|(is not null))/g)].map(
      ([, column, operator, index, isNull, isNotNull]) =>
        (row: Row) => {
          const value = row[keyOf[column]];
          if (isNull) return value == null;
          if (isNotNull) return value != null;
          const param = params[Number(index) - 1];
          if (operator === '>=') return new Date(value as Date).getTime() >= new Date(param as string).getTime();
          return value === param;
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
            // The dashboard's invites: the invites table's own rows (no household name)
            leftJoin: () => chain,
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
      $count: (table: Table, condition?: SQL) => Promise.resolve(rowsOf(table).filter(matcher(table, condition)).length),
    })),
  };
});

process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
const ownerToken = () => signAppSessionToken({ email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'hh-1', role: 'SuperAdmin' }, 30);
const memberToken = () => signAppSessionToken({ email: 'member@example.com', name: 'Sam', householdId: 'hh-1', role: 'Member' }, 30);
const adminToken = () => signAppSessionToken({ email: 'admin@example.com', name: 'Alex', householdId: 'hh-1', role: 'Admin' }, 30);

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
    users: [
      { id: 'usr-1', email: 'member@example.com', name: 'Sam', householdId: 'hh-1', role: 'Member', status: 'ACTIVE' },
      { id: 'usr-2', email: 'admin@example.com', name: 'Alex', householdId: 'hh-1', role: 'Admin', status: 'ACTIVE' },
    ],
    puppies: [
      { id: 'dog-1', householdId: 'hh-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-05-01', deletedAt: null },
      { id: 'dog-2', householdId: 'hh-1', name: 'Mia', breed: 'Poodle', birthDate: '2026-04-01', deletedAt: null },
      { id: 'dog-other-deleted', householdId: 'hh-2', name: 'Kiwi', breed: 'Pug', birthDate: '2026-03-01', deletedAt: new Date('2026-10-01T10:00:00Z') },
      { id: 'dog-other', householdId: 'hh-2', name: 'Oslo', breed: 'Husky', birthDate: '2026-02-01', deletedAt: null },
    ],
    caretakers: [
      { id: 'ct-1', householdId: 'hh-1', name: 'Sam', role: 'Member', color: '#6366f1', email: 'member@example.com' },
      { id: 'ct-other', householdId: 'hh-2', name: 'Kim', role: 'Member', color: '#10b981', email: null },
    ],
    activities: [
      { id: 'act-1', householdId: 'hh-1', puppyId: 'dog-1', type: 'pee', timestamp: new Date(), loggedBy: 'Sam', createdAt: new Date() },
    ],
    health_records: [{ id: 'hr-1', householdId: 'hh-1', puppyId: 'dog-1', type: 'vaccination', name: 'Rage', date: '2026-08-01' }],
    invites: [],
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

  it('a deleted dog is absent from the dashboard and GET /api/dogs; a member never gets it in deletedPuppies, the owner does', async () => {
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

  it('a member cannot restore a dog; the owner does, and it comes back with its logs and health records', async () => {
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

// Security audit M3: the household's Admin deletes and restores its own dogs and deletes its badges, never another household's
describe("the household's Admin deletes and restores", () => {
  const badgeIds = () => ids(store.rows.caretakers as Array<{ id: string }>);

  it('deletes a dog of its household, gets it in deletedPuppies and restores it; deletes a badge of its household', async () => {
    const deleted = await call(dogsHandler, adminToken(), 'DELETE', { query: { id: 'dog-1' } });
    expect(deleted.statusCode).toBe(200);
    expect(dog('dog-1').deletedAt).toBeInstanceOf(Date);

    const dashboard = await call(dashboardHandler, adminToken(), 'GET');
    expect(ids(dashboard.body.deletedPuppies)).toEqual(['dog-1']);

    const restored = await call(dogsHandler, adminToken(), 'PUT', { query: { id: 'dog-1', restore: 'true' } });
    expect(restored.statusCode).toBe(200);
    expect(dog('dog-1').deletedAt).toBeNull();

    const badge = await call(householdsHandler, adminToken(), 'DELETE', { query: { id: 'ct-1' } });
    expect(badge.statusCode).toBe(200);
    expect(badgeIds()).toEqual(['ct-other']);
  });

  it("changes nothing with another household's dog or badge id, and never lists its deleted dogs", async () => {
    await call(dogsHandler, adminToken(), 'DELETE', { query: { id: 'dog-other' } });
    const restore = await call(dogsHandler, adminToken(), 'PUT', { query: { id: 'dog-other-deleted', restore: 'true' } });
    await call(householdsHandler, adminToken(), 'DELETE', { query: { id: 'ct-other' } });
    const dashboard = await call(dashboardHandler, adminToken(), 'GET');

    expect(dog('dog-other').deletedAt).toBeNull();
    expect(restore.statusCode).toBe(404);
    expect(dog('dog-other-deleted').deletedAt).toBeInstanceOf(Date);
    expect(badgeIds()).toEqual(['ct-1', 'ct-other']);
    expect(dashboard.body.deletedPuppies).toEqual([]);
  });

  it('takes the role from the users row: a token claiming Admin for a member is refused (403) and gets no deleted dog', async () => {
    dog('dog-2').deletedAt = new Date('2026-10-15T10:00:00Z');
    const claimedAdmin = signAppSessionToken({ email: 'member@example.com', name: 'Sam', householdId: 'hh-1', role: 'Admin' }, 30);

    const deleted = await call(dogsHandler, claimedAdmin, 'DELETE', { query: { id: 'dog-1' } });
    const restore = await call(dogsHandler, claimedAdmin, 'PUT', { query: { id: 'dog-2', restore: 'true' } });
    const badge = await call(householdsHandler, claimedAdmin, 'DELETE', { query: { id: 'ct-1' } });
    const dashboard = await call(dashboardHandler, claimedAdmin, 'GET');

    expect([deleted.statusCode, restore.statusCode, badge.statusCode]).toEqual([403, 403, 403]);
    expect(dog('dog-1').deletedAt).toBeNull();
    expect(dog('dog-2').deletedAt).toBeInstanceOf(Date);
    expect(badgeIds()).toEqual(['ct-1', 'ct-other']);
    expect(dashboard.body.deletedPuppies).toEqual([]);
  });
});

// Backlog item 19: weigh-ins are weight events; the legacy profile weight is never made up, and no screen sets it
describe("a dog's legacy profile weight (puppies.weight_kg)", () => {
  it('a new dog stores no weight: none made up, and one sent by an older app is dropped', async () => {
    const created = await call(dogsHandler, memberToken(), 'POST', { body: { id: 'dog-new', name: 'Max', breed: 'Beagle', birthDate: '2026-09-01' } });
    const fromOlderApp = await call(dogsHandler, memberToken(), 'POST', {
      body: { id: 'dog-older-app', name: 'Lou', breed: 'Beagle', birthDate: '2026-09-01', weightKg: 4.5 },
    });

    expect([created.statusCode, fromOlderApp.statusCode]).toEqual([201, 201]);
    expect(dog('dog-new').weightKg ?? null).toBeNull();
    expect(dog('dog-older-app').weightKg ?? null).toBeNull();
  });

  it('a dog without a weight is edited: the form sends the stored dog back, weightKg: null included', async () => {
    dog('dog-1').weightKg = null;

    const response = await call(dogsHandler, memberToken(), 'PUT', { body: { ...dog('dog-1'), name: 'Rexy' } });

    expect(response.statusCode).toBe(200);
    expect(dog('dog-1')).toMatchObject({ name: 'Rexy', weightKg: null });
  });

  it('an older dog keeps its stored weight, whatever an edit or an upsert sends', async () => {
    dog('dog-2').weightKg = 6.2;

    await call(dogsHandler, memberToken(), 'PUT', { body: { id: 'dog-2', weightKg: 4.5 } });
    await call(dogsHandler, memberToken(), 'POST', { body: { id: 'dog-2', name: 'Mia', breed: 'Poodle', birthDate: '2026-04-01', weightKg: 4.5 } });

    expect(dog('dog-2').weightKg).toBe(6.2);
  });
});

// Security audit M2: a row's size is capped by the schemas, the number of rows per household by HOUSEHOLD_LIMITS
describe('household limits: 429 limitReached at the limit, nothing written', () => {
  const HOUR_MS = 60 * 60 * 1000;
  /** `count` more rows in `table`, made by `row`. */
  const fill = (table: string, count: number, row: (index: number) => Row) => {
    store.rows[table].push(...Array.from({ length: count }, (_, index) => row(index)));
  };
  const logRow = (householdId: string, createdAt: Date) => (index: number) =>
    ({ id: `act-${householdId}-${createdAt.getTime()}-${index}`, householdId, puppyId: 'dog-1', type: 'pee', timestamp: createdAt, loggedBy: 'Sam', createdAt });
  const limitReached = { error: 'Limit reached for this household', code: 'limitReached' };

  describe(`logs: ${HOUSEHOLD_LIMITS.logsPerDay} created in 24 hours`, () => {
    beforeEach(() => {
      // act-1 (created now) and these fill the household's last 24 hours
      fill('activities', HOUSEHOLD_LIMITS.logsPerDay - 1, logRow('hh-1', new Date(Date.now() - HOUR_MS)));
    });

    it('at the limit, a new log is refused and not stored', async () => {
      const response = await call(activitiesHandler, memberToken(), 'POST', { body: { id: 'act-new', puppyId: 'dog-1', type: 'pee' } });

      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual(limitReached);
      expect(store.rows.activities.some((row) => row.id === 'act-new')).toBe(false);
    });

    it('at the limit, a log sent again (an id already stored) still answers the stored log', async () => {
      const response = await call(activitiesHandler, memberToken(), 'POST', { body: { id: 'act-1', puppyId: 'dog-1', type: 'pee' } });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ id: 'act-1', householdId: 'hh-1' });
    });

    it("logs created over 24 hours ago, and other households' logs, do not count", async () => {
      store.rows.activities = store.rows.activities.filter((row) => row.householdId !== 'hh-1');
      fill('activities', HOUSEHOLD_LIMITS.logsPerDay, logRow('hh-1', new Date(Date.now() - 25 * HOUR_MS)));
      fill('activities', HOUSEHOLD_LIMITS.logsPerDay, logRow('hh-2', new Date()));

      const response = await call(activitiesHandler, memberToken(), 'POST', { body: { id: 'act-new', puppyId: 'dog-1', type: 'pee' } });

      expect(response.statusCode).toBe(201);
      expect(store.rows.activities.some((row) => row.id === 'act-new')).toBe(true);
    });
  });

  describe(`dogs: ${HOUSEHOLD_LIMITS.dogs}, deleted ones included`, () => {
    const newDog = { id: 'dog-new', name: 'Max', breed: 'Beagle', birthDate: '2026-09-01' };
    const dogRow = (householdId: string, deletedAt: Date | null) => (index: number) =>
      ({ id: `dog-${householdId}-${index}`, householdId, name: 'Old', breed: 'Pug', birthDate: '2026-01-01', deletedAt });

    it('at the limit (deleted dogs count), a new dog is refused and not stored; an edit through the upsert still saves', async () => {
      fill('puppies', HOUSEHOLD_LIMITS.dogs - 2, dogRow('hh-1', new Date('2026-10-01T10:00:00Z')));

      const created = await call(dogsHandler, memberToken(), 'POST', { body: newDog });
      const edited = await call(dogsHandler, memberToken(), 'POST', { body: { id: 'dog-1', name: 'Rexy', breed: 'Beagle', birthDate: '2026-05-01' } });

      expect(created.statusCode).toBe(429);
      expect(created.body).toEqual(limitReached);
      expect(store.rows.puppies.some((row) => row.id === 'dog-new')).toBe(false);
      expect(edited.statusCode).toBe(200);
      expect(dog('dog-1').name).toBe('Rexy');
    });

    it('under the limit, whatever other households hold, a new dog is stored', async () => {
      fill('puppies', HOUSEHOLD_LIMITS.dogs, dogRow('hh-2', null));

      const response = await call(dogsHandler, memberToken(), 'POST', { body: newDog });

      expect(response.statusCode).toBe(201);
      expect(dog('dog-new')).toMatchObject({ householdId: 'hh-1', name: 'Max' });
    });
  });

  describe(`health records: ${HOUSEHOLD_LIMITS.healthRecords}`, () => {
    const record = { id: 'hr-new', puppyId: 'dog-1', type: 'vaccination', name: 'Rage', date: '2026-10-01' };
    const recordRow = (householdId: string) => (index: number) =>
      ({ id: `hr-${householdId}-${index}`, householdId, puppyId: 'dog-1', type: 'vaccination', name: 'Rage', date: '2026-08-01' });

    it('at the limit, a new record is refused and not stored', async () => {
      fill('health_records', HOUSEHOLD_LIMITS.healthRecords - 1, recordRow('hh-1'));

      const response = await call(healthRecordsHandler, memberToken(), 'POST', { body: record });

      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual(limitReached);
      expect(store.rows.health_records.some((row) => row.id === 'hr-new')).toBe(false);
    });

    it('under the limit, whatever other households hold, a new record is stored', async () => {
      fill('health_records', HOUSEHOLD_LIMITS.healthRecords, recordRow('hh-2'));

      const response = await call(healthRecordsHandler, memberToken(), 'POST', { body: record });

      expect(response.statusCode).toBe(201);
      expect(store.rows.health_records.some((row) => row.id === 'hr-new')).toBe(true);
    });
  });

  describe(`badges: ${HOUSEHOLD_LIMITS.badges}`, () => {
    const badgeRow = (householdId: string) => (index: number) =>
      ({ id: `ct-${householdId}-${index}`, householdId, name: `Badge ${index}`, role: 'Member', color: '#6366f1', email: null });

    it('at the limit, a new badge is refused and not stored', async () => {
      fill('caretakers', HOUSEHOLD_LIMITS.badges - 1, badgeRow('hh-1'));

      const response = await call(householdsHandler, adminToken(), 'POST', { body: { id: 'ct-new', name: 'Nanny' } });

      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual(limitReached);
      expect(store.rows.caretakers.some((row) => row.id === 'ct-new')).toBe(false);
    });

    it('under the limit, whatever other households hold, a new badge is stored', async () => {
      fill('caretakers', HOUSEHOLD_LIMITS.badges, badgeRow('hh-2'));

      const response = await call(householdsHandler, adminToken(), 'POST', { body: { id: 'ct-new', name: 'Nanny' } });

      expect(response.statusCode).toBe(201);
      expect(store.rows.caretakers.some((row) => row.id === 'ct-new')).toBe(true);
    });
  });
});
