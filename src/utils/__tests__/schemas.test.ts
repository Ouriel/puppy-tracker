import { describe, it, expect } from 'vitest';
import {
  ActivityInputSchema,
  DogInputSchema,
  HealthRecordInputSchema,
  CaretakerInputSchema,
  UserInputSchema,
  DeleteSchema,
  DashboardQuerySchema,
} from '../schemas';
import { buildQuickActionActivity, buildQuickLogActivity, validateQuickLogForm } from '../activityPayloads';

describe('Zod Schemas Validation', () => {
  it('should validate activity input mutation schema with string numbers', () => {
    const inputActivity = {
      puppyId: 'pup-1',
      type: 'food' as const,
      quantityGrams: '85',
      foodType: 'kibble',
    };

    const parsed = ActivityInputSchema.safeParse(inputActivity);
    expect(parsed.success).toBe(true);
  });

  it('should validate dog and health record input schemas', () => {
    const inputDog = {
      name: 'Balma',
      breed: 'English Cocker Spaniel',
      birthDate: '2026-05-01',
      weightKg: '7.8',
      dailyFoodGramGoal: 240,
    };
    expect(DogInputSchema.safeParse(inputDog).success).toBe(true);

    const inputHealth = {
      puppyId: 'pup-1',
      type: 'deworming' as const,
      name: 'Credelio Plus',
      date: '2026-08-01',
      weightAtTime: '7.8',
    };
    expect(HealthRecordInputSchema.safeParse(inputHealth).success).toBe(true);

    const inputCaretaker = {
      name: 'Matthieu',
      role: 'Husband',
      email: 'matthieu@example.com',
    };
    expect(CaretakerInputSchema.safeParse(inputCaretaker).success).toBe(true);
  });

  it('rejects activity inputs with an unknown type and health record inputs without puppyId or date', () => {
    expect(ActivityInputSchema.safeParse({ puppyId: 'pup-1', type: 'unknown_action', timestamp: '2026-08-17T12:00:00.000Z' }).success).toBe(false);
    expect(HealthRecordInputSchema.safeParse({ type: 'invalid_type', name: 'Test' }).success).toBe(false);
  });

  it('validates DogInputSchema accepts gender and expectedAdultWeightKg', () => {
    const validProfile = {
      id: 'pup-test-1',
      name: 'Balma',
      breed: 'English Cocker Spaniel',
      birthDate: '2026-03-27',
      weightKg: 7.8,
      dailyFoodGramGoal: 240,
      targetMealsPerDay: 3,
      gender: 'female' as const,
      expectedAdultWeightKg: 13.5,
    };

    const parsed = DogInputSchema.safeParse(validProfile);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gender).toBe('female');
      expect(parsed.data.expectedAdultWeightKg).toBe(13.5);
    }
  });

  it('validates DogInputSchema preserves backward compatibility when gender is omitted', () => {
    const legacyProfile = {
      id: 'pup-test-2',
      name: 'Cookie',
      breed: 'Labrador Retriever',
      birthDate: '2026-01-10',
      weightKg: 15,
      dailyFoodGramGoal: 300,
      targetMealsPerDay: 2,
    };

    const parsed = DogInputSchema.safeParse(legacyProfile);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gender).toBeUndefined();
      expect(parsed.data.expectedAdultWeightKg).toBeUndefined();
    }
  });

  it('rejects invalid gender in DogInputSchema', () => {
    const invalidProfile = {
      id: 'pup-test-3',
      name: 'Rover',
      breed: 'Boxer',
      birthDate: '2026-02-01',
      weightKg: 10,
      dailyFoodGramGoal: 250,
      targetMealsPerDay: 3,
      gender: 'invalid_gender',
    };

    const parsed = DogInputSchema.safeParse(invalidProfile);
    expect(parsed.success).toBe(false);
  });

  it('should validate DeleteSchema with valid id and reject empty id', () => {
    expect(DeleteSchema.safeParse({ id: 'act-123' }).success).toBe(true);
    expect(DeleteSchema.safeParse({ id: '' }).success).toBe(false);
    expect(DeleteSchema.safeParse({}).success).toBe(false);
  });

  it('should validate DashboardQuerySchema parsing and sanitization', () => {
    const parsed = DashboardQuerySchema.safeParse({
      puppyId: 'pup-balma',
      days: 30,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.puppyId).toBe('pup-balma');
      expect(parsed.data.days).toBe(30);
    }

    const defaultParsed = DashboardQuerySchema.safeParse({});
    expect(defaultParsed.success).toBe(true);
    if (defaultParsed.success) {
      expect(defaultParsed.data.days).toBe(14);
      expect(defaultParsed.data.puppyId).toBeUndefined();
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

    // Invalid or out-of-range days (1..90) fall back safely to default 14
    for (const days of ['invalid_number', '365', '0']) {
      expect(DashboardQuerySchema.parse({ days }).days).toBe(14);
    }
  });

  it('should validate UserInputSchema', () => {
    const validUser = {
      email: 'matthieu@example.com',
      name: 'Matthieu',
      role: 'SuperAdmin',
      status: 'ACTIVE' as const,
    };
    expect(UserInputSchema.safeParse(validUser).success).toBe(true);

    const invalidEmail = {
      email: 'not-an-email',
    };
    expect(UserInputSchema.safeParse(invalidEmail).success).toBe(false);
  });

  describe('ActivityInputSchema hardening', () => {
    const base = { puppyId: 'pup-1', type: 'pee' as const, timestamp: '2026-08-17T12:00:00.000Z' };

    it('rejects a timestamp that does not parse as a date', () => {
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: 'not-a-date' }).success).toBe(false);
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: '' }).success).toBe(false);
      expect(ActivityInputSchema.safeParse(base).success).toBe(true);
    });

    it('coerces quantityGrams to a positive number and rejects empty, zero or negative values', () => {
      const food = { ...base, type: 'food' as const };
      expect(ActivityInputSchema.parse({ ...food, quantityGrams: '85' }).quantityGrams).toBe(85);
      // '' coerces to 0: a 0 g meal is an input mistake, so it is rejected rather than stored.
      for (const quantityGrams of ['', 0, -5, 'abc']) {
        expect(ActivityInputSchema.safeParse({ ...food, quantityGrams }).success).toBe(false);
      }
      expect(ActivityInputSchema.parse({ ...food, quantityGrams: null }).quantityGrams).toBeNull();
    });

    // 14: the form stops 5 min ahead by the phone's clock; the server only refuses what no clock skew explains
    it('rejects a timestamp more than 24 h in the future, on POST and PUT; a phone clock hours ahead still saves', () => {
      const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: inHours(23) }).success).toBe(true);
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: inHours(25) }).success).toBe(false);
      expect(ActivityInputSchema.partial().safeParse({ id: 'act-1', timestamp: inHours(23) }).success).toBe(true);
      expect(ActivityInputSchema.partial().safeParse({ id: 'act-1', timestamp: inHours(25) }).success).toBe(false);
    });

    it('accepts a weight from 0.3 to 100 kg (number, numeric string or null), on POST and PUT', () => {
      const weight = { ...base, type: 'weight' as const };
      for (const weightKg of [0.3, 12.34, 100, '7.4', null]) {
        expect(ActivityInputSchema.safeParse({ ...weight, weightKg }).success, String(weightKg)).toBe(true);
      }
      expect(ActivityInputSchema.parse({ ...weight, weightKg: '7.4' }).weightKg).toBe(7.4);
      for (const weightKg of [0.2, 100.1, 0, -4, '', 'abc']) {
        expect(ActivityInputSchema.safeParse({ ...weight, weightKg }).success, String(weightKg)).toBe(false);
        expect(ActivityInputSchema.partial().safeParse({ id: 'act-1', weightKg }).success, String(weightKg)).toBe(false);
      }
    });

    it('only accepts known potty locations, or null', () => {
      expect(ActivityInputSchema.safeParse({ ...base, pottyLocation: 'indoor_pad' }).success).toBe(false);
      expect(ActivityInputSchema.safeParse({ ...base, pottyLocation: 'indoor_accident' }).success).toBe(true);
      expect(ActivityInputSchema.safeParse({ ...base, pottyLocation: null }).success).toBe(true);
    });
  });

  describe('ActivityInputSchema accepts what the client really sends', () => {
    // The wire payload: useActivities.addActivity adds the id, services/api.ts JSON-encodes it.
    const toWire = (activity: object) => JSON.parse(JSON.stringify({ ...activity, id: `act-${crypto.randomUUID()}` }));
    const actionTime = new Date('2026-10-13T08:15:00.000Z');

    it.each([
      ['pee', 'outside'],
      ['pee', 'indoor_accident'],
      ['poop', 'outside'],
    ] as const)('one-tap quick action: %s %s', (type, pottyLocation) => {
      const payload = buildQuickActionActivity({ puppyId: 'pup-1', type, pottyLocation, loggedBy: 'Daria', actionTime });
      const parsed = ActivityInputSchema.safeParse(toWire(payload));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    const form = {
      puppyId: 'pup-1',
      localTimestamp: '2026-10-13T10:15',
      loggedBy: 'Matthieu Jacquet',
      notes: '  ',
      pottyLocation: 'outside' as const,
      stoolConsistency: 'normal' as const,
      // The grams and weight boxes hold the raw text typed.
      quantityGrams: '80',
      weightKg: '7,4',
      medicationName: 'Credelio Plus',
    };

    it.each(['pee', 'poop', 'food', 'weight', 'medication'] as const)('QuickLogModal form, new log and edit: %s', (type) => {
      const payload = buildQuickLogActivity({ ...form, type });
      const created = ActivityInputSchema.safeParse(toWire(payload));
      expect(created.success, JSON.stringify(created.error?.issues)).toBe(true);
      // Edit: ActivityTimeline sends { id, ...activityData } through PUT.
      const edited = ActivityInputSchema.partial().safeParse({ id: 'act-1760000000000', ...JSON.parse(JSON.stringify(payload)) });
      expect(edited.success, JSON.stringify(edited.error?.issues)).toBe(true);
    });

    // A 0 g meal is rejected: the builder keeps the 0 (no silent meal without grams), the server refuses it,
    // and the form blocks it before it closes.
    it('a 0 g or emptied grams box never becomes a meal without grams', () => {
      const payload = buildQuickLogActivity({ ...form, type: 'food', quantityGrams: '0' });
      expect(payload.quantityGrams).toBe(0);
      expect(ActivityInputSchema.safeParse(toWire(payload)).success).toBe(false);
      for (const quantityGrams of ['0', '']) {
        expect(validateQuickLogForm({ ...form, type: 'food', quantityGrams })).toEqual({ field: 'quantityGrams', messageKey: 'gramsRequired' });
      }
    });

    // One row per distinct production shape (read-only SELECT, 2026-10-14), as GET /api/activities returns it.
    const productionRowShapes = [
      { type: 'food', pottyLocation: null, stoolConsistency: null, foodType: 'kibble', quantityGrams: 20, quantityCups: 0.18, weightKg: null },
      { type: 'food', pottyLocation: null, stoolConsistency: null, foodType: null, quantityGrams: 10, quantityCups: 0.09, weightKg: null },
      { type: 'pee', pottyLocation: 'indoor_accident', stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'pee', pottyLocation: 'outside', stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'poop', pottyLocation: 'outside', stoolConsistency: 'hard', foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'poop', pottyLocation: 'outside', stoolConsistency: 'normal', foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'poop', pottyLocation: 'outside', stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'weight', pottyLocation: null, stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: 4.075 },
    ];

    it.each(productionRowShapes)('a production row re-sent as-is on PUT: $type $pottyLocation $stoolConsistency $foodType', (row) => {
      const resent = {
        ...row,
        id: 'act-1754000000000',
        householdId: 'hh-1',
        puppyId: 'pup-1',
        timestamp: '2026-08-11T12:00:00.000Z',
        loggedBy: 'guest.member',
        durationMinutes: null,
        medicationName: null,
        notes: null,
      };
      const parsed = ActivityInputSchema.partial().safeParse(resent);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });
  });
});
