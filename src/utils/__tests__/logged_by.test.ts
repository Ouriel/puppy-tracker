import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Table } from 'drizzle-orm';
import { signAppSessionToken } from '../../../api/_auth.js';
import activitiesHandler from '../../../api/activities.js';
import { getCurrentCaretakerName } from '../caretakers';

// Real household caretakers (read-only SELECT, 2026-10-14). Only Daria's row carries her email.
const PRODUCTION_CARETAKERS = [
  { name: 'Matthieu', email: null },
  { name: 'Daria', email: 'daria@example.com' },
  { name: 'Dasha', email: null },
];

const dbMock = vi.hoisted(() => ({
  selectCount: 0,
  insertedValues: [] as Array<Record<string, unknown>>,
  updatedValues: [] as Array<Record<string, unknown>>,
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/neon-http', async () => {
  const { getTableName } = await import('drizzle-orm');
  const resolved = (rows: unknown[]) => {
    const query: any = {
      where: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    };
    return query;
  };
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => {
          dbMock.selectCount += 1;
          // The first select of a request is verifyAuth's users lookup.
          if (dbMock.selectCount === 1) {
            return resolved([{ id: 'usr-2', email: 'daria@example.com', name: 'daria.risko', householdId: 'hh-1', role: 'Member', status: 'ACTIVE' }]);
          }
          const tableName = getTableName(table);
          if (tableName === 'caretakers') return resolved(PRODUCTION_CARETAKERS);
          return resolved(tableName === 'puppies' ? [{ id: 'pup-1', householdId: 'hh-1' }] : []);
        }),
      })),
      insert: vi.fn(() => ({
        values: (values: Record<string, unknown>) => {
          dbMock.insertedValues.push(values);
          return { returning: () => Promise.resolve([values]) };
        },
      })),
      update: vi.fn(() => ({
        set: (values: Record<string, unknown>) => {
          dbMock.updatedValues.push(values);
          return { where: () => ({ returning: () => Promise.resolve([{ id: 'act-1', timestamp: new Date('2026-10-14T08:00:00Z'), ...values }]) }) };
        },
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

function requestAsDaria(method: string, body: unknown) {
  const token = signAppSessionToken({ email: 'daria@example.com', name: 'daria.risko', householdId: 'hh-1', role: 'Member' }, 30);
  return { method, headers: { authorization: `Bearer ${token}` }, query: {}, body } as any;
}

describe('getCurrentCaretakerName (what the log modal shows as "logged by")', () => {
  it('gives each production user the name their recent logs carry', () => {
    expect(getCurrentCaretakerName({ email: 'owner@example.com', name: 'Matthieu Jacquet' }, PRODUCTION_CARETAKERS)).toBe('Matthieu Jacquet');
    expect(getCurrentCaretakerName({ email: 'daria@example.com', name: 'daria.risko' }, PRODUCTION_CARETAKERS)).toBe('Daria');
    expect(getCurrentCaretakerName({ email: 'other@example.com', name: 'guest.member' }, PRODUCTION_CARETAKERS)).toBe('guest.member');
  });

  it('matches a caretaker by exact name, ignoring case', () => {
    expect(getCurrentCaretakerName({ email: 'x@example.com', name: 'dasha' }, PRODUCTION_CARETAKERS)).toBe('Dasha');
  });

  it('falls back to the email prefix, then Unknown', () => {
    expect(getCurrentCaretakerName({ email: 'solo@example.com', name: '' }, [])).toBe('solo');
    expect(getCurrentCaretakerName(null, PRODUCTION_CARETAKERS)).toBe('Unknown');
  });
});

describe('/api/activities binds loggedBy to the signed-in user', () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.selectCount = 0;
    dbMock.insertedValues = [];
    dbMock.updatedValues = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it('POST stores the signed-in caretaker, whatever loggedBy the body claims', async () => {
    const response = createMockResponse();
    await activitiesHandler(
      requestAsDaria('POST', { puppyId: 'pup-1', type: 'pee', timestamp: '2026-10-14T08:00:00.000Z', loggedBy: 'Matthieu Jacquet', pottyLocation: 'outside' }),
      response
    );
    expect(response.statusCode).toBe(201);
    expect(dbMock.insertedValues[0].loggedBy).toBe('Daria');
  });

  // 32: an edit that empties the note sends null
  it('PUT with notes null deletes the note', async () => {
    const response = createMockResponse();
    await activitiesHandler(requestAsDaria('PUT', { id: 'act-1', type: 'pee', notes: null }), response);
    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0].notes).toBeNull();
  });

  it('PUT never changes who logged an activity', async () => {
    const response = createMockResponse();
    await activitiesHandler(requestAsDaria('PUT', { id: 'act-1', notes: 'edited', loggedBy: 'Matthieu Jacquet' }), response);
    expect(response.statusCode).toBe(200);
    expect(dbMock.updatedValues[0]).not.toHaveProperty('loggedBy');
  });
});
