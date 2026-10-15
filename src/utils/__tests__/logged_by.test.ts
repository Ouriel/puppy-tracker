import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Table } from 'drizzle-orm';
import { signAppSessionToken } from '../../../api/_auth.js';
import activitiesHandler from '../../../api/activities.js';
import { getCurrentCaretakerName, findLinkedCaretaker, BADGE_COLORS } from '../caretakers';

// The real household's shape since 'Members data done 2026-10-15' (read-only SELECT): 3 badges, each linked by
// email to one account, no exact-name matches. Emails and account names here are placeholders.
const PRODUCTION_CARETAKERS = [
  { name: 'Matthieu', email: 'owner@example.com' },
  { name: 'Daria', email: 'daria@example.com' },
  { name: 'Dasha', email: 'dasha@example.com' },
];
const PRODUCTION_ACCOUNTS = [
  { email: 'owner@example.com', name: 'Owner Fullname', badge: 'Matthieu' },
  { email: 'daria@example.com', name: 'daria.doe', badge: 'Daria' },
  { email: 'DASHA@example.com', name: 'dasha.handle', badge: 'Dasha' },
];

const DARIA_ACCOUNT = { id: 'usr-2', email: 'daria@example.com', name: 'daria.doe', householdId: 'hh-1', role: 'Member', status: 'ACTIVE' };

const dbMock = vi.hoisted(() => ({
  // The users row verifyAuth reads, and the household's badges (shared by concurrent requests)
  account: null as Record<string, unknown> | null,
  caretakers: [] as Array<Record<string, unknown>>,
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
  // As in production, the primary key is the only unique index on caretakers.
  const insertBadge = (values: Record<string, unknown>, ignoreConflict: boolean) => {
    if (dbMock.caretakers.some((badge) => badge.id === values.id)) {
      return ignoreConflict ? Promise.resolve([]) : Promise.reject(new Error('duplicate key value violates unique constraint "caretakers_pkey"'));
    }
    dbMock.caretakers.push(values);
    return Promise.resolve([values]);
  };
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn((table: Table) => {
          const tableName = getTableName(table);
          if (tableName === 'users') return resolved([dbMock.account]);
          if (tableName === 'caretakers') return resolved([...dbMock.caretakers]);
          return resolved(tableName === 'puppies' ? [{ id: 'pup-1', householdId: 'hh-1' }] : []);
        }),
      })),
      insert: vi.fn((table: Table) => ({
        values: (values: Record<string, unknown>) => {
          if (getTableName(table) === 'caretakers') {
            return {
              returning: () => insertBadge(values, false),
              onConflictDoNothing: () => ({ returning: () => insertBadge(values, true) }),
            };
          }
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

function requestAs(account: { email: string; name: string }, method: string, body: unknown) {
  const token = signAppSessionToken({ email: account.email, name: account.name, householdId: 'hh-1', role: 'Member' }, 30);
  return { method, headers: { authorization: `Bearer ${token}` }, query: {}, body } as any;
}

const requestAsDaria = (method: string, body: unknown) => requestAs(DARIA_ACCOUNT, method, body);

// The production badges with their household, colours and ids
const HOUSEHOLD_BADGES = PRODUCTION_CARETAKERS.map((badge, index) => ({
  ...badge,
  id: `c-${index}`,
  householdId: 'hh-1',
  role: 'Member',
  color: BADGE_COLORS[index],
}));

describe('getCurrentCaretakerName (what the log modal shows as "logged by")', () => {
  it('gives each production account its own badge, for logged-by and for the active chip', () => {
    for (const account of PRODUCTION_ACCOUNTS) {
      expect(getCurrentCaretakerName(account, PRODUCTION_CARETAKERS)).toBe(account.badge);
      expect(findLinkedCaretaker(account, PRODUCTION_CARETAKERS)?.name).toBe(account.badge);
    }
  });

  it('never gives a linked badge to a user whose email no badge carries, even with a matching name', () => {
    for (const name of ['guest.member', 'dasha', 'Matthieu']) {
      expect(findLinkedCaretaker({ email: 'other@example.com', name }, PRODUCTION_CARETAKERS)).toBeUndefined();
      expect(getCurrentCaretakerName({ email: 'other@example.com', name }, PRODUCTION_CARETAKERS)).toBe(name);
    }
  });

  it('matches a badge without an email by exact name, ignoring case', () => {
    expect(getCurrentCaretakerName({ email: 'x@example.com', name: 'guest' }, [{ name: 'Guest', email: null }])).toBe('Guest');
  });

  it('prefers the badge linked by email over an earlier badge with the same name', () => {
    const caretakers = [
      { name: 'Dasha', email: null },
      { name: 'Dasha K', email: 'dasha@example.com' },
    ];
    expect(getCurrentCaretakerName({ email: 'dasha@example.com', name: 'Dasha' }, caretakers)).toBe('Dasha K');
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
    dbMock.account = DARIA_ACCOUNT;
    dbMock.caretakers = HOUSEHOLD_BADGES.map((badge) => ({ ...badge }));
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

describe('an account with no linked badge gets one on its first log (owner decision 2026-10-15)', () => {
  const originalSecret = process.env.SESSION_SECRET;
  // A Google name that matches no badge, and an email in mixed case
  const newcomer = { id: 'usr-4', email: 'New.Person@Example.com', name: 'New Person Fullname', householdId: 'hh-1', role: 'Member', status: 'ACTIVE' };
  const pee = (id: string) => ({ id, puppyId: 'pup-1', type: 'pee', timestamp: '2026-10-15T08:00:00.000Z', pottyLocation: 'outside' });
  const newcomerBadges = () => dbMock.caretakers.filter((badge) => badge.email === 'new.person@example.com');

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
    dbMock.account = newcomer;
    // A badge without an email already uses the name 'New'
    dbMock.caretakers = [...HOUSEHOLD_BADGES.map((badge) => ({ ...badge })), { id: 'c-guest', householdId: 'hh-1', name: 'New', role: 'Member', color: '#0EA5E9', email: null }];
    dbMock.insertedValues = [];
    dbMock.updatedValues = [];
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it('creates it in the household, linked to the lower-cased email, named and coloured like an invite badge, and logs under that name', async () => {
    const response = createMockResponse();
    await activitiesHandler(requestAs(newcomer, 'POST', pee('act-a')), response);

    expect(response.statusCode).toBe(201);
    expect(newcomerBadges()).toEqual([
      expect.objectContaining({ householdId: 'hh-1', name: 'New.person', role: 'Member', color: BADGE_COLORS[3], email: 'new.person@example.com' }),
    ]);
    expect(dbMock.insertedValues[0].loggedBy).toBe('New.person');
    expect(response.body).toMatchObject({ id: 'act-a', loggedBy: 'New.person' });
  });

  it('two first logs at once create one badge, and both logs carry its name', async () => {
    const responses = [createMockResponse(), createMockResponse()];
    await Promise.all([
      activitiesHandler(requestAs(newcomer, 'POST', pee('act-a')), responses[0]),
      activitiesHandler(requestAs(newcomer, 'POST', pee('act-b')), responses[1]),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    expect(newcomerBadges()).toHaveLength(1);
    expect(dbMock.insertedValues.map((activity) => activity.loggedBy)).toEqual(['New.person', 'New.person']);
  });

  it('the next log uses that badge and creates none', async () => {
    await activitiesHandler(requestAs(newcomer, 'POST', pee('act-a')), createMockResponse());
    const response = createMockResponse();
    await activitiesHandler(requestAs(newcomer, 'POST', pee('act-b')), response);

    expect(response.body.loggedBy).toBe('New.person');
    expect(newcomerBadges()).toHaveLength(1);
  });

  // A member may untick 'This is me' on their own badge: the id derived for their email then belongs to a badge linked to nobody
  it('after its badge is unlinked, the next log makes a new linked badge and never logs under another member', async () => {
    const dariaNew = { ...newcomer, id: 'usr-5', email: 'daria.new@example.com', name: 'Daria' };
    dbMock.account = dariaNew;
    await activitiesHandler(requestAs(dariaNew, 'POST', pee('act-a')), createMockResponse());
    for (const badge of dbMock.caretakers) if (badge.email === 'daria.new@example.com') badge.email = null;

    const response = createMockResponse();
    await activitiesHandler(requestAs(dariaNew, 'POST', pee('act-b')), response);

    expect(response.statusCode).toBe(201);
    expect(response.body.loggedBy).toBe('Daria.new 2');
    expect(dbMock.caretakers.filter((badge) => badge.email === 'daria.new@example.com')).toEqual([
      expect.objectContaining({ householdId: 'hh-1', name: 'Daria.new 2' }),
    ]);
  });

  it('an account that already has a linked badge creates none', async () => {
    dbMock.account = DARIA_ACCOUNT;
    const badgesBefore = dbMock.caretakers.length;
    const response = createMockResponse();
    await activitiesHandler(requestAsDaria('POST', pee('act-a')), response);

    expect(response.body.loggedBy).toBe('Daria');
    expect(dbMock.caretakers).toHaveLength(badgesBefore);
  });
});
