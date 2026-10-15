import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDashboard, clearApiCache, createActivity } from '../../services/api';
import { setAuthToken, clearAuthToken } from '../auth';

describe('Dashboard BFF API Service Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearApiCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearApiCache();
    clearAuthToken();
  });

  it('sends the BFF request with the query string and the Bearer token, and returns the payload', async () => {
    const mockResponse = {
      puppies: [
        {
          id: 'pup-1',
          name: 'Pistache',
          breed: 'English Cocker Spaniel',
          birthDate: '2026-04-03T00:00:00.000Z',
          weightKg: 7.8,
          dailyFoodGramGoal: 240,
          targetMealsPerDay: 3,
        },
      ],
      caretakers: [
        { id: 'ct-1', name: 'Sam', role: 'Husband', color: '#6366F1' },
        { id: 'ct-2', name: 'Alice', role: 'Wife', color: '#EC4899' },
      ],
      activities: [
        {
          id: 'act-1',
          puppyId: 'pup-1',
          type: 'pee',
          timestamp: '2026-08-29T18:57:00.000Z',
          loggedBy: 'Alice',
        },
      ],
      healthRecords: [
        {
          id: 'hr-1',
          householdId: 'hh-1',
          puppyId: 'pup-1',
          type: 'vaccination',
          name: 'DHPP Booster',
          date: '2026-06-15',
          boosterDate: '2027-06-15',
          vetClinic: 'Clinique Vétérinaire',
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    } as Response);
    global.fetch = fetchMock;
    setAuthToken('t');

    const result = await fetchDashboard('pup-1', 14);
    expect(result).toEqual({ ok: true, data: mockResponse });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard?puppyId=pup-1&days=14', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    });
  });

  it('uses default days=14 when days parameter is omitted', async () => {
    let calledUrl = '';
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ puppies: [], caretakers: [], activities: [], healthRecords: [] }),
      } as Response);
    });

    await fetchDashboard('pup-test');
    expect(calledUrl).toContain('days=14');
    expect(calledUrl).toContain('puppyId=pup-test');
  });

  it('deduplicates simultaneous inflight requests to fetchDashboard', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCount += 1;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ puppies: [], caretakers: [], activities: [], healthRecords: [] }),
          } as Response);
        }, 20);
      });
    });

    // Launch two simultaneous calls
    const [resultA, resultB] = await Promise.all([
      fetchDashboard('pup-shared', 14),
      fetchDashboard('pup-shared', 14),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    expect(fetchCount).toBe(1); // De-duplicated into 1 single HTTP request
  });

  it('keeps an in-flight request when the cache is cleared, so the refresh events of one return to the app make one call', async () => {
    const pendingResponses: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { pendingResponses.push(resolve); }));
    global.fetch = fetchMock;
    setAuthToken('t');

    // visibilitychange, focus and pageshow each clear the cache and fetch the dashboard
    const first = fetchDashboard('pup-1', 14);
    clearApiCache();
    const second = fetchDashboard('pup-1', 14);
    for (const respond of pendingResponses) {
      respond(new Response(JSON.stringify({ puppies: [], caretakers: [], activities: [], healthRecords: [] }), { status: 200 }));
    }

    expect((await first).ok).toBe(true);
    expect((await second).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never joins an in-flight request older than one return to the app: a request from before the background, or one that hangs, is not reused', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
    const pendingResponses: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { pendingResponses.push(resolve); }));
    global.fetch = fetchMock;
    setAuthToken('t');
    const payloadNamed = (name: string) =>
      new Response(JSON.stringify({ puppies: [{ id: 'pup-1', name }], caretakers: [], activities: [], healthRecords: [] }), { status: 200 });

    try {
      // Sent just before the app went to the background, still unanswered 30 minutes later
      const beforeBackground = fetchDashboard('pup-1', 14);
      vi.setSystemTime(new Date('2026-01-10T12:30:00Z'));
      clearApiCache();
      const onReturn = fetchDashboard('pup-1', 14);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // The old answer arrives late; it must not remove the new request, which a second event of the same return joins
      pendingResponses[0](payloadNamed('pre-background'));
      await beforeBackground;
      clearApiCache();
      const sameReturn = fetchDashboard('pup-1', 14);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      pendingResponses[1](payloadNamed('fresh'));
      const onReturnResult = await onReturn;
      const sameReturnResult = await sameReturn;
      expect(onReturnResult.ok && onReturnResult.data.puppies[0].name).toBe('fresh');
      expect(sameReturnResult.ok && sameReturnResult.data.puppies[0].name).toBe('fresh');
    } finally {
      vi.useRealTimers();
    }
  });

  describe('an answer read while a log was being saved may miss it (C1)', () => {
    const emptyDashboard = () => new Response(JSON.stringify({ puppies: [], caretakers: [], activities: [], healthRecords: [] }), { status: 200 });
    const saveLog = () => createActivity({ id: 'act-1', puppyId: 'pup-1', type: 'pee', timestamp: '2026-01-10T12:00:00.000Z', loggedBy: 'Owner' });

    it('a request sent once the save is answered does not join one sent before', async () => {
      const pendingResponses: Array<(response: Response) => void> = [];
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { pendingResponses.push(resolve); }));
      global.fetch = fetchMock;
      setAuthToken('t');

      const save = saveLog();
      // visibilitychange while the save is in flight
      const readDuringSave = fetchDashboard('pup-1', 14);
      pendingResponses[0](new Response('{}', { status: 201 }));
      await save;
      // focus, the same return to the app, once the save is answered
      const readAfterSave = fetchDashboard('pup-1', 14);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      pendingResponses.slice(1).forEach((respond) => respond(emptyDashboard()));
      await readDuringSave;
      await readAfterSave;
    });

    it('a request sent once the save is answered is not served from the cache filled before', async () => {
      const pendingResponses: Array<(response: Response) => void> = [];
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { pendingResponses.push(resolve); }));
      global.fetch = fetchMock;
      setAuthToken('t');

      const save = saveLog();
      const readDuringSave = fetchDashboard('pup-1', 14);
      pendingResponses[1](emptyDashboard());
      await readDuringSave;
      pendingResponses[0](new Response('{}', { status: 201 }));
      await save;
      const readAfterSave = fetchDashboard('pup-1', 14);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      pendingResponses[2]?.(emptyDashboard());
      await readAfterSave;
    });
  });

  it('allows immediate fresh dashboard fetch when clearApiCache is invoked', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCount += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ puppies: [], caretakers: [], activities: [], healthRecords: [] }),
      } as Response);
    });

    await fetchDashboard('pup-1', 14);
    expect(fetchCount).toBe(1);

    // Call again within TTL - should hit cache
    await fetchDashboard('pup-1', 14);
    expect(fetchCount).toBe(1);

    // After clearing cache (e.g. app foreground resume), issues fresh network request
    clearApiCache();
    await fetchDashboard('pup-1', 14);
    expect(fetchCount).toBe(2);
  });
});
