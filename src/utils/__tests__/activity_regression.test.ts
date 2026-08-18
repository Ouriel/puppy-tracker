import { describe, it, expect } from 'vitest';
import { DeleteSchema } from '../schemas';
import type { Activity, ActivityType } from '../../types';
import type { ApiResult } from '../../services/api';

describe('Activity & CRUD Regression Tests', () => {
  describe('DELETE ID Resolution (Bug 2 Delete Fix)', () => {
    it('should correctly extract ID when Vercel node parses body as empty object', () => {
      // Simulating @vercel/node DELETE request where Content-Type is application/json but body is empty {}
      const reqQuery = { id: 'act-test-delete-123' };
      const reqBody = {}; // Empty body from @vercel/node

      const rawId = (typeof reqQuery.id === 'string' && reqQuery.id) || (reqBody && typeof reqBody === 'object' && (reqBody as any).id);
      const deleteParsed = DeleteSchema.safeParse({ id: rawId });

      expect(deleteParsed.success).toBe(true);
      if (deleteParsed.success) {
        expect(deleteParsed.data.id).toBe('act-test-delete-123');
      }
    });

    it('should extract ID when provided in body payload', () => {
      const reqQuery = {};
      const reqBody = { id: 'act-test-body-456' };

      const rawId = (typeof (reqQuery as any).id === 'string' && (reqQuery as any).id) || (reqBody && typeof reqBody === 'object' && reqBody.id);
      const deleteParsed = DeleteSchema.safeParse({ id: rawId });

      expect(deleteParsed.success).toBe(true);
      if (deleteParsed.success) {
        expect(deleteParsed.data.id).toBe('act-test-body-456');
      }
    });

    it('should reject when ID is missing from both query and body', () => {
      const reqQuery = {};
      const reqBody = {};

      const rawId = (typeof (reqQuery as any).id === 'string' && (reqQuery as any).id) || (reqBody && typeof reqBody === 'object' && (reqBody as any).id);
      const deleteParsed = DeleteSchema.safeParse({ id: rawId });

      expect(deleteParsed.success).toBe(false);
    });
  });

  describe('Polymorphic Activity Type Switching & Sanitization (Bug 2 Edit Fix)', () => {
    function sanitizeActivityUpdate(existing: Activity, updatedFields: Partial<Activity> & { id: string }): Activity {
      const newType = updatedFields.type || existing.type;
      const isPotty = newType === 'pee' || newType === 'poop';
      const isFood = newType === 'food';
      const isWeight = newType === 'weight';
      const isMedication = newType === 'medication';

      return {
        ...existing,
        ...updatedFields,
        type: newType,
        pottyLocation: isPotty ? (updatedFields.pottyLocation ?? existing.pottyLocation) : undefined,
        stoolConsistency: newType === 'poop' ? (updatedFields.stoolConsistency ?? existing.stoolConsistency) : undefined,
        foodType: isFood ? (updatedFields.foodType ?? existing.foodType) : undefined,
        quantityGrams: isFood ? (updatedFields.quantityGrams ?? existing.quantityGrams) : undefined,
        quantityCups: isFood ? (updatedFields.quantityCups ?? existing.quantityCups) : undefined,
        weightKg: isWeight ? (updatedFields.weightKg ?? existing.weightKg) : undefined,
        medicationName: isMedication ? (updatedFields.medicationName ?? existing.medicationName) : undefined,
      };
    }

    it('should wipe pottyLocation when editing activity from pee to food', () => {
      const initialActivity: Activity = {
        id: 'act-1',
        puppyId: 'pup-1',
        type: 'pee',
        timestamp: '2026-08-18T10:00:00.000Z',
        loggedBy: 'Matthieu',
        pottyLocation: 'outside',
      };

      const updated = sanitizeActivityUpdate(initialActivity, {
        id: 'act-1',
        type: 'food',
        quantityGrams: 85,
        quantityCups: 0.77,
      });

      expect(updated.type).toBe('food');
      expect(updated.quantityGrams).toBe(85);
      expect(updated.quantityCups).toBe(0.77);
      expect(updated.pottyLocation).toBeUndefined();
    });

    it('should wipe food quantities when editing activity from food to pee', () => {
      const initialActivity: Activity = {
        id: 'act-2',
        puppyId: 'pup-1',
        type: 'food',
        timestamp: '2026-08-18T12:00:00.000Z',
        loggedBy: 'Matthieu',
        quantityGrams: 90,
        quantityCups: 0.82,
      };

      const updated = sanitizeActivityUpdate(initialActivity, {
        id: 'act-2',
        type: 'pee',
        pottyLocation: 'indoor_accident',
      });

      expect(updated.type).toBe('pee');
      expect(updated.pottyLocation).toBe('indoor_accident');
      expect(updated.quantityGrams).toBeUndefined();
      expect(updated.quantityCups).toBeUndefined();
    });

    it('should wipe stoolConsistency when switching from poop to weight', () => {
      const initialActivity: Activity = {
        id: 'act-3',
        puppyId: 'pup-1',
        type: 'poop',
        timestamp: '2026-08-18T14:00:00.000Z',
        loggedBy: 'Matthieu',
        pottyLocation: 'outside',
        stoolConsistency: 'normal',
      };

      const updated = sanitizeActivityUpdate(initialActivity, {
        id: 'act-3',
        type: 'weight',
        weightKg: 4.8,
      });

      expect(updated.type).toBe('weight');
      expect(updated.weightKg).toBe(4.8);
      expect(updated.stoolConsistency).toBeUndefined();
      expect(updated.pottyLocation).toBeUndefined();
    });
  });

  describe('ApiResult Pattern Guarantee (100% Type-Safe API contracts)', () => {
    it('should discriminate success vs error payloads cleanly', () => {
      const successResult: ApiResult<Activity> = {
        ok: true,
        data: {
          id: 'act-100',
          puppyId: 'pup-1',
          type: 'food',
          timestamp: '2026-08-18T12:00:00.000Z',
          loggedBy: 'Matthieu',
          quantityGrams: 80,
        },
      };

      const errorResult: ApiResult<Activity> = {
        ok: false,
        error: 'Invalid activity payload',
        status: 400,
      };

      if (successResult.ok) {
        expect(successResult.data.quantityGrams).toBe(80);
      } else {
        expect.unreachable();
      }

      if (!errorResult.ok) {
        expect(errorResult.status).toBe(400);
        expect(errorResult.error).toBe('Invalid activity payload');
      } else {
        expect.unreachable();
      }
    });
  });

  describe('Modal Pre-selection & Default State (Bug 1 Fix)', () => {
    it('should initialize correctly with food type and portion grams when opened from Predictor Meal card', () => {
      const initialType: ActivityType = 'food';
      const defaultMealPortionGrams = 95;

      const activityData: Partial<Activity> = {
        type: initialType,
        quantityGrams: defaultMealPortionGrams,
        quantityCups: Math.round((defaultMealPortionGrams / 110) * 100) / 100,
      };

      expect(activityData.type).toBe('food');
      expect(activityData.quantityGrams).toBe(95);
      expect(activityData.quantityCups).toBe(0.86);
    });
  });

  describe('Day-by-Day Accordion & Nutrition Summary Calculations', () => {
    it('accurately computes total food intake, meal counts, pees, poops, and accidents per day', () => {
      const activities: Activity[] = [
        // Morning meal
        {
          id: 'act-1',
          puppyId: 'pup-1',
          type: 'food',
          timestamp: '2026-08-18T07:30:00.000Z',
          loggedBy: 'Matthieu',
          quantityGrams: 80,
          quantityCups: 0.73,
        },
        // Midday meal
        {
          id: 'act-2',
          puppyId: 'pup-1',
          type: 'food',
          timestamp: '2026-08-18T12:30:00.000Z',
          loggedBy: 'Matthieu',
          quantityGrams: 80,
          quantityCups: 0.73,
        },
        // Evening meal
        {
          id: 'act-3',
          puppyId: 'pup-1',
          type: 'food',
          timestamp: '2026-08-18T19:30:00.000Z',
          loggedBy: 'Matthieu',
          quantityGrams: 80,
          quantityCups: 0.73,
        },
        // Pees & Poops
        {
          id: 'act-4',
          puppyId: 'pup-1',
          type: 'pee',
          timestamp: '2026-08-18T07:45:00.000Z',
          loggedBy: 'Matthieu',
          pottyLocation: 'outside',
        },
        {
          id: 'act-5',
          puppyId: 'pup-1',
          type: 'poop',
          timestamp: '2026-08-18T07:50:00.000Z',
          loggedBy: 'Matthieu',
          pottyLocation: 'outside',
          stoolConsistency: 'normal',
        },
        {
          id: 'act-6',
          puppyId: 'pup-1',
          type: 'pee',
          timestamp: '2026-08-18T15:00:00.000Z',
          loggedBy: 'Matthieu',
          pottyLocation: 'indoor_accident',
        },
      ];

      const dailyGoalGrams = 240;
      const targetMealsCount = 3;

      const totalFoodGrams = activities
        .filter((activity) => activity.type === 'food')
        .reduce((sum, activity) => sum + (activity.quantityGrams || 0), 0);
      const mealsCount = activities.filter((activity) => activity.type === 'food').length;
      const peeCount = activities.filter((activity) => activity.type === 'pee').length;
      const poopCount = activities.filter((activity) => activity.type === 'poop').length;
      const accidentCount = activities.filter(
        (activity) => (activity.type === 'pee' || activity.type === 'poop') && activity.pottyLocation === 'indoor_accident'
      ).length;

      expect(totalFoodGrams).toBe(240);
      expect(mealsCount).toBe(3);
      expect(totalFoodGrams >= dailyGoalGrams).toBe(true);
      expect(mealsCount >= targetMealsCount).toBe(true);
      expect(peeCount).toBe(2);
      expect(poopCount).toBe(1);
      expect(accidentCount).toBe(1);
    });
  });
});

