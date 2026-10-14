import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseDeleteId } from '../schemas';
import { gramsToCups } from '../predictions';
import { sanitizeActivityUpdate } from '../../hooks/useActivities';
import { updateActivity } from '../../services/api';
import type { Activity } from '../../types';

describe('Activity & CRUD Regression Tests', () => {
  describe('DELETE ID Resolution (Bug 2 Delete Fix)', () => {
    it('should correctly extract ID when Vercel node parses body as empty object', () => {
      // Simulating @vercel/node DELETE request where Content-Type is application/json but body is empty {}
      const deleteParsed = parseDeleteId({ query: { id: 'act-test-delete-123' }, body: {} });

      expect(deleteParsed.success).toBe(true);
      expect(deleteParsed.data?.id).toBe('act-test-delete-123');
    });

    it('should extract ID when provided in body payload', () => {
      const deleteParsed = parseDeleteId({ query: {}, body: { id: 'act-test-body-456' } });

      expect(deleteParsed.success).toBe(true);
      expect(deleteParsed.data?.id).toBe('act-test-body-456');
    });

    it('should reject when ID is missing from both query and body', () => {
      expect(parseDeleteId({ query: {}, body: {} }).success).toBe(false);
    });

    it('prefers the query id over the body id', () => {
      expect(parseDeleteId({ query: { id: 'q' }, body: { id: 'b' } }).data?.id).toBe('q');
    });

    it('falls back to the body id when the query id is repeated (?id=a&id=b)', () => {
      expect(parseDeleteId({ query: { id: ['a', 'b'] }, body: { id: 'b' } }).data?.id).toBe('b');
    });

    it('does not read the body when the query has an id', () => {
      // @vercel/node exposes req.body as a lazy getter that throws on malformed JSON
      const request = {
        query: { id: 'act-query-789' },
        get body(): unknown {
          throw new Error('Invalid JSON');
        },
      };

      expect(parseDeleteId(request).data?.id).toBe('act-query-789');
    });
  });

  describe('Polymorphic Activity Type Switching & Sanitization (Bug 2 Edit Fix)', () => {
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

    it('keeps the potty fields on a same-type partial edit', () => {
      const initialActivity: Activity = {
        id: 'act-4',
        puppyId: 'pup-1',
        type: 'poop',
        timestamp: '2026-08-18T15:00:00.000Z',
        loggedBy: 'Matthieu',
        pottyLocation: 'outside',
        stoolConsistency: 'hard',
      };

      const updated = sanitizeActivityUpdate(initialActivity, { id: 'act-4', notes: 'x' });

      expect(updated.type).toBe('poop');
      expect(updated.pottyLocation).toBe('outside');
      expect(updated.stoolConsistency).toBe('hard');
      expect(updated.notes).toBe('x');
    });

    it('clears medicationName and foodType when the type changes', () => {
      const medication: Activity = {
        id: 'act-5',
        puppyId: 'pup-1',
        type: 'medication',
        timestamp: '2026-08-18T16:00:00.000Z',
        loggedBy: 'Matthieu',
        medicationName: 'Amoxicillin',
      };
      const food: Activity = {
        id: 'act-6',
        puppyId: 'pup-1',
        type: 'food',
        timestamp: '2026-08-18T17:00:00.000Z',
        loggedBy: 'Matthieu',
        foodType: 'kibble',
        quantityGrams: 80,
      };

      expect(sanitizeActivityUpdate(medication, { id: 'act-5' }).medicationName).toBe('Amoxicillin');
      expect(sanitizeActivityUpdate(medication, { id: 'act-5', type: 'food' }).medicationName).toBeUndefined();
      expect(sanitizeActivityUpdate(food, { id: 'act-6', type: 'weight', weightKg: 5 }).foodType).toBeUndefined();
    });

    it('keeps an explicit quantityGrams of 0 instead of the previous value', () => {
      const food: Activity = {
        id: 'act-7',
        puppyId: 'pup-1',
        type: 'food',
        timestamp: '2026-08-18T18:00:00.000Z',
        loggedBy: 'Matthieu',
        quantityGrams: 80,
      };

      expect(sanitizeActivityUpdate(food, { id: 'act-7', quantityGrams: 0 }).quantityGrams).toBe(0);
    });
  });

  describe('ApiResult Pattern Guarantee (100% Type-Safe API contracts)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should discriminate success vs error payloads cleanly', async () => {
      const savedActivity: Activity = {
        id: 'act-100',
        puppyId: 'pup-1',
        type: 'food',
        timestamp: '2026-08-18T12:00:00.000Z',
        loggedBy: 'Matthieu',
        quantityGrams: 80,
      };
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(savedActivity), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid activity payload' }), { status: 400 })));

      expect(await updateActivity({ id: 'act-100', quantityGrams: 80 })).toEqual({ ok: true, data: savedActivity });
      expect(await updateActivity({ id: 'act-100', quantityGrams: -1 })).toEqual({
        ok: false,
        error: 'Invalid activity payload',
        status: 400,
      });
    });
  });

  describe('Modal Pre-selection & Default State (Bug 1 Fix)', () => {
    it('converts the default meal portion from grams to cups (110 g per cup, 2 decimals)', () => {
      expect(gramsToCups(95)).toBe(0.86);
      expect(gramsToCups(0)).toBe(0);
    });
  });
});


