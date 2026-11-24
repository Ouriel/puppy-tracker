import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SQL, Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { signAppSessionToken } from '../../../api/_auth.js';
import handler, { HOURLY_REQUEST_CAP } from '../../../api/privacy-requests.js';
import { SUPER_ADMIN_EMAIL } from '../auth.js';

// Hermetic DB: privacy_requests rows, the count of the last hour, and the users rows verifyAuth re-reads
const dbMock = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  users: [] as Array<Record<string, unknown>>,
  lastHour: 0,
  inserted: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
  deletes: 0,
  deleteConditions: [] as string[],
}));

vi.mock('@neondatabase/serverless', () => ({ neon: vi.fn(() => vi.fn()) }));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn((fields?: Record<string, unknown>) => ({
        from: vi.fn((table: Table) => ({
          where: () => Promise.resolve(fields ? [{ value: dbMock.lastHour }] : getTableName(table) === 'users' ? dbMock.users : []),
          orderBy: () => Promise.resolve(dbMock.requests),
        })),
      })),
      insert: vi.fn(() => ({
        values: (values: Record<string, unknown>) => {
          dbMock.inserted.push(values);
          return Promise.resolve();
        },
      })),
      delete: vi.fn(() => ({
        where: (condition: SQL) => {
          dbMock.deletes += 1;
          dbMock.deleteConditions.push(new PgDialect().sqlToQuery(condition).sql);
          return Promise.resolve();
        },
      })),
      update: vi.fn(() => ({
        set: (values: Record<string, unknown>) => {
          dbMock.updated.push(values);
          return { where: () => ({ returning: () => Promise.resolve(dbMock.requests.map((row) => ({ ...row, ...values }))) }) };
        },
      })),
    })),
  };
});

function createMockResponse() {
  const response: any = {
    statusCode: 200,
    body: null,
    location: '',
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
    redirect: vi.fn((code: number, url: string) => {
      response.statusCode = code;
      response.location = url;
      return response;
    }),
  };
  return response;
}

const form = (body: Record<string, string>) => ({ method: 'POST', headers: {}, query: {}, body }) as any;
const signedIn = (method: string, email: string, role: string, body?: unknown) => {
  const token = signAppSessionToken({ email, name: 'Someone', householdId: 'hh-1', role }, 30);
  return { method, headers: { authorization: `Bearer ${token}` }, query: {}, body } as any;
};

describe('/api/privacy-requests: the privacy policy form', () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.requests = [];
    dbMock.users = [];
    dbMock.lastHour = 0;
    dbMock.inserted = [];
    dbMock.updated = [];
    dbMock.deletes = 0;
    dbMock.deleteConditions = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it('stores a request sent without signing in and goes back to the page\'s confirmation, in its language', async () => {
    const response = createMockResponse();
    await handler(form({ email: 'Alice@Example.com', kind: 'erase', message: '  Please delete my account  ', lang: 'fr', website: '' }), response);

    expect(response.statusCode).toBe(303);
    expect(response.location).toBe('/privacy#demande-envoyee');
    expect(dbMock.inserted).toEqual([{ id: expect.stringMatching(/^prq-/), email: 'alice@example.com', kind: 'erase', message: 'Please delete my account', lang: 'fr' }]);
  });

  it('a filled trap field (a bot) gets the usual answer, and nothing is stored', async () => {
    const response = createMockResponse();
    await handler(form({ email: 'bot@example.com', kind: 'other', lang: 'en', website: 'https://spam.example' }), response);

    expect(response.location).toBe('/privacy#request-sent');
    expect(dbMock.inserted).toEqual([]);
  });

  it('an invalid email or kind goes back to the "not sent" box, and nothing is stored', async () => {
    for (const body of [{ email: 'not-an-email', kind: 'access', lang: 'en' }, { email: 'a@example.com', kind: 'everything', lang: 'en' }]) {
      const response = createMockResponse();
      await handler(form(body), response);
      expect(response.location).toBe('/privacy#request-failed');
    }
    expect(dbMock.inserted).toEqual([]);
  });

  it(`past ${HOURLY_REQUEST_CAP} requests in an hour, refuses until the hour has passed`, async () => {
    dbMock.lastHour = HOURLY_REQUEST_CAP;
    const response = createMockResponse();
    await handler(form({ email: 'a@example.com', kind: 'access', lang: 'en' }), response);

    expect(response.location).toBe('/privacy#request-failed');
    expect(dbMock.inserted).toEqual([]);
  });

  it('lists the requests for the owner only, with ISO dates, after deleting those answered over a year ago', async () => {
    dbMock.requests = [{ id: 'prq-1', email: 'a@example.com', kind: 'access', message: null, lang: 'en', createdAt: new Date('2026-11-20T10:00:00Z'), handledAt: null }];

    const anonymous = createMockResponse();
    await handler({ method: 'GET', headers: {}, query: {} } as any, anonymous);
    expect(anonymous.statusCode).toBe(401);

    dbMock.users = [{ id: 'usr-m', email: 'member@example.com', name: 'Member', householdId: 'hh-1', role: 'Admin', status: 'ACTIVE' }];
    const familyAdmin = createMockResponse();
    await handler(signedIn('GET', 'member@example.com', 'Admin'), familyAdmin);
    expect(familyAdmin.statusCode).toBe(403);
    expect(dbMock.deletes).toBe(0);

    const owner = createMockResponse();
    await handler(signedIn('GET', SUPER_ADMIN_EMAIL, 'SuperAdmin'), owner);
    expect(owner.statusCode).toBe(200);
    expect(dbMock.deletes).toBe(1);
    // Answered over a year ago, or never answered and sent over a year ago
    expect(dbMock.deleteConditions[0]).toMatch(/"handled_at" < \$1 or \("privacy_requests"\."handled_at" is null and "privacy_requests"\."created_at" < \$2\)/);
    expect(owner.body).toEqual([{ id: 'prq-1', email: 'a@example.com', kind: 'access', message: null, lang: 'en', createdAt: '2026-11-20T10:00:00.000Z', handledAt: null }]);
  });

  it('the owner marks a request answered', async () => {
    dbMock.requests = [{ id: 'prq-1', email: 'a@example.com', kind: 'access', message: null, lang: 'en', createdAt: new Date('2026-11-20T10:00:00Z'), handledAt: null }];
    const response = createMockResponse();
    await handler(signedIn('PUT', SUPER_ADMIN_EMAIL, 'SuperAdmin', { id: 'prq-1' }), response);

    expect(response.statusCode).toBe(200);
    expect(dbMock.updated).toEqual([{ handledAt: expect.any(Date) }]);
    expect(response.body.handledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
