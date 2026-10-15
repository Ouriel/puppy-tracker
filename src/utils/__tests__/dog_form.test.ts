import { describe, it, expect } from 'vitest';
import { buildDogPayload, dogFormFromProfile, NEW_DOG_FORM } from '../dogForm';
import type { PuppyProfile } from '../../types';

const stored: PuppyProfile = {
  id: 'dog-1',
  name: 'Rex',
  breed: 'Mixed Breed',
  birthDate: '2026-05-01',
  dailyFoodGramGoal: 200,
  targetMealsPerDay: 2,
  expectedAdultWeightKg: 20,
};

describe('buildDogPayload: the adult weight is saved only for Other, Mixed or Unknown breed', () => {
  it('a new dog of a standard breed saves no adult weight typed before switching breed', () => {
    const form = { ...NEW_DOG_FORM, name: 'Rex', breed: 'Beagle', expectedAdultWeightKg: 20, birthDate: '2026-05-01', dailyFoodGramGoal: '200', targetMealsPerDay: '2' };
    expect(buildDogPayload(form).expectedAdultWeightKg ?? null).toBeNull();
  });

  it('switching a stored dog to a standard breed clears its adult weight', () => {
    const form = { ...dogFormFromProfile(stored), breed: 'Beagle' };
    expect(buildDogPayload(form, stored).expectedAdultWeightKg).toBeNull();
  });

  it('a stored standard-breed dog whose breed is unchanged keeps the value it stores', () => {
    const standardBreedDog = { ...stored, breed: 'English Cocker Spaniel', expectedAdultWeightKg: 14.5 };
    const payload = buildDogPayload(dogFormFromProfile(standardBreedDog), standardBreedDog);
    expect({ ...standardBreedDog, ...payload }.expectedAdultWeightKg).toBe(14.5);
  });

  it('Other / Mixed / Unknown save the typed value', () => {
    expect(buildDogPayload(dogFormFromProfile(stored), stored).expectedAdultWeightKg).toBe(20);
  });
});
