import { describe, it, expect } from 'vitest';
import { getExpectedAdultWeight } from '../weight';
import { findBreed } from '../../data/breedsCatalog';

describe('breed-scalable weight growth chart — comprehensive test suite', () => {
  it('returns exact adult target weights for various small, medium, and large dog breeds', () => {
    expect(getExpectedAdultWeight('English Cocker Spaniel')).toBe(13);
    expect(getExpectedAdultWeight('Chihuahua')).toBe(3);
    expect(getExpectedAdultWeight('Golden Retriever')).toBe(30);
    expect(getExpectedAdultWeight('Berger Allemand')).toBe(32);
    // A name no catalog entry or alias matches falls back to the 13 kg medium default
    expect(findBreed('Xyzzy')).toBeUndefined();
    expect(getExpectedAdultWeight('Xyzzy')).toBe(13);
  });
});
