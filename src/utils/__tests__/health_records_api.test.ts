import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signAppSessionToken } from '../../../api/_auth.js';
import handler from '../../../api/health-records.js';

// What PUT hands to drizzle's update().set(), and the stored record it answers with
const dbMock = vi.hoisted(() => ({ setValues: null as Record<string, unknown> | null }));

vi.mock('@neondatabase/serverless', () => ({ neon: vi.fn(() => vi.fn()) }));

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    // verifyAuth's users lookup
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: () => Promise.resolve([{ id: 'usr-1', email: 'user@example.com', name: 'Owner', householdId: 'hh-1', role: 'Admin', status: 'ACTIVE' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        dbMock.setValues = values;
        return { where: () => ({ returning: () => Promise.resolve([{ id: 'hr-1', ...values }]) }) };
      },
    })),
  })),
}));

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

async function put(body: Record<string, unknown>) {
  process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
  const token = signAppSessionToken({ email: 'user@example.com', name: 'Owner', householdId: 'hh-1', role: 'Admin' }, 30);
  const response = createMockResponse();
  await handler({ method: 'PUT', headers: { authorization: `Bearer ${token}` }, query: {}, body } as any, response);
  return response;
}

/** The columns the UPDATE writes: drizzle's set() skips undefined values (mapUpdateSet in drizzle-orm/utils.js). */
const writtenColumns = () => Object.fromEntries(Object.entries(dbMock.setValues!).filter(([, value]) => value !== undefined));

beforeEach(() => {
  dbMock.setValues = null;
});

describe('PUT /api/health-records writes only the fields sent (pre-fill review item 3)', () => {
  it('an edit that does not send the clinic, lot, notes or weight leaves them as stored', async () => {
    const response = await put({ id: 'hr-1', puppyId: 'pup-1', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-21', boosterDate: '2026-10-21' });

    expect(response.statusCode).toBe(200);
    expect(Object.keys(writtenColumns()).sort()).toEqual(['boosterDate', 'date', 'name', 'productName']);
  });

  it('a field sent as null or empty is cleared', async () => {
    await put({ id: 'hr-1', name: 'Rage', date: '2026-09-01', boosterDate: null, vetClinic: '', batchNumber: null });

    expect(dbMock.setValues).toMatchObject({ boosterDate: null, vetClinic: null, batchNumber: null });
    expect(Object.keys(writtenColumns()).sort()).toEqual(['batchNumber', 'boosterDate', 'date', 'name', 'vetClinic']);
  });
});
