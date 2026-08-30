import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDashboard, clearApiCache } from '../../services/api';
import { DashboardPayloadSchema, DashboardQuerySchema } from '../schemas';

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
      expect(result.data.healthRecords?.length).toBe(1);
      expect(result.data.healthRecords?.[0].name).toBe('DHPP Booster');
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

  it('validates DashboardPayloadSchema structure with healthRecords', () => {
    const validPayload = {
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
        { id: 'ct-1', name: 'Matthieu', role: 'Husband' as const, color: '#6366F1' },
      ],
      activities: [
        {
          id: 'act-1',
          puppyId: 'pup-1',
          type: 'pee' as const,
          timestamp: '2026-08-29T18:57:00.000Z',
          loggedBy: 'Matthieu',
        },
      ],
      healthRecords: [
        {
          id: 'hr-1',
          householdId: 'hh-1',
          puppyId: 'pup-1',
          type: 'vaccination' as const,
          name: 'Rabies Booster',
          date: '2026-08-01',
        },
      ],
    };

    const parsed = DashboardPayloadSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('validates and coerces DashboardQuerySchema parameters correctly', () => {
    // Default values when empty query provided
    const emptyResult = DashboardQuerySchema.safeParse({});
    expect(emptyResult.success).toBe(true);
    if (emptyResult.success) {
      expect(emptyResult.data.puppyId).toBeUndefined();
      expect(emptyResult.data.days).toBe(14);
    }

    // String days coercion and puppyId trimming
    const customResult = DashboardQuerySchema.safeParse({
      puppyId: '  pup-alpha  ',
      days: '30',
    });
    expect(customResult.success).toBe(true);
    if (customResult.success) {
      expect(customResult.data.puppyId).toBe('pup-alpha');
      expect(customResult.data.days).toBe(30);
    }

    // Empty or whitespace-only puppyId transforms to undefined
    const whitespaceResult = DashboardQuerySchema.safeParse({
      puppyId: '   ',
      days: '7',
    });
    expect(whitespaceResult.success).toBe(true);
    if (whitespaceResult.success) {
      expect(whitespaceResult.data.puppyId).toBeUndefined();
      expect(whitespaceResult.data.days).toBe(7);
    }

    // Invalid days falls back safely to default 14
    const invalidDaysResult = DashboardQuerySchema.safeParse({
      days: 'invalid_number',
    });
    expect(invalidDaysResult.success).toBe(true);
    if (invalidDaysResult.success) {
      expect(invalidDaysResult.data.days).toBe(14);
    }
  });
});
