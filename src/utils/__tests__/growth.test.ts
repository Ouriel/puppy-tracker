import { describe, it, expect } from 'vitest';
import { getExpectedAdultWeight, getWalthamCategory, scaleGrowthBenchmarks } from '../weight';
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

  it('scales growth benchmarks proportionally for small breeds like Chihuahua (3kg adult)', () => {
    const benchmarks = scaleGrowthBenchmarks(3);
    expect(benchmarks.length).toBe(5);
    expect(benchmarks.find((benchmark) => benchmark.label === '8w')?.expectedKg).toBe(1.0);
    expect(benchmarks.find((benchmark) => benchmark.label === '16w')?.expectedKg).toBe(2.0);
    const m12 = benchmarks.find((b) => b.label === '12m');
    expect(m12?.expectedKg).toBe(3);
  });

  it('scales growth benchmarks proportionally for large breeds like Golden Retriever (30kg adult)', () => {
    expect(getWalthamCategory(30)).toBe('IV');
    const benchmarks = scaleGrowthBenchmarks(30);
    const m12 = benchmarks.find((b) => b.label === '12m');
    expect(m12?.expectedKg).toBe(30);
    const w8 = benchmarks.find((b) => b.label === '8w');
    // Category IV reaches 22% of adult weight at 8 weeks: 0.22 * 30 = 6.6 kg
    expect(w8?.expectedKg).toBe(6.6);
  });
});
