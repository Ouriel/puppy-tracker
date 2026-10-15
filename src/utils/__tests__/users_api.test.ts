import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken } from '../../../api/_auth.js';
import usersHandler from '../../../api/users.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

// Hermetic DB: users rows are filtered by the WHERE parameters (email, then household when present).
const dbMock = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  updatedValues: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
  neonConfig: { fetchConnectionCache: false },
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  const matching = (condition: SQL) => {
    const [email, householdId] = new PgDialect().sqlToQuery(condition).params as string[];
    return dbMock.users.filter((row) => row.email === email && (householdId === undefined || row.householdId === householdId));
  };
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => ({
          where: vi.fn((condition: SQL) => Promise.resolve(getTableName(table) === 'users' ? matching(condition) : [])),
        })),
      })),
      update: vi.fn(() => ({
        set: (values: Record<string, unknown>) => {
          dbMock.updatedValues.push(values);
          return {
            where: (condition: SQL) => ({
              returning: () => {
                const [email] = new PgDialect().sqlToQuery(condition).params as string[];
                const row = dbMock.users.find((item) => item.id === email || item.email === email);
                return Promise.resolve(row ? [{ ...row, ...values }] : []);
              },
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

  // Only the owner moves accounts between households. A revoked member is PENDING_APPROVAL too, so a pending
  // account of another family is refused like an active one, with no row data.
  it.each([
    ['a pending (or revoked) account', pendingStranger.email],
    ['an active member', activeElsewhere.email],
  ])('refuses (403) to let an admin who is not the super admin take %s of another household', async (_label, email) => {
    const response = createMockResponse();
    await usersHandler(asAdmin({ email, role: 'Member', status: 'ACTIVE', confirmMove: true }), response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: expect.any(String) });
    expect(dbMock.updatedValues).toEqual([]);
    expect(dbMock.insertedValues).toEqual([]);
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
});
