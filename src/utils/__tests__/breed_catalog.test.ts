import { describe, it, expect } from 'vitest';
import { findBreed, BREED_CATALOG, formatBreedName } from '../../data/breedsCatalog';
import { getExpectedAdultWeight } from '../weight';

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
    expect(formatBreedName('australian-shepherd', 'fr')).toBe('Berger australien');
    expect(formatBreedName('australian-shepherd', 'en')).toBe('Australian Shepherd');
    expect(formatBreedName('english-cocker-spaniel', 'fr')).toBe('Cocker anglais');
    expect(formatBreedName('mixed-breed', 'fr')).toBe('Bâtard / croisé');
  });

  // French writes nationality adjectives and common nouns in lower case ('Cocker anglais'); English keeps Title Case.
  // Shown names only: a breed saved as 'Cocker Anglais' still resolves, since matching ignores case (above).
  it('French breed names are in sentence case', () => {
    const titleCased = /[ (](Anglais|Américain|Allemand|Australien|Belge|Blanc|Suisse|Français|Bernois|Écossais|Sibérien|Rhodésien|Breton|Hongrois|Irlandais|Italien|Frisé|Maltais|Havanais|Nain|Moyen|Royal|Toy|Standard|Croisé|Inconnue|Chasse|Lapin|Crête|Poil|Plat|Continental|Papillon|Poméranien|Malinois|Ancestral|Berger|Lévrier|Caniche)\b/u;
    expect(BREED_CATALOG.map((breed) => breed.nameFr).filter((name) => titleCased.test(name))).toEqual([]);
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

    const femaleCocker = getExpectedAdultWeight('English Cocker Spaniel', 'female');
    const maleCocker = getExpectedAdultWeight('English Cocker Spaniel', 'male');
    expect(femaleCocker).toBe(13.0);
    expect(maleCocker).toBe(14.5);
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
    // ('Unknown ...' names would hit the catalog's own 'unknown' entry, so use a name nothing matches)
    expect(findBreed('Xyzzy')).toBeUndefined();
  });

  it('matches an alias only as a whole word: a custom "Labradoodle" is not a Labrador', () => {
    expect(findBreed('Labradoodle')).toBeUndefined();
    expect(formatBreedName('Labradoodle', 'fr')).toBe('Labradoodle');
    expect(findBreed('Cockapoo')).toBeUndefined();
    // Whole-word aliases still match, inside a longer name too
    expect(findBreed('lab')?.id).toBe('labrador-retriever');
    expect(findBreed('Black lab')?.id).toBe('labrador-retriever');
    expect(findBreed('pug')?.id).toBeDefined();
    // Nothing to match: blank or punctuation-only text is no breed (it used to give Australian Shepherd / Newfoundland)
    expect(findBreed('   ')).toBeUndefined();
    expect(findBreed('-')).toBeUndefined();
    expect(findBreed('. ')).toBeUndefined();
    const unknownFallback = getExpectedAdultWeight('Xyzzy', undefined, undefined);
    expect(unknownFallback).toBe(13);
  });
});
