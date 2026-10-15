import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken } from '../../../api/_auth.js';
import usersHandler from '../../../api/users.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

// Hermetic DB: users and puppies rows are filtered by every `"column" = $n` / `"column" <> $n` of the WHERE.
const dbMock = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  puppies: [] as Array<Record<string, unknown>>,
  updatedValues: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
  neonConfig: { fetchConnectionCache: false },
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  const matching = (table: Table, condition: SQL) => {
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    const rows = { users: dbMock.users, puppies: dbMock.puppies }[getTableName(table)] ?? [];
    return rows.filter((row) =>
      [...sql.matchAll(/"(\w+)" (=|<>) \$(\d+)/g)].every(([, column, operator, index]) => {
        const field = column.replace(/_(\w)/g, (_match, letter: string) => letter.toUpperCase());
        return (row[field] === params[Number(index) - 1]) === (operator === '=');
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

  // Only the owner moves any other account between households. A revoked member is PENDING_APPROVAL too, so
  // a pending account of a family with a dog or other members is refused like an active one, with no row data.
  it.each([
    ['an active member of another household', activeElsewhere.email, () => {}],
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
describe("PUT /api/users: the owner's approval (Admin panel 'Approve & Assign')", () => {
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
