import { describe, it, expect } from 'vitest';
import {
  ActivitySchema,
  PuppyProfileSchema,
  CaretakerSchema,
  UserAccountSchema,
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
});
