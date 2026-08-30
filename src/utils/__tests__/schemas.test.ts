import { describe, it, expect } from 'vitest';
import {
  ActivitySchema,
  PuppyProfileSchema,
  CaretakerSchema,
  UserAccountSchema,
  HealthRecordSchema,
  ActivityInputSchema,
  DogInputSchema,
  HealthRecordInputSchema,
  CaretakerInputSchema,
  DeleteSchema,
  DashboardPayloadSchema,
  DashboardQuerySchema,
} from '../schemas';

describe('Zod Schemas Validation', () => {
  it('should validate valid potty activity payload', () => {
    const validActivity = {
      id: 'act-123',
      householdId: 'hh-1',
      puppyId: 'pup-1',
      type: 'pee' as const,
      timestamp: '2026-07-28T12:00:00.000Z',
      loggedBy: 'Matthieu',
      pottyLocation: 'outside' as const,
    };

    const parsed = ActivitySchema.safeParse(validActivity);
    expect(parsed.success).toBe(true);
  });

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

  it('should validate puppy profile schema', () => {
    const validProfile = {
      id: 'pup-1',
      name: 'Milo',
      breed: 'Cocker Spaniel',
      birthDate: '2026-01-01',
      weightKg: 6.5,
      dailyFoodGramGoal: 240,
      targetMealsPerDay: 3,
    };

    const parsed = PuppyProfileSchema.safeParse(validProfile);
    expect(parsed.success).toBe(true);
  });

  it('should validate caretaker schema', () => {
    const validCaretaker = {
      id: 'ct-1',
      name: 'Sophie',
      role: 'Wife' as const,
      color: 'bg-rose-500',
    };

    const parsed = CaretakerSchema.safeParse(validCaretaker);
    expect(parsed.success).toBe(true);
  });

  it('should validate user account schema', () => {
    const validUser = {
      id: 'usr-1',
      name: 'Matthieu',
      email: 'matthieu@example.com',
      role: 'Husband' as const,
      avatarColor: 'bg-indigo-500',
      familyPackId: 'pack-999',
    };

    const parsed = UserAccountSchema.safeParse(validUser);
    expect(parsed.success).toBe(true);
  });

  it('should validate health record schema', () => {
    const validVaccine = {
      id: 'hr-1',
      householdId: 'hh-1',
      puppyId: 'pup-1',
      type: 'vaccination' as const,
      name: 'CHPPi + L4',
      date: '2026-07-01',
      boosterDate: '2027-07-01',
      vetClinic: 'Saint-Roch',
      batchNumber: 'LOT-99',
    };

    const parsed = HealthRecordSchema.safeParse(validVaccine);
    expect(parsed.success).toBe(true);
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
  });
});

