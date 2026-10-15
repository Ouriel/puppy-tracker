import { describe, it, expect } from 'vitest';
import type { ActivityType } from '../../types';
import { buildQuickLogActivity, parseDecimalInput, validateQuickLogForm } from '../activityPayloads';
import { calculateNextMealPortion, getRecommendedMealsPerDay, isDailyGramGoalMet, suggestNextMealGrams } from '../predictions';

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
    expect(validateQuickLogForm({ ...form, type: 'medication', medicationName: 'Credelio', quantityGrams: '0', weightKg: '0' })).toBeNull();
  });

  // 14: by the phone's clock, at the moment Save is pressed; past dates are fine (weights are often entered weeks later)
  describe('date and time no later than 5 minutes after Save', () => {
    const savedAt = new Date('2026-10-14T10:00');

    it.each(['2026-10-14T10:05', '2026-10-14T09:59', '2026-08-01T08:00'])('%j is saved', (localTimestamp) => {
      expect(validateQuickLogForm({ ...form, type: 'pee', localTimestamp }, savedAt)).toBeNull();
    });

    it.each(['2026-10-14T10:06', '2026-10-15T09:00'])('%j blocks the save', (localTimestamp) => {
      expect(validateQuickLogForm({ ...form, type: 'pee', localTimestamp }, savedAt)).toEqual({ field: 'timestamp', messageKey: 'dateTimeInFuture' });
    });
  });

  // 31
  it.each(['', '   '])('medication: name %j blocks the save', (medicationName) => {
    expect(validateQuickLogForm({ ...form, type: 'medication', medicationName })).toEqual({ field: 'medicationName', messageKey: 'medicationRequired' });
  });

  it('medication: the name is saved trimmed', () => {
    expect(validateQuickLogForm({ ...form, type: 'medication', medicationName: ' Credelio ' })).toBeNull();
    expect(buildQuickLogActivity({ ...form, type: 'medication', medicationName: ' Credelio ' }).medicationName).toBe('Credelio');
  });
});

// 32: an edit sends null for an emptied note, so the server deletes it (JSON drops undefined)
describe('buildQuickLogActivity notes', () => {
  it.each(['', '   '])('an empty note %j is sent as null', (notes) => {
    expect(buildQuickLogActivity({ ...form, notes }).notes).toBeNull();
  });

  it('a note is sent trimmed', () => {
    expect(buildQuickLogActivity({ ...form, notes: ' ate fast ' }).notes).toBe('ate fast');
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

  it('a dog with no gram goal gets no grams suggested: no "(Xg)" on the button, an empty box', () => {
    expect(suggestNextMealGrams(0, 2, 0, 0)).toBeUndefined();
    expect(suggestNextMealGrams(0, 2, 80, 1)).toBeUndefined();
    expect(calculateNextMealPortion(0, 2, 0, 0)).toBeUndefined();
  });
});

describe('getRecommendedMealsPerDay (engine fallback and new-dog default)', () => {
  it.each([['2026-07-18', 4], ['2026-07-17', 3], ['2026-04-17', 3], ['2026-04-16', 2], ['2026-01-01', 2]])(
    'born %s, on 2026-10-15 -> %i meals', (birthDate, meals) => {
      expect(getRecommendedMealsPerDay(birthDate, new Date('2026-10-15T12:00:00+02:00'))).toBe(meals);
    }
  );
});
