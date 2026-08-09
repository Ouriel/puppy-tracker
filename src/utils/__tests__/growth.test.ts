import { describe, it, expect } from 'vitest';
import { getExpectedAdultWeight, scaleGrowthBenchmarks } from '../../components/WeightGrowthChart';

describe('breed-scalable weight growth chart — comprehensive test suite', () => {
  it('returns exact adult target weights for various small, medium, and large dog breeds', () => {
    expect(getExpectedAdultWeight('English Cocker Spaniel')).toBe(13);
    expect(getExpectedAdultWeight('Chihuahua')).toBe(3);
    expect(getExpectedAdultWeight('Golden Retriever')).toBe(30);
    expect(getExpectedAdultWeight('Berger Allemand')).toBe(32);
    expect(getExpectedAdultWeight('Unknown Breed')).toBe(13);
  });

  it('scales growth benchmarks proportionally for small breeds like Chihuahua (3kg adult)', () => {
    const benchmarks = scaleGrowthBenchmarks(3);
    expect(benchmarks.length).toBe(5);
    // 12m benchmark expected weight should be ~3kg
    const m12 = benchmarks.find((b) => b.label === '12m');
    expect(m12?.expectedKg).toBe(3);
  });

  it('scales growth benchmarks proportionally for large breeds like Golden Retriever (30kg adult)', () => {
    const benchmarks = scaleGrowthBenchmarks(30);
    const m12 = benchmarks.find((b) => b.label === '12m');
    expect(m12?.expectedKg).toBe(30);
    const w8 = benchmarks.find((b) => b.label === '8w');
    // 2.5 * (30/13) = ~5.8kg at 8 weeks for a Golden Retriever
    expect(w8?.expectedKg).toBeGreaterThan(5);
  });
});
