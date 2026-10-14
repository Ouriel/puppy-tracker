import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDashboard, clearApiCache } from '../../services/api';
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
          name: 'Balma',
          breed: 'English Cocker Spaniel',
          birthDate: '2026-03-27T00:00:00.000Z',
          weightKg: 7.8,
          dailyFoodGramGoal: 240,
          targetMealsPerDay: 3,
        },
      ],
      caretakers: [
        { id: 'ct-1', name: 'Matthieu', role: 'Husband', color: '#6366F1' },
        { id: 'ct-2', name: 'Daria', role: 'Wife', color: '#EC4899' },
      ],
      activities: [
        {
          id: 'act-1',
          puppyId: 'pup-1',
          type: 'pee',
          timestamp: '2026-08-29T18:57:00.000Z',
          loggedBy: 'Daria',
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
