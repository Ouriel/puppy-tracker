import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken } from '../../../api/_auth.js';
import usersHandler from '../../../api/users.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

type Row = Record<string, unknown>;

// Hermetic DB: rows are filtered by every `"column" = $n` / `"column" <> $n` / `lower("column") = $n` of the WHERE.
// A delete removes the matching rows at once, so the rows left are what the database would keep.
const dbMock = vi.hoisted(() => ({
  users: [] as Row[],
  puppies: [] as Row[],
  caretakers: [] as Row[],
  activities: [] as Row[],
  health_records: [] as Row[],
  households: [] as Row[],
  updatedValues: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
  batches: 0,
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
      [...sql.matchAll(/(lower\((?:"\w+"\.)?)?"(\w+)"\)? (=|<>) \$(\d+)/g)].every(([, lower, column, operator, index]) => {
        const field = column.replace(/_(\w)/g, (_match, letter: string) => letter.toUpperCase());
        const value = lower ? String(row[field] ?? '').toLowerCase() : row[field];
        return (value === params[Number(index) - 1]) === (operator === '=');
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
        })),
      })),
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
          return { returning: () => Promise.resolve([values]) };
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

describe('POST /api/users: pre-approving someone who already has an account (20)', () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...pendingStranger }, { ...activeElsewhere }];
    dbMock.puppies = [];
    dbMock.updatedValues = [];
    dbMock.insertedValues = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it('asks for a confirmation (409) before moving an account from another household, and changes nothing', async () => {
    const response = createMockResponse();
    await usersHandler(asOwner({ email: pendingStranger.email, role: 'Member', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: expect.any(String) });
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.insertedValues).toEqual([]);
  });

  it('once confirmed, moves them into the inviter household, activates them and keeps their Google name', async () => {
    const response = createMockResponse();
    await usersHandler(asOwner({ email: pendingStranger.email, name: 'jane.doe', role: 'Member', status: 'ACTIVE', confirmMove: true }), response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues).toHaveLength(1);
    expect(dbMock.updatedValues[0]).toMatchObject({ householdId: 'hh-owner', status: 'ACTIVE' });
    expect(dbMock.updatedValues[0]).not.toHaveProperty('name');
    expect(response.body).toMatchObject({ name: 'Jane Doe', householdId: 'hh-owner' });
  });

  // Backlog 12: a second parent who signed in before being invited waits alone in an empty household of their own.
  it('lets an admin take in a sign-up waiting alone in a household with no dog: moved, activated, a Member, keeping its name', async () => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: pendingStranger.email, role: 'Member', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues).toEqual([{ role: 'Member', status: 'ACTIVE', householdId: adminRow.householdId }]);
    expect(response.body).toMatchObject({ name: 'Jane Doe', householdId: adminRow.householdId, role: 'Member', status: 'ACTIVE' });
  });

  it('makes everyone an admin takes in a Member, whatever role their account had', async () => {
    dbMock.users = dbMock.users.map((row) => (row.email === pendingStranger.email ? { ...row, role: 'Admin' } : row));
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: pendingStranger.email, status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).toMatchObject({ role: 'Member' });
  });

  // Only the owner moves any other account between households: a pending account of a family with a dog or other
  // members is refused like an active one, and a revoked one even alone with no dog (audit S2), with no row data.
  it.each([
    ['an active member of another household', activeElsewhere.email, () => {}],
    ['a revoked account alone in a household with no dog', pendingStranger.email, () => {
      dbMock.users = dbMock.users.map((row) => (row.email === pendingStranger.email ? { ...row, status: 'REVOKED' } : row));
    }],
    ['a revoked account of its own household', 'revoked@example.com', () =>
      dbMock.users.push({ id: 'usr-revoked', email: 'revoked@example.com', name: 'Revoked', householdId: adminRow.householdId, role: 'Member', status: 'REVOKED' })],
    ['a pending account of another household with a dog', pendingStranger.email, () => dbMock.puppies.push({ id: 'pup-jane', householdId: pendingStranger.householdId })],
    ['a pending account of another household with another account', pendingStranger.email, () =>
      dbMock.users.push({ id: 'usr-partner', email: 'partner@example.com', name: 'Partner', householdId: pendingStranger.householdId, role: 'Admin', status: 'ACTIVE' })],
  ])('answers an admin who is not the super admin 409, even confirmed, for %s, and changes nothing', async (_label, email, arrange) => {
    arrange();
    const response = createMockResponse();
    await usersHandler(asAdmin({ email, role: 'Member', status: 'ACTIVE', confirmMove: true }), response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: expect.any(String) });
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.insertedValues).toEqual([]);
  });

  it.each(['Admin', 'SuperAdmin'])('refuses (403) the %s role chosen by an admin who is not the super admin', async (role) => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com', role, status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.insertedValues).toEqual([]);
    expect(dbMock.updatedValues).toEqual([]);
  });

  it('refuses (403) an invite from a member, and changes nothing', async () => {
    dbMock.users.push({ id: 'usr-member', email: 'member@example.com', name: 'Member', householdId: adminRow.householdId, role: 'Member', status: 'ACTIVE' });
    const response = createMockResponse();
    await usersHandler(postAs({ email: 'member@example.com', householdId: adminRow.householdId, role: 'Member' }, { email: 'new.person@example.com', role: 'Member', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.insertedValues).toEqual([]);
    expect(dbMock.updatedValues).toEqual([]);
  });

  // Else an Admin re-inviting themselves (or a co-Admin) from the Members tab loses the role, and no screen gives it back.
  it("keeps the role of an account already in the admin's household (an admin re-inviting themselves)", async () => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: adminRow.email, role: 'Member', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).toMatchObject({ role: 'Admin' });
    expect(response.body).toMatchObject({ email: adminRow.email, role: 'Admin' });
  });

  it('refuses (403) a household chosen by an admin who is not the super admin', async () => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com', householdId: 'hh-other', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.insertedValues).toEqual([]);
  });

  it('re-activates an account already in the inviter household without asking, keeping its name', async () => {
    dbMock.users.push({ id: 'usr-revoked', email: 'revoked@example.com', name: 'Revoked Person', householdId: 'hh-owner', role: 'Member', status: 'PENDING_APPROVAL' });
    const response = createMockResponse();
    await usersHandler(asOwner({ email: 'revoked@example.com', name: 'revoked', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).toMatchObject({ status: 'ACTIVE' });
    expect(dbMock.updatedValues[0]).not.toHaveProperty('name');
  });

  it('creates a new account in the inviter household, named after the email', async () => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'New.Person@example.com', role: 'Member', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(201);
    expect(dbMock.insertedValues[0]).toMatchObject({ email: 'new.person@example.com', name: 'new.person', householdId: 'hh-admin', status: 'ACTIVE' });
  });

  it('lets the owner pre-approve a new account into another household (Admin panel household select)', async () => {
    const response = createMockResponse();
    await usersHandler(asOwner({ email: 'new.person@example.com', householdId: 'hh-other', status: 'ACTIVE' }), response);

    expect(response.statusCode).toBe(201);
    expect(dbMock.insertedValues[0]).toMatchObject({ householdId: 'hh-other' });
  });

  // As PUT already refuses: else an admin of the owner's household revokes the owner, whose next Google sign-in fails.
  it("refuses (403) an admin who is not the super admin rewriting the owner's account, and changes nothing", async () => {
    dbMock.users.push({ id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner Fullname', householdId: adminRow.householdId, role: 'SuperAdmin', status: 'ACTIVE' });
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: SUPER_ADMIN_EMAIL, role: 'Member', status: 'PENDING_APPROVAL' }), response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: expect.any(String) });
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

describe("POST /api/users: the owner's invite into a new household", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...activeElsewhere }];
    dbMock.puppies = [];
    dbMock.updatedValues = [];
    dbMock.insertedValues = [];
    dbMock.batches = 0;
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it('creates the named household and the invitee as its active Admin, in one batch', async () => {
    const response = createMockResponse();
    await usersHandler(asOwner({ email: 'New.Person@example.com', role: 'Member', status: 'ACTIVE', newHouseholdName: '  Famille Durand ' }), response);

    expect(response.statusCode).toBe(201);
    expect(dbMock.batches).toBe(1);
    const [household, account] = dbMock.insertedValues;
    expect(household).toEqual({ id: expect.stringMatching(/^house-/), familyPackId: household.id, name: 'Famille Durand' });
    expect(account).toMatchObject({ householdId: household.id, email: 'new.person@example.com', role: 'Admin', status: 'ACTIVE' });
  });

  it('asks before moving an account that lives elsewhere, then moves it in as the Admin', async () => {
    const refused = createMockResponse();
    await usersHandler(asOwner({ email: activeElsewhere.email, status: 'ACTIVE', newHouseholdName: 'Famille Durand' }), refused);
    expect(refused.statusCode).toBe(409);
    expect(dbMock.batches).toBe(0);
    dbMock.insertedValues = [];

    const response = createMockResponse();
    await usersHandler(asOwner({ email: activeElsewhere.email, status: 'ACTIVE', newHouseholdName: 'Famille Durand', confirmMove: true }), response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.batches).toBe(1);
    const [household] = dbMock.insertedValues;
    expect(household).toMatchObject({ name: 'Famille Durand' });
    expect(dbMock.updatedValues).toEqual([{ role: 'Admin', status: 'ACTIVE', householdId: household.id }]);
  });

  it('refuses a family Admin, and writes nothing', async () => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email: 'new.person@example.com', status: 'ACTIVE', newHouseholdName: 'Famille Durand' }), response);

    expect(response.statusCode).toBe(403);
    expect(dbMock.insertedValues).toEqual([]);
    expect(dbMock.batches).toBe(0);
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
  });
  const ids = (rows: Row[]) => rows.map((row) => row.id);

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.users = [adminRow, { ...member }, { ...activeElsewhere }];
    const own = householdRows(adminRow.householdId, 'own');
    const other = householdRows(activeElsewhere.householdId, 'other');
    for (const table of ['puppies', 'activities', 'health_records', 'caretakers', 'households'] as const) {
      dbMock[table] = [...own[table], ...other[table]];
    }
    dbMock.batches = 0;
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("lets a Member delete their own account: the account and its badge go, the household's other rows stay", async () => {
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
  });

  it("deletes the whole household with its last account: dogs (deleted ones too), logs, health records, badges and the household row", async () => {
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
