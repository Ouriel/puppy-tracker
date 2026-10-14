import { describe, it, expect } from 'vitest';
import type { ActivityType } from '../../types';
import { buildQuickLogActivity, parseDecimalInput, validateQuickLogForm } from '../activityPayloads';
import { isDailyGramGoalMet, suggestNextMealGrams } from '../predictions';

const form = {
  puppyId: 'pup-1',
  type: 'food' as ActivityType,
  localTimestamp: '2026-10-13T10:15',
  loggedBy: 'Tester',
  notes: '',
  pottyLocation: 'outside' as const,
  stoolConsistency: 'normal' as const,
  quantityGrams: '80',
  weightKg: '',
  medicationName: '',
};

describe('parseDecimalInput (grams and weight boxes)', () => {
  it.each([
    ['10,4', 10.4],
    ['10.4', 10.4],
    ['4,', 4],
    [' 35 ', 35],
    ['0', 0],
  ])('%j -> %d', (text, expected) => {
    expect(parseDecimalInput(text)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1,2,3', '10,4kg', '1e3', '0x10', '+5', '-5', 'Infinity'])('%j is not a number', (text) => {
    expect(parseDecimalInput(text)).toBeNaN();
  });
});

describe('validateQuickLogForm', () => {
  it.each(['0', '', 'abc', '-5'])('food: grams %j blocks the save', (quantityGrams) => {
    expect(validateQuickLogForm({ ...form, quantityGrams })).toEqual({ field: 'quantityGrams', messageKey: 'gramsRequired' });
  });

  it.each([['4,', 4], ['10,4', 10.4], ['35', 35]])('food: grams %j is valid and saved as %d', (quantityGrams, grams) => {
    expect(validateQuickLogForm({ ...form, quantityGrams })).toBeNull();
    expect(buildQuickLogActivity({ ...form, quantityGrams }).quantityGrams).toBe(grams);
  });

  it.each(['', '0', '0,2', '100,1', 'abc'])('weight: %j blocks the save', (weightKg) => {
    expect(validateQuickLogForm({ ...form, type: 'weight', weightKg })).toEqual({ field: 'weightKg', messageKey: 'weightInvalid' });
  });

  it.each([['0,3', 0.3], ['10,4', 10.4], ['10.4', 10.4], ['100', 100]])('weight: %j is valid and saved as %d', (weightKg, kg) => {
    expect(validateQuickLogForm({ ...form, type: 'weight', weightKg })).toBeNull();
    expect(buildQuickLogActivity({ ...form, type: 'weight', weightKg }).weightKg).toBe(kg);
  });

  it.each(['', 'not-a-date'])('date and time %j blocks the save', (localTimestamp) => {
    expect(validateQuickLogForm({ ...form, type: 'pee', localTimestamp })).toEqual({ field: 'timestamp', messageKey: 'dateTimeRequired' });
  });

  it('grams and weight are only checked for their own type', () => {
    expect(validateQuickLogForm({ ...form, type: 'pee', quantityGrams: '', weightKg: '' })).toBeNull();
    expect(validateQuickLogForm({ ...form, type: 'medication', quantityGrams: '0', weightKg: '0' })).toBeNull();
  });
});

describe('isDailyGramGoalMet (the meal card goal-reached rule)', () => {
  it.each([[179, false], [180, true], [200, true]])('goal 200 g, %d g eaten -> %s', (grams, expected) => {
    expect(isDailyGramGoalMet(200, grams)).toBe(expected);
  });

  it('a dog with no gram goal never reaches it by grams', () => {
    expect(isDailyGramGoalMet(0, 500)).toBe(false);
  });
});

describe('suggestNextMealGrams (feed button label and meal box share it)', () => {
  it.each([[179, 21], [180, undefined]])('goal 200 g, 2 meals, 1 eaten, %d g eaten -> %s', (grams, expected) => {
    expect(suggestNextMealGrams(200, 2, grams, 1)).toBe(expected);
  });
});
