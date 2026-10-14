import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken, verifyAppSessionToken, verifyAuth } from '../../../api/_auth.js';
import activitiesHandler from '../../../api/activities.js';

// Hermetic DB: no puppy matches the ownership lookup, and every WHERE clause and insert is recorded.
const dbMock = vi.hoisted(() => ({ whereByTable: new Map<string, SQL>(), insert: vi.fn() }));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
  neonConfig: { fetchConnectionCache: false },
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => ({
          where: vi.fn((condition: SQL) => {
            dbMock.whereByTable.set(getTableName(table), condition);
            return Promise.resolve([]);
          }),
        })),
      })),
      insert: dbMock.insert,
    })),
  };
});

describe('API Security & Session Token Validation Test Suite', () => {
  const originalEnv = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalEnv;
  });

  it('generates and cryptographically verifies a valid App Session Token', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Husband',
    };

    const token = signAppSessionToken(payload, 30);
    expect(token).toBeDefined();
    expect(token.split('.').length).toBe(3);

    const verified = verifyAppSessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe('user@example.com');
    expect(verified?.householdId).toBe('hh-family-123');
    expect(verified?.role).toBe('Husband');
  });

  it('rejects tampered tokens with invalid signatures', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Member',
    };

    const token = signAppSessionToken(payload, 30);
    const [header, , signature] = token.split('.');

    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, role: 'SuperAdmin' })
    ).toString('base64url');

    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
    const result = verifyAppSessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it('rejects expired tokens', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Member',
    };

    // Generate token with negative expiration (-1 day)
    const token = signAppSessionToken(payload, -1);
    const result = verifyAppSessionToken(token);
    expect(result).toBeNull();
  });

  it('prevents privilege escalation by spoofing SuperAdmin role in non-admin email token', () => {
    const payload = {
      email: 'hacker@random-domain.com',
      name: 'Attacker',
      householdId: 'hh-123',
      role: 'SuperAdmin',
    };

    const token = signAppSessionToken(payload, 30);
    const verified = verifyAppSessionToken(token);

    expect(verified).not.toBeNull();
    // Non-superadmin email MUST be downgraded to Member
    expect(verified?.role).toBe('Member');
  });

  it('rejects an activity POST for a puppy outside the token household with 403', async () => {
    const token = signAppSessionToken(
      { email: 'user@example.com', name: 'Matthieu', householdId: 'hh-family-123', role: 'Husband' },
      30
    );
    const request = {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      query: {},
      body: { puppyId: 'pup-other-household', type: 'pee', timestamp: '2026-08-17T12:00:00.000Z' },
    } as any;
    const response: any = {
      statusCode: 200,
      body: null,
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        response.statusCode = code;
        return response;
      }),
      json: vi.fn((data: unknown) => {
        response.body = data;
        return response;
      }),
    };

    await activitiesHandler(request, response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Puppy not found in your household' });
    expect(dbMock.insert).not.toHaveBeenCalled();
    // The ownership lookup is scoped to the requested puppy AND the household carried by the token
    const ownershipQuery = new PgDialect().sqlToQuery(dbMock.whereByTable.get('puppies')!);
    expect(ownershipQuery.sql).toBe('("puppies"."id" = $1 and "puppies"."household_id" = $2)');
    expect(ownershipQuery.params).toEqual(['pup-other-household', 'hh-family-123']);
  });

  describe('verifyAuth Request Middleware', () => {
    it('authenticates valid Bearer App Session Token on 0ms fast path', async () => {
      const payload = {
        email: 'user@example.com',
        name: 'Matthieu',
        householdId: 'hh-family-123',
        role: 'Husband',
      };
      const token = signAppSessionToken(payload, 30);
      const mockReq = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const auth = await verifyAuth(mockReq);
      expect(auth).toBeDefined();
      expect(auth.email).toBe('user@example.com');
      expect(auth.householdId).toBe('hh-family-123');
    });

    it('rejects requests with missing Authorization header with status 401', async () => {
      const mockReq = {
        headers: {},
      } as any;

      await expect(verifyAuth(mockReq)).rejects.toEqual({
        status: 401,
        message: 'Missing Authorization header',
      });
    });

    it('rejects requests with non-Bearer Authorization header with status 401', async () => {
      const mockReq = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      } as any;

      await expect(verifyAuth(mockReq)).rejects.toEqual({
        status: 401,
        message: 'Missing Authorization header',
      });
    });
  });
});
