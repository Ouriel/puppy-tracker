import { describe, it, expect } from 'vitest';
import { findBreed, BREED_CATALOG } from '../../data/breedsCatalog';
import { formatBreedName } from '../breeds';
import { getExpectedAdultWeight } from '../weight';
import { PuppyProfileSchema } from '../schemas';

describe('Veterinary Breed Catalog & Resolution Tests', () => {
  it('contains over 60 clinically categorized dog breeds', () => {
    expect(BREED_CATALOG.length).toBeGreaterThanOrEqual(60);
  });

  it('resolves breeds by English name (case-insensitive)', () => {
    const golden = findBreed('Golden Retriever');
    expect(golden).toBeDefined();
    expect(golden?.id).toBe('golden-retriever');

    const husky = findBreed('siberian husky');
    expect(husky).toBeDefined();
    expect(husky?.id).toBe('siberian-husky');
  });

  it('resolves breeds by French name', () => {
    const berger = findBreed('Berger Australien');
    expect(berger).toBeDefined();
    expect(berger?.id).toBe('australian-shepherd');

    const bouledogue = findBreed('Bouledogue Français');
    expect(bouledogue).toBeDefined();
    expect(bouledogue?.id).toBe('french-bulldog');
  });

  it('resolves common colloquial aliases', () => {
    expect(findBreed('staffie')?.id).toBe('staffordshire-bull-terrier');
    expect(findBreed('malinois')?.id).toBe('belgian-malinois');
    expect(findBreed('aussie')?.id).toBe('australian-shepherd');
    expect(findBreed('frenchie')?.id).toBe('french-bulldog');
    expect(findBreed('sheltie')?.id).toBe('shetland-sheepdog');
  });

  it('resolves legacy bilingual format cleanly', () => {
    const match = findBreed('English Cocker Spaniel / Cocker Anglais');
    expect(match).toBeDefined();
    expect(match?.id).toBe('english-cocker-spaniel');
  });

  it('formats breed names in both English and French', () => {
    expect(formatBreedName('golden-retriever', 'en')).toBe('Golden Retriever');
    expect(formatBreedName('golden-retriever', 'fr')).toBe('Golden Retriever');
    expect(formatBreedName('australian-shepherd', 'fr')).toBe('Berger Australien');
    expect(formatBreedName('australian-shepherd', 'en')).toBe('Australian Shepherd');
    expect(formatBreedName('english-cocker-spaniel', 'fr')).toBe('Cocker Anglais');
  });

  it('computes correct gender-dimorphic expected adult weights', () => {
    const femaleGolden = getExpectedAdultWeight('Golden Retriever', 'female');
    const maleGolden = getExpectedAdultWeight('Golden Retriever', 'male');
    expect(femaleGolden).toBe(28);
    expect(maleGolden).toBe(32);
    expect(maleGolden).toBeGreaterThan(femaleGolden);

    const femaleAussie = getExpectedAdultWeight('Berger Australien', 'female');
    const maleAussie = getExpectedAdultWeight('Berger Australien', 'male');
    expect(femaleAussie).toBe(22);
    expect(maleAussie).toBe(27);

    const femaleGerman = getExpectedAdultWeight('Berger Allemand', 'female');
    const maleGerman = getExpectedAdultWeight('Berger Allemand', 'male');
    expect(femaleGerman).toBe(30);
    expect(maleGerman).toBe(36);
  });

  it('prioritizes custom expected adult weight over breed default', () => {
    // Custom weight provided: 24 kg
    const customResult = getExpectedAdultWeight('Mixed Breed', undefined, 24);
    expect(customResult).toBe(24);

    // Custom weight overrides even known purebreds
    const overriddenLab = getExpectedAdultWeight('Labrador Retriever', 'female', 22);
    expect(overriddenLab).toBe(22);

    // Missing or invalid custom weight falls back to catalog
    const fallbackCatalog = getExpectedAdultWeight('Labrador Retriever', 'female', undefined);
    expect(fallbackCatalog).toBe(28);

    // Unrecognized breed without custom weight falls back to 13 kg
    const unknownFallback = getExpectedAdultWeight('Completely Unknown Mythical Dog', undefined, undefined);
    expect(unknownFallback).toBe(13);
  });

  it('validates PuppyProfileSchema accepts gender and expectedAdultWeightKg', () => {
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

    const parsed = PuppyProfileSchema.safeParse(validProfile);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gender).toBe('female');
      expect(parsed.data.expectedAdultWeightKg).toBe(13.5);
    }
  });

  it('validates PuppyProfileSchema preserves backward compatibility when gender is omitted', () => {
    const legacyProfile = {
      id: 'pup-test-2',
      name: 'Cookie',
      breed: 'Labrador Retriever',
      birthDate: '2026-01-10',
      weightKg: 15,
      dailyFoodGramGoal: 300,
      targetMealsPerDay: 2,
    };

    const parsed = PuppyProfileSchema.safeParse(legacyProfile);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gender).toBeUndefined();
      expect(parsed.data.expectedAdultWeightKg).toBeUndefined();
    }
  });

  it('rejects invalid gender in PuppyProfileSchema', () => {
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

    const parsed = PuppyProfileSchema.safeParse(invalidProfile);
    expect(parsed.success).toBe(false);
  });
});
