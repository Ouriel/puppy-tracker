import { describe, it, expect } from 'vitest';
import {
  ActivitySchema,
  ActivityInputSchema,
  DogInputSchema,
  HealthRecordInputSchema,
  CaretakerInputSchema,
  UserInputSchema,
  DeleteSchema,
  DashboardPayloadSchema,
  DashboardQuerySchema,
} from '../schemas';

describe('Zod Schemas Validation', () => {
  it('should reject invalid potty locations like indoor_pad', () => {
    const invalidActivity = {
      id: 'act-124',
      puppyId: 'pup-1',
      type: 'pee',
      timestamp: '2026-07-28T12:00:00.000Z',
      loggedBy: 'Matthieu',
      pottyLocation: 'indoor_pad',
    };

    const parsed = ActivitySchema.safeParse(invalidActivity);
    expect(parsed.success).toBe(false);
  });

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

  it('should validate DashboardPayloadSchema with empty arrays and full datasets', () => {
    const emptyPayload = {
      puppies: [],
      caretakers: [],
      activities: [],
      healthRecords: [],
    };
    expect(DashboardPayloadSchema.safeParse(emptyPayload).success).toBe(true);

    const missingHealthRecordsPayload = {
      puppies: [],
      caretakers: [],
      activities: [],
    };
    expect(DashboardPayloadSchema.safeParse(missingHealthRecordsPayload).success).toBe(true);

    const invalidPayload = {
      puppies: [{ id: 123 }], // invalid id type
      caretakers: [],
      activities: [],
    };
    expect(DashboardPayloadSchema.safeParse(invalidPayload).success).toBe(false);
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
});

