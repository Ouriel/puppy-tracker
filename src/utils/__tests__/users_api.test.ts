import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken, verifyAuth } from '../../../api/_auth.js';
import usersHandler, { OWNER_ACCOUNT_LIST_LIMIT } from '../../../api/users.js';
import invitesHandler from '../../../api/invites.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';
import { HOUSEHOLD_LIMITS } from '../schemas.js';

type Row = Record<string, unknown>;

// _auth.ts reads the database URL at import: without one, the Google sign-in stops before its users lookup
vi.hoisted(() => {
  process.env.POSTGRES_URL ??= 'postgres://example.invalid/db';
});

// Hermetic DB: rows are filtered by every `"column" = $n` / `"column" <> $n` / `lower("column") = $n` / `"column" < $n`
// (a date) of the WHERE. A delete removes the matching rows at once, so the rows left are what the database would keep.
const dbMock = vi.hoisted(() => ({
  users: [] as Row[],
  puppies: [] as Row[],
  caretakers: [] as Row[],
  activities: [] as Row[],
  health_records: [] as Row[],
  households: [] as Row[],
  invites: [] as Row[],
  updatedValues: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
  // The `set` of each insert ... on conflict do update (a repeated invite)
  conflictSets: [] as Array<Record<string, unknown>>,
  batches: 0,
  // The ORDER BY of the owner's account list
  orderBy: [] as unknown[],
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
  neonConfig: { fetchConnectionCache: false },
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  const tableRows = (table: Table) => (dbMock as unknown as Record<string, Row[]>)[getTableName(table)] ?? [];
  const matching = (table: Table, condition: SQL) => {
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    return tableRows(table).filter((row) =>
      [...sql.matchAll(/(lower\((?:"\w+"\.)?)?"(\w+)"\)? (=|<>|<|>=) \$(\d+)/g)].every(([, lower, column, operator, index]) => {
        const field = column.replace(/_(\w)/g, (_match, letter: string) => letter.toUpperCase());
        const value = lower ? String(row[field] ?? '').toLowerCase() : row[field];
        const param = params[Number(index) - 1];
        if (operator === '<') return new Date(value as string).getTime() < new Date(param as string).getTime();
        if (operator === '>=') return new Date(value as string).getTime() >= new Date(param as string).getTime();
        return (value === param) === (operator === '=');
      })
    );
  };
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => ({
          where: vi.fn((condition: SQL) => {
            const rows = Promise.resolve(matching(table, condition));
            return Object.assign(rows, { limit: (count: number) => rows.then((found) => found.slice(0, count)) });
          }),
          // The owner's account list: the rows in stored order (the ORDER BY is kept for the test to read)
          orderBy: (...clauses: unknown[]) => {
            dbMock.orderBy = clauses;
            return { limit: (count: number) => Promise.resolve(tableRows(table).slice(0, count)) };
          },
        })),
      })),
      $count: vi.fn((table: Table, condition?: SQL) => Promise.resolve(condition ? matching(table, condition).length : tableRows(table).length)),
      update: vi.fn((table: Table) => ({
        set: (values: Record<string, unknown>) => {
          dbMock.updatedValues.push(values);
          return {
            where: (condition: SQL) => ({
              returning: () => Promise.resolve(matching(table, condition).map((row) => ({ ...row, ...values }))),
            }),
          };
        },
      })),
      insert: vi.fn(() => ({
        values: (values: Record<string, unknown>) => {
          dbMock.insertedValues.push(values);
          return {
            returning: () => Promise.resolve([values]),
            onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
              dbMock.conflictSets.push(set);
              return Promise.resolve();
            },
          };
        },
      })),
      delete: vi.fn((table: Table) => ({
        where: (condition: SQL) => {
          const removed = new Set(matching(table, condition));
          (dbMock as unknown as Record<string, Row[]>)[getTableName(table)] = tableRows(table).filter((row) => !removed.has(row));
          return Promise.resolve();
        },
      })),
      batch: vi.fn((queries: unknown[]) => {
        dbMock.batches += 1;
        return Promise.all(queries);
      }),
    })),
  };
});

const adminRow = { id: 'usr-admin', email: 'admin@example.com', name: 'Family Admin', householdId: 'hh-admin', role: 'Admin', status: 'ACTIVE' };
const pendingStranger = { id: 'usr-pending', email: 'jane.doe@example.com', name: 'Jane Doe', householdId: 'house-jane', role: 'Member', status: 'PENDING_APPROVAL' };
const activeElsewhere = { id: 'usr-active', email: 'bob@example.com', name: 'Bob Builder', householdId: 'hh-other', role: 'Member', status: 'ACTIVE' };

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

function postAs(identity: { email: string; householdId: string; role: string }, body: unknown) {
  const token = signAppSessionToken({ ...identity, name: 'Inviter' }, 30);
  return { method: 'POST', headers: { authorization: `Bearer ${token}` }, query: {}, body } as any;
}

const asOwner = (body: unknown) => postAs({ email: SUPER_ADMIN_EMAIL, householdId: 'hh-owner', role: 'SuperAdmin' }, body);
const asAdmin = (body: unknown) => postAs({ email: adminRow.email, householdId: adminRow.householdId, role: 'Admin' }, body);
const ids = (rows: Row[]) => rows.map((row) => row.id);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function resetDb(users: Row[]) {
  process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
  dbMock.users = users;
  for (const table of ['puppies', 'caretakers', 'activities', 'health_records', 'households', 'invites'] as const) dbMock[table] = [];
  dbMock.updatedValues = [];
  dbMock.insertedValues = [];
  dbMock.conflictSets = [];
  dbMock.batches = 0;
}

// Audit M1 and S1: an invite never creates, activates or moves an account, and its answer never tells whether one exists
describe('POST /api/users: an invite, never an account', () => {
  const originalSecret = process.env.SESSION_SECRET;
  const revokedElsewhere = { id: 'usr-revoked', email: 'revoked@example.com', name: 'Revoked', householdId: 'hh-other', role: 'Member', status: 'REVOKED' };

  beforeEach(() => resetDb([adminRow, { ...pendingStranger }, { ...activeElsewhere }, { ...revokedElsewhere }]));

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it.each([
    ['an email with no account', 'New.Person@example.com'],
    ['an active account of another household', activeElsewhere.email],
    ['a sign-up waiting for approval', pendingStranger.email],
    ['a revoked account', revokedElsewhere.email],
  ])("answers the same 201 for %s, creates or moves no account, and stores a Member invite into the Admin's household", async (_label, email) => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email, role: 'Member', status: 'ACTIVE', name: 'Typed name' }), response);

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ email: email.toLowerCase() });
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.insertedValues).toEqual([
      { id: expect.stringMatching(/^inv-[0-9a-f-]{36}$/), email: email.toLowerCase(), householdId: adminRow.householdId, role: 'Member', invitedBy: adminRow.name },
    ]);
    expect(dbMock.batches).toBe(1);
  });

  it('sends a repeated invite as an update of the same one: role, inviter and date', async () => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com' }), response);

    expect(dbMock.conflictSets).toEqual([{ role: 'Member', invitedBy: adminRow.name, createdAt: expect.any(Date) }]);
  });

  it.each([
    ['another household', { householdId: 'hh-other' }],
    ['the Admin role', { role: 'Admin' }],
    ['a new household', { newHouseholdName: 'Famille Durand' }],
  ])('refuses (403) %s chosen by a family Admin, and writes nothing', async (_label, choice) => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com', ...choice }), response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.insertedValues).toEqual([]);
    expect(dbMock.batches).toBe(0);
  });

  it('refuses (403) an invite from a member, and writes nothing', async () => {
    dbMock.users.push({ id: 'usr-member', email: 'member@example.com', name: 'Member', householdId: adminRow.householdId, role: 'Member', status: 'ACTIVE' });
    const response = createMockResponse();
    await usersHandler(postAs({ email: 'member@example.com', householdId: adminRow.householdId, role: 'Member' }, { email: 'new.person@example.com' }), response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.insertedValues).toEqual([]);
  });

  it.each([
    ['an account already in that household (an Admin re-inviting themselves)', adminRow.email],
    ["the owner's account, which never moves", SUPER_ADMIN_EMAIL],
  ])('writes nothing for %s, with the same answer', async (_label, email) => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email }), response);

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ email });
    expect(dbMock.insertedValues).toEqual([]);
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.batches).toBe(0);
  });

  it('lets the owner invite into another household, as a Member whatever role or status is sent', async () => {
    const response = createMockResponse();
    await usersHandler(asOwner({ email: 'new.person@example.com', householdId: 'hh-other', role: 'Admin', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(201);
    expect(dbMock.insertedValues).toEqual([expect.objectContaining({ email: 'new.person@example.com', householdId: 'hh-other', role: 'Member' })]);
    expect(dbMock.updatedValues).toEqual([]);
  });

  it('answers 404 to the owner for a household with no row and no account, and writes nothing', async () => {
    const response = createMockResponse();
    await usersHandler(asOwner({ email: 'new.person@example.com', householdId: 'hh-nowhere' }), response);

    expect(response.statusCode).toBe(404);
    expect(dbMock.batches).toBe(0);
  });

  it("creates the owner's new household and an Admin invite into it, in one batch, even for an account that lives elsewhere", async () => {
    const response = createMockResponse();
    await usersHandler(asOwner({ email: activeElsewhere.email, newHouseholdName: '  Famille Durand ' }), response);

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ email: activeElsewhere.email });
    expect(dbMock.batches).toBe(1);
    const household = dbMock.insertedValues.find((values) => 'familyPackId' in values)!;
    expect(household).toEqual({ id: expect.stringMatching(/^house-/), familyPackId: household.id, name: 'Famille Durand' });
    expect(dbMock.insertedValues).toContainEqual(expect.objectContaining({ email: activeElsewhere.email, householdId: household.id, role: 'Admin' }));
    expect(dbMock.updatedValues).toEqual([]);
  });

  it('deletes the invites older than 90 days at each invite it writes', async () => {
    dbMock.invites = [
      { id: 'inv-old', email: 'old@example.com', householdId: 'hh-other', createdAt: daysAgo(91) },
      { id: 'inv-recent', email: 'recent@example.com', householdId: 'hh-other', createdAt: daysAgo(89) },
    ];
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com' }), response);

    expect(ids(dbMock.invites)).toEqual(['inv-recent']);
  });
});

// Security audit M2: a household's pending invites are capped (HOUSEHOLD_LIMITS.pendingInvites); the owner's are not
describe(`POST /api/users: at most ${HOUSEHOLD_LIMITS.pendingInvites} pending invites per household`, () => {
  const originalSecret = process.env.SESSION_SECRET;
  const invites = (householdId: string, count: number, createdAt = daysAgo(1)) =>
    Array.from({ length: count }, (_, index) => ({ id: `inv-${householdId}-${index}`, email: `invited${index}@example.com`, householdId, role: 'Member', createdAt }));

  beforeEach(() => resetDb([adminRow]));

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("at the limit, an Admin's invite to a new email is refused with 429 limitReached, and nothing is written", async () => {
    dbMock.invites = invites(adminRow.householdId, HOUSEHOLD_LIMITS.pendingInvites);
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com' }), response);

    expect(response.statusCode).toBe(429);
    expect(response.body).toEqual({ error: 'Limit reached for this household', code: 'limitReached' });
    expect(dbMock.insertedValues).toEqual([]);
    expect(dbMock.batches).toBe(0);
  });

  it('at the limit, inviting an email already invited updates its invite (not a new row)', async () => {
    dbMock.invites = invites(adminRow.householdId, HOUSEHOLD_LIMITS.pendingInvites);
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'invited0@example.com' }), response);

    expect(response.statusCode).toBe(201);
    expect(dbMock.conflictSets).toHaveLength(1);
  });

  it("invites over 90 days old and other households' invites do not count", async () => {
    dbMock.invites = [...invites(adminRow.householdId, HOUSEHOLD_LIMITS.pendingInvites, daysAgo(91)), ...invites('hh-other', HOUSEHOLD_LIMITS.pendingInvites)];
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com' }), response);

    expect(response.statusCode).toBe(201);
    expect(dbMock.insertedValues).toEqual([expect.objectContaining({ email: 'new.person@example.com', householdId: adminRow.householdId })]);
  });

  it('the owner is not capped', async () => {
    dbMock.users.push({ ...activeElsewhere });
    dbMock.invites = invites('hh-other', HOUSEHOLD_LIMITS.pendingInvites);
    const response = createMockResponse();
    await usersHandler(asOwner({ email: 'new.person@example.com', householdId: 'hh-other' }), response);

    expect(response.statusCode).toBe(201);
    expect(dbMock.insertedValues).toEqual([expect.objectContaining({ email: 'new.person@example.com', householdId: 'hh-other' })]);
  });
});

describe("GET /api/users: the owner's account list loads at most 500 accounts", () => {
  const originalSecret = process.env.SESSION_SECRET;
  const getAs = (identity: { email: string; householdId: string; role: string }) => {
    const token = signAppSessionToken({ ...identity, name: 'Reader' }, 30);
    return { method: 'GET', headers: { authorization: `Bearer ${token}` }, query: {} } as any;
  };
  const accounts = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: `usr-${index}`, email: `user${index}@example.com`, name: `User ${index}`, householdId: `house-${index}`, role: 'Admin', status: 'ACTIVE' }));

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it(`sends ${OWNER_ACCOUNT_LIST_LIMIT} accounts and the total: the owner's own first, then pending and revoked ones, then the newest`, async () => {
    resetDb(accounts(OWNER_ACCOUNT_LIST_LIMIT + 1));
    const response = createMockResponse();
    await usersHandler(getAs({ email: SUPER_ADMIN_EMAIL, householdId: 'hh-owner', role: 'SuperAdmin' }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body.users).toHaveLength(OWNER_ACCOUNT_LIST_LIMIT);
    expect(response.body.total).toBe(OWNER_ACCOUNT_LIST_LIMIT + 1);
    const orderBy = dbMock.orderBy.map((clause) => new PgDialect().sqlToQuery(clause as SQL));
    expect(orderBy.map((clause) => clause.sql)).toEqual([
      '"users"."email" = $1 desc',
      `"users"."status" <> 'ACTIVE' desc`,
      '"users"."created_at" desc nulls last',
    ]);
    expect(orderBy[0].params).toEqual([SUPER_ADMIN_EMAIL.toLowerCase()]);
  });

  it("an Admin gets its household's accounts, all of them, with their number", async () => {
    resetDb([adminRow, { ...activeElsewhere }, { ...adminRow, id: 'usr-family', email: 'family@example.com' }]);
    const response = createMockResponse();
    await usersHandler(getAs({ email: adminRow.email, householdId: adminRow.householdId, role: 'Admin' }), response);

    expect(response.statusCode).toBe(200);
    expect(ids(response.body.users)).toEqual(['usr-admin', 'usr-family']);
    expect(response.body.total).toBe(2);
  });
});

describe('POST and DELETE /api/invites: the invitee answers', () => {
  const originalSecret = process.env.SESSION_SECRET;
  // Signed in after the invite: active, the Admin of an empty household of its own
  const invitee = { id: 'usr-jane', email: 'jane.doe@example.com', name: 'Jane Doe', householdId: 'house-jane', role: 'Admin', status: 'ACTIVE' };
  const invite = { id: 'inv-1', email: invitee.email, householdId: adminRow.householdId, role: 'Member', invitedBy: adminRow.name, createdAt: daysAgo(1) };
  const as = (identity: { email: string; householdId: string; role: string }, method: string, id: string) => ({
    ...postAs(identity, method === 'POST' ? { id } : undefined),
    method,
    query: method === 'DELETE' ? { id } : {},
  });
  const asInvitee = (method: string, id = invite.id) => as({ email: invitee.email, householdId: invitee.householdId, role: 'Admin' }, method, id);

  beforeEach(() => {
    resetDb([adminRow, { ...invitee }, { ...activeElsewhere }]);
    dbMock.invites = [
      { ...invite },
      // Sent by Jane while she was alone: it goes with her old household
      { id: 'inv-into-jane', email: 'friend@example.com', householdId: invitee.householdId, role: 'Member' },
      { id: 'inv-elsewhere', email: 'friend@example.com', householdId: 'hh-other', role: 'Member' },
    ];
    dbMock.caretakers = [
      { id: 'badge-jane-old', householdId: invitee.householdId, email: invitee.email },
      { id: 'badge-jane-new', householdId: adminRow.householdId, email: invitee.email },
    ];
    dbMock.households = [{ id: invitee.householdId }, { id: adminRow.householdId }];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("joins: moves the account into the invite's household with its role, deletes the invite and what the old household leaves", async () => {
    const response = createMockResponse();
    await invitesHandler(asInvitee('POST') as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.batches).toBe(1);
    expect(dbMock.updatedValues).toEqual([{ householdId: adminRow.householdId, role: 'Member' }]);
    expect(ids(dbMock.invites)).toEqual(['inv-elsewhere']);
    expect(ids(dbMock.caretakers)).toEqual(['badge-jane-new']);
    expect(ids(dbMock.households)).toEqual([adminRow.householdId]);
  });

  it.each([
    ["someone else's invite", () => as({ email: activeElsewhere.email, householdId: activeElsewhere.householdId, role: 'Member' }, 'POST', invite.id)],
    ['an invite that does not exist', () => asInvitee('POST', 'inv-nope')],
    ["someone else's invite, declined", () => as({ email: activeElsewhere.email, householdId: activeElsewhere.householdId, role: 'Member' }, 'DELETE', invite.id)],
  ])('answers 404 to %s, and changes nothing', async (_label, request) => {
    const response = createMockResponse();
    await invitesHandler(request() as any, response);

    expect(response.statusCode).toBe(404);
    expect(dbMock.invites).toHaveLength(3);
    expect(dbMock.updatedValues).toEqual([]);
  });

  it("refuses (403) the owner's join: the owner's account never moves", async () => {
    dbMock.invites.push({ ...invite, id: 'inv-owner', email: SUPER_ADMIN_EMAIL });
    const response = createMockResponse();
    await invitesHandler(as({ email: SUPER_ADMIN_EMAIL, householdId: 'hh-owner', role: 'SuperAdmin' }, 'POST', 'inv-owner') as any, response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.invites).toHaveLength(4);
  });

  it.each([
    ['a dog', () => dbMock.puppies.push({ id: 'pup-jane', householdId: invitee.householdId })],
    ['a deleted dog', () => dbMock.puppies.push({ id: 'pup-jane', householdId: invitee.householdId, deletedAt: new Date() })],
    ['another account', () => dbMock.users.push({ id: 'usr-partner', email: 'partner@example.com', householdId: invitee.householdId, role: 'Member', status: 'ACTIVE' })],
  ])('refuses (409, inviteLeaveFirst) a join while the household has %s, and writes nothing', async (_label, arrange) => {
    arrange();
    const response = createMockResponse();
    await invitesHandler(asInvitee('POST') as any, response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: expect.any(String), code: 'inviteLeaveFirst' });
    expect(dbMock.batches).toBe(0);
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.invites).toHaveLength(3);
    expect(dbMock.caretakers).toHaveLength(2);
  });

  it('declines: deletes that invite only', async () => {
    const response = createMockResponse();
    await invitesHandler(asInvitee('DELETE') as any, response);

    expect(response.statusCode).toBe(200);
    expect(ids(dbMock.invites)).toEqual(['inv-into-jane', 'inv-elsewhere']);
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.caretakers).toHaveLength(2);
  });
});

describe('First Google sign-in (verifyAuth)', () => {
  const originalSecret = process.env.SESSION_SECRET;
  const email = 'jane.doe@example.com';
  const invite = { id: 'inv-1', email, householdId: adminRow.householdId, role: 'Member' };
  const signIn = () => verifyAuth({ headers: { authorization: 'Bearer google-id-token' } } as any);

  beforeEach(() => {
    resetDb([adminRow]);
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ aud: 'test-client-id', email: 'Jane.Doe@example.com', email_verified: 'true', name: 'Jane Doe' })));
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('with an invite: creates the account active, the Admin of a new household of its own, never the inviter\'s', async () => {
    dbMock.invites = [{ ...invite }];

    const auth = await signIn();

    expect(dbMock.insertedValues).toEqual([
      { id: expect.stringMatching(/^usr-/), householdId: expect.stringMatching(/^house-/), email, name: 'Jane Doe', role: 'Admin', status: 'ACTIVE' },
    ]);
    expect(auth).toEqual({ email, name: 'Jane Doe', householdId: dbMock.insertedValues[0].householdId, role: 'Admin' });
    expect(dbMock.invites).toHaveLength(1);
  });

  it('without an invite: creates the account waiting for approval, as before, and refuses it (403, pending)', async () => {
    await expect(signIn()).rejects.toMatchObject({ status: 403, code: 'pending' });
    expect(dbMock.insertedValues).toEqual([expect.objectContaining({ email, role: 'Member', status: 'PENDING_APPROVAL', householdId: expect.stringMatching(/^house-/) })]);
  });

  it('activates a sign-up waiting since before the invite: active, the Admin of a new household of its own', async () => {
    dbMock.users.push({ ...pendingStranger });
    dbMock.invites = [{ ...invite }];

    const auth = await signIn();

    expect(dbMock.updatedValues).toEqual([{ householdId: expect.stringMatching(/^house-/), role: 'Admin', status: 'ACTIVE' }]);
    expect(dbMock.updatedValues[0].householdId).not.toBe(pendingStranger.householdId);
    expect(auth).toMatchObject({ email, role: 'Admin', householdId: dbMock.updatedValues[0].householdId });
    expect(dbMock.insertedValues).toEqual([]);
  });

  it('keeps refusing a revoked account, invite or not (403, revoked)', async () => {
    dbMock.users.push({ ...pendingStranger, status: 'REVOKED' });
    dbMock.invites = [{ ...invite }];

    await expect(signIn()).rejects.toMatchObject({ status: 403, code: 'revoked' });
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.insertedValues).toEqual([]);
  });
});

describe("PUT /api/users: the Admin panel's 'Active accounts' household select", () => {
  const originalSecret = process.env.SESSION_SECRET;
  const put = (request: { method: string }) => ({ ...request, method: 'PUT' });

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...activeElsewhere }];
    dbMock.updatedValues = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it('refuses (403) a move by an admin who is not the super admin, and changes nothing', async () => {
    const response = createMockResponse();
    await usersHandler(put(asAdmin({ email: activeElsewhere.email, householdId: adminRow.householdId })) as any, response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.updatedValues).toEqual([]);
  });

  it('lets the owner move the account', async () => {
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: activeElsewhere.email, householdId: 'hh-owner' })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues).toEqual([{ householdId: 'hh-owner' }]);
  });

  // An Admin's powers belong to its own family: moved elsewhere (the owner's household included), it is a Member there.
  it('makes an Admin the owner moves into another household a Member', async () => {
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: adminRow.email, householdId: 'hh-owner' })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues).toEqual([{ householdId: 'hh-owner', role: 'Member' }]);
    expect(response.body).toMatchObject({ role: 'Member', householdId: 'hh-owner' });
  });
});

// Backlog 12: the first member of a new family becomes its Admin, so they can invite the rest of it.
describe("PUT /api/users: the owner's approval (Admin panel 'Approve and assign')", () => {
  const originalSecret = process.env.SESSION_SECRET;
  const put = (request: { method: string }) => ({ ...request, method: 'PUT' });

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...pendingStranger }, { ...activeElsewhere }];
    dbMock.updatedValues = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it.each([
    ['naming its own household', { householdId: pendingStranger.householdId }],
    ['naming no household', {}],
  ])('makes a sign-up that stays alone in its own household its Admin (%s)', async (_label, household) => {
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: pendingStranger.email, status: 'ACTIVE', ...household })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).toMatchObject({ status: 'ACTIVE', role: 'Admin' });
    expect(response.body).toMatchObject({ email: pendingStranger.email, role: 'Admin', status: 'ACTIVE' });
  });

  it('keeps Member when approving into another household', async () => {
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: pendingStranger.email, status: 'ACTIVE', householdId: activeElsewhere.householdId })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).not.toHaveProperty('role');
    expect(response.body).toMatchObject({ role: 'Member', householdId: activeElsewhere.householdId });
  });

  // Revoke keeps the role: a revoked Admin approved into another household is a Member there.
  it('makes a revoked Admin approved into another household a Member', async () => {
    dbMock.users.push({ id: 'usr-revoked-admin', email: 'revoked.admin@example.com', name: 'Revoked Admin', householdId: 'house-ra', role: 'Admin', status: 'PENDING_APPROVAL' });
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: 'revoked.admin@example.com', status: 'ACTIVE', householdId: 'hh-owner' })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).toMatchObject({ status: 'ACTIVE', householdId: 'hh-owner', role: 'Member' });
    expect(response.body).toMatchObject({ role: 'Member', householdId: 'hh-owner' });
  });

  // A stale Admin panel row: an Admin took the sign-up in since the panel loaded. Approving it would move it back out.
  it('answers 409 to an approval into another household of an account no longer pending, and changes nothing', async () => {
    dbMock.users = dbMock.users.map((row) =>
      row.email === pendingStranger.email ? { ...row, householdId: adminRow.householdId, status: 'ACTIVE' } : row
    );
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: pendingStranger.email, status: 'ACTIVE', householdId: pendingStranger.householdId })) as any, response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: expect.any(String) });
    expect(dbMock.updatedValues).toEqual([]);
  });

  it('keeps Member when re-approving a revoked member who shares the household', async () => {
    dbMock.users.push({ id: 'usr-revoked', email: 'revoked@example.com', name: 'Revoked', householdId: adminRow.householdId, role: 'Member', status: 'PENDING_APPROVAL' });
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: 'revoked@example.com', status: 'ACTIVE', householdId: adminRow.householdId })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).not.toHaveProperty('role');
  });
});

// As POST: an Admin's family members are Members; only the owner chooses another role.
describe('PUT /api/users: only the owner sets a role', () => {
  const originalSecret = process.env.SESSION_SECRET;
  const put = (request: { method: string }) => ({ ...request, method: 'PUT' });
  const memberRow = { id: 'usr-member', email: 'member@example.com', name: 'Member', householdId: adminRow.householdId, role: 'Member', status: 'ACTIVE' };

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...memberRow }];
    dbMock.updatedValues = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it.each(['Admin', 'Sitter'])('refuses (403) the %s role set by an admin who is not the super admin, and changes nothing', async (role) => {
    const response = createMockResponse();
    await usersHandler(put(asAdmin({ email: memberRow.email, role })) as any, response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.updatedValues).toEqual([]);
  });

  it('lets an admin send the Member role', async () => {
    const response = createMockResponse();
    await usersHandler(put(asAdmin({ email: memberRow.email, role: 'Member' })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ email: memberRow.email, role: 'Member' });
  });

  it('lets the owner make a member an Admin', async () => {
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: memberRow.email, role: 'Admin' })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues).toEqual([{ role: 'Admin' }]);
    expect(response.body).toMatchObject({ email: memberRow.email, role: 'Admin' });
  });

  it('refuses (400) a role outside the known roles, even from the owner, and changes nothing', async () => {
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: adminRow.email, role: 'Boss' })) as any, response);

    expect(response.statusCode).toBe(400);
    expect(dbMock.updatedValues).toEqual([]);
  });
});

// Audit S2: REVOKED is set and cleared by the owner only, so a family Admin can never undo the owner's revoke.
describe('PUT /api/users: only the owner changes an account status', () => {
  const originalSecret = process.env.SESSION_SECRET;
  const put = (request: { method: string }) => ({ ...request, method: 'PUT' });
  const revokedMember = { id: 'usr-revoked', email: 'revoked@example.com', name: 'Revoked', householdId: adminRow.householdId, role: 'Admin', status: 'REVOKED' };
  const activeMember = { id: 'usr-member', email: 'member@example.com', name: 'Member', householdId: adminRow.householdId, role: 'Member', status: 'ACTIVE' };

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...revokedMember }, { ...activeMember }];
    dbMock.updatedValues = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it.each([
    ['restore a revoked account of its household', revokedMember.email, 'ACTIVE'],
    ['revoke an account of its household', activeMember.email, 'REVOKED'],
    ['set an account of its household back to pending', activeMember.email, 'PENDING_APPROVAL'],
  ])('refuses (403) an Admin who tries to %s, and changes nothing', async (_label, email, status) => {
    const response = createMockResponse();
    await usersHandler(put(asAdmin({ email, status })) as any, response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.updatedValues).toEqual([]);
  });

  it('lets the owner revoke an account', async () => {
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: activeMember.email, status: 'REVOKED' })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues).toEqual([{ status: 'REVOKED' }]);
    expect(response.body).toMatchObject({ email: activeMember.email, status: 'REVOKED' });
  });

  it('lets the owner restore access: active again, same household and role', async () => {
    dbMock.users = [{ ...revokedMember, householdId: 'house-alone' }];
    const response = createMockResponse();
    await usersHandler(put(asOwner({ email: revokedMember.email, status: 'ACTIVE' })) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues).toEqual([{ status: 'ACTIVE' }]);
    expect(response.body).toMatchObject({ householdId: 'house-alone', role: 'Admin', status: 'ACTIVE' });
  });
});

// Audit S3: anyone but the owner deletes their own account; the household's last account takes the household with it.
describe('DELETE /api/users: account deletion and its cleanup', () => {
  const originalSecret = process.env.SESSION_SECRET;
  const member = { id: 'usr-member', email: 'member@example.com', name: 'Member', householdId: adminRow.householdId, role: 'Member', status: 'ACTIVE' };
  const deleteAs = (identity: { email: string; householdId: string; role: string }, email: string) => ({
    ...postAs(identity, undefined),
    method: 'DELETE',
    query: { email },
  });
  const asMember = (email: string) => deleteAs({ email: member.email, householdId: member.householdId, role: 'Member' }, email);
  // One row of each kind in the admin's household, and the same in another household that must stay
  const householdRows = (householdId: string, suffix: string) => ({
    puppies: [{ id: `pup-${suffix}`, householdId }, { id: `pup-${suffix}-deleted`, householdId, deletedAt: new Date() }],
    activities: [{ id: `act-${suffix}`, householdId }],
    health_records: [{ id: `hr-${suffix}`, householdId }],
    caretakers: [
      { id: `badge-${suffix}-member`, householdId, email: 'Member@Example.com' },
      { id: `badge-${suffix}-admin`, householdId, email: adminRow.email },
      { id: `badge-${suffix}-unlinked`, householdId, email: null },
    ],
    households: [{ id: householdId }],
    // Into the household, for someone else: it goes with the household only
    invites: [{ id: `inv-into-${suffix}`, householdId, email: 'friend@example.com' }],
  });

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...member }, { ...activeElsewhere }];
    const own = householdRows(adminRow.householdId, 'own');
    const other = householdRows(activeElsewhere.householdId, 'other');
    for (const table of ['puppies', 'activities', 'health_records', 'caretakers', 'households', 'invites'] as const) {
      dbMock[table] = [...own[table], ...other[table]];
    }
    // Addressed to the member, into another household: it goes with the account
    dbMock.invites.push({ id: 'inv-to-member', householdId: 'hh-third', email: member.email });
    dbMock.batches = 0;
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("lets a Member delete their own account: the account, its badge and the invites addressed to it go, the household's other rows stay", async () => {
    const response = createMockResponse();
    await usersHandler(asMember(member.email) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.batches).toBe(1);
    expect(ids(dbMock.users)).toEqual([adminRow.id, activeElsewhere.id]);
    expect(ids(dbMock.caretakers)).toEqual(['badge-own-admin', 'badge-own-unlinked', 'badge-other-member', 'badge-other-admin', 'badge-other-unlinked']);
    expect(dbMock.puppies).toHaveLength(4);
    expect(dbMock.activities).toHaveLength(2);
    expect(dbMock.health_records).toHaveLength(2);
    expect(dbMock.households).toHaveLength(2);
    expect(ids(dbMock.invites)).toEqual(['inv-into-own', 'inv-into-other']);
  });

  it("deletes the whole household with its last account: dogs (deleted ones too), logs, health records, badges, invites into it and the household row", async () => {
    dbMock.users = [{ ...member }, { ...activeElsewhere }];
    const response = createMockResponse();
    await usersHandler(asMember(member.email) as any, response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.batches).toBe(1);
    expect(ids(dbMock.users)).toEqual([activeElsewhere.id]);
    expect(ids(dbMock.puppies)).toEqual(['pup-other', 'pup-other-deleted']);
    expect(ids(dbMock.activities)).toEqual(['act-other']);
    expect(ids(dbMock.health_records)).toEqual(['hr-other']);
    expect(ids(dbMock.caretakers)).toEqual(['badge-other-member', 'badge-other-admin', 'badge-other-unlinked']);
    expect(ids(dbMock.households)).toEqual([activeElsewhere.householdId]);
    expect(ids(dbMock.invites)).toEqual(['inv-into-other']);
  });

  it("refuses (403) a Member deleting someone else's account, and deletes nothing", async () => {
    const response = createMockResponse();
    await usersHandler(asMember(adminRow.email) as any, response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.batches).toBe(0);
    expect(dbMock.users).toHaveLength(3);
  });

  it("refuses (403) the owner deleting the owner's own account", async () => {
    dbMock.users.push({ id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner', householdId: 'hh-owner', role: 'SuperAdmin', status: 'ACTIVE' });
    const response = createMockResponse();
    await usersHandler(deleteAs({ email: SUPER_ADMIN_EMAIL, householdId: 'hh-owner', role: 'SuperAdmin' }, SUPER_ADMIN_EMAIL) as any, response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.batches).toBe(0);
    expect(dbMock.users).toHaveLength(4);
  });

  it("uses the same cleanup when an Admin deletes a member of its household", async () => {
    const response = createMockResponse();
    await usersHandler(deleteAs({ email: adminRow.email, householdId: adminRow.householdId, role: 'Admin' }, member.email) as any, response);

    expect(response.statusCode).toBe(200);
    expect(ids(dbMock.users)).toEqual([adminRow.id, activeElsewhere.id]);
    expect(ids(dbMock.caretakers)).not.toContain('badge-own-member');
    expect(dbMock.puppies).toHaveLength(4);
  });
});
