import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// _auth.ts reads the database URL at import: without one, the Google path stops before its users lookup.
vi.hoisted(() => {
  process.env.POSTGRES_URL = 'postgres://example.invalid/db';
});

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

// The users rows the lookup returns; null makes it fail
const usersLookup = vi.hoisted(() => ({ rows: null as unknown[] | null }));

// Like drizzle: a failed query's message carries the SQL and its parameters, here an email
vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () =>
          usersLookup.rows
            ? Promise.resolve(usersLookup.rows)
            : Promise.reject(new Error('Failed query: select "id", "email" from "users" where "users"."email" = $1\nparams: someone@example.com')),
      }),
    }),
  })),
}));

import activitiesHandler from '../../../api/activities.js';
import dashboardHandler from '../../../api/dashboard.js';
import dogsHandler from '../../../api/dogs.js';
import healthRecordsHandler from '../../../api/health-records.js';
import householdsHandler from '../../../api/households.js';
import usersHandler from '../../../api/users.js';
import sessionHandler from '../../../api/auth/session.js';

const handlers = { activitiesHandler, dashboardHandler, dogsHandler, healthRecordsHandler, householdsHandler, usersHandler, sessionHandler };

function createMockResponse() {
  const response = {
    statusCode: 200,
    body: null as unknown,
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

const request = (headers: Record<string, string>) => ({ method: 'GET', headers, query: {} }) as never;
const googleTokenInfo = (emailVerified: boolean) =>
  new Response(JSON.stringify({ aud: 'test-client-id', email: 'someone@example.com', email_verified: emailVerified, name: 'Someone' }));

describe('a failed sign-in check answers with no SQL or email (every handler)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    // A valid Google ID token: verifyAuth goes on to the users lookup, which fails
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(googleTokenInfo(true));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    usersLookup.rows = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(Object.entries(handlers))('%s: a database error is a logged, generic 500', async (_name, handler) => {
    const response = createMockResponse();

    await handler(request({ authorization: 'Bearer google-id-token' }), response as never);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(console.error).toHaveBeenCalled();
  });

  it.each(Object.entries(handlers))('%s: a deliberate auth refusal keeps its status and message', async (_name, handler) => {
    const response = createMockResponse();

    await handler(request({}), response as never);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Missing Authorization header' });
  });

  it.each(Object.entries(handlers))('%s: an unverified Google email keeps its 401', async (_name, handler) => {
    vi.mocked(fetch).mockResolvedValue(googleTokenInfo(false));
    const response = createMockResponse();

    await handler(request({ authorization: 'Bearer google-id-token' }), response as never);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid token payload' });
  });

  it.each(Object.entries(handlers))('%s: an account pending activation keeps its 403', async (_name, handler) => {
    usersLookup.rows = [{ id: 'usr-1', householdId: 'house-1', email: 'someone@example.com', name: 'Someone', role: 'Member', status: 'PENDING_APPROVAL' }];
    const response = createMockResponse();

    await handler(request({ authorization: 'Bearer google-id-token' }), response as never);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Account pending activation by Super Admin.' });
  });
});
