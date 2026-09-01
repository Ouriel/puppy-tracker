import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../../api/dashboard.js';
import { signAppSessionToken } from '../../../api/_auth.js';

// Mock Neon & Drizzle DB queries so handler tests run hermetically without external network
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
  neonConfig: { fetchConnectionCache: false },
}));

const mockPuppies = [
  { id: 'pup-1', householdId: 'hh-123', name: 'Balma', breed: 'Cocker', birthDate: '2026-03-27' },
];
const mockCaretakers = [
  { id: 'ct-1', householdId: 'hh-123', name: 'Matthieu', role: 'Husband' },
];
const mockActivities = [
  {
    id: 'act-1',
    householdId: 'hh-123',
    puppyId: 'pup-1',
    type: 'pee',
    timestamp: new Date('2026-08-30T10:00:00.000Z'),
    loggedBy: 'Matthieu',
  },
];
const mockHealthRecords = [
  {
    id: 'hr-1',
    householdId: 'hh-123',
    puppyId: 'pup-1',
    type: 'vaccination',
    name: 'Rabies',
    date: '2026-08-01',
  },
];

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn((table: any) => {
        const queryChain: any = {
          where: vi.fn(() => queryChain),
          orderBy: vi.fn(() => queryChain),
          limit: vi.fn(() => Promise.resolve(mockActivities)),
          then: (resolve: any) => {
            if (table && table._ && table._.name === 'puppies') {
              return resolve(mockPuppies);
            }
            if (table && table._ && table._.name === 'caretakers') {
              return resolve(mockCaretakers);
            }
            if (table && table._ && table._.name === 'health_records') {
              return resolve(mockHealthRecords);
            }
            return resolve(mockActivities);
          },
        };
        return queryChain;
      }),
    })),
    batch: vi.fn((queries: any[]) => Promise.all(queries)),
  })),
}));

describe('Dashboard API Serverless Handler Unit Tests', () => {
  const originalEnv = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalEnv;
  });

  function createMockResponse() {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: null,
      status: vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn((data: any) => {
        res.body = data;
        return res;
      }),
      setHeader: vi.fn((key: string, value: string) => {
        res.headers[key.toLowerCase()] = value;
        return res;
      }),
      end: vi.fn(() => res),
    };
    return res;
  }

  it('handles OPTIONS preflight with status 200 and end()', async () => {
    const req: any = {
      method: 'OPTIONS',
      headers: {},
      query: {},
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('rejects unsupported HTTP methods (POST, PUT, DELETE) with 405 Method Not Allowed', async () => {
    const req: any = {
      method: 'POST',
      headers: {},
      query: {},
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });

  it('rejects requests with missing Authorization header with status 401', async () => {
    const req: any = {
      method: 'GET',
      headers: {},
      query: {},
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: 'Missing Authorization header' });
  });

  it('rejects requests with invalid or tampered Authorization token with status 401', async () => {
    const req: any = {
      method: 'GET',
      headers: {
        authorization: 'Bearer invalid.token.signature',
      },
      query: {},
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('authenticates valid session token and serves dashboard payload with healthRecords', async () => {
    const validToken = signAppSessionToken({
      email: 'matthieu@example.com',
      name: 'Matthieu',
      householdId: 'hh-123',
      role: 'Husband',
    }, 30);

    const req: any = {
      method: 'GET',
      headers: {
        authorization: `Bearer ${validToken}`,
      },
      query: {
        puppyId: 'pup-1',
        days: '14',
      },
    };
    const res = createMockResponse();

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers['cache-control']).toBe('private, max-age=10, stale-while-revalidate=60');
    expect(res.body).toBeDefined();
    expect(res.body.healthRecords).toBeDefined();
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(Array.isArray(res.body.puppies)).toBe(true);
    expect(Array.isArray(res.body.caretakers)).toBe(true);
  });
});
