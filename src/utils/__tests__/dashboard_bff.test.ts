import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDashboard, clearApiCache } from '../../services/api';

describe('Dashboard BFF API Service Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearApiCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearApiCache();
  });

  it('formulates correct request URL and parameters for fetchDashboard', async () => {
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
    };

    let calledUrl = '';
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);
    });

    const result = await fetchDashboard('pup-1', 14);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.puppies.length).toBe(1);
      expect(result.data.puppies[0].name).toBe('Balma');
      expect(result.data.caretakers.length).toBe(2);
      expect(result.data.activities.length).toBe(1);
    }
    expect(calledUrl).toContain('/api/dashboard?');
    expect(calledUrl).toContain('puppyId=pup-1');
    expect(calledUrl).toContain('days=14');
  });

  it('uses default days=14 when days parameter is omitted', async () => {
    let calledUrl = '';
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ puppies: [], caretakers: [], activities: [] }),
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
            json: () => Promise.resolve({ puppies: [], caretakers: [], activities: [] }),
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
});
