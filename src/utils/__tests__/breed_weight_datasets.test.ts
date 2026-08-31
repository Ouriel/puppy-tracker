import { describe, it, expect } from 'vitest';
import {
  calculateProjectedAdultWeightRange,
  getExpectedAdultWeight,
  getWalthamCategory,
} from '../weight';

describe('Multi-Breed Weight Trajectory & Custom Weight Dataset Tests', () => {
  it('calibrates Category I for miniature breeds (Chihuahua)', () => {
    const birthDate = '2026-01-01T00:00:00.000Z';
    const logs = [
      { timestamp: '2026-03-01T00:00:00.000Z', weightKg: 1.0 },
      { timestamp: '2026-04-01T00:00:00.000Z', weightKg: 1.8 },
      { timestamp: '2026-05-01T00:00:00.000Z', weightKg: 2.3 },
    ];
    const result = calculateProjectedAdultWeightRange('Chihuahua', logs, birthDate, 2.3, 'female');
    expect(result.walthamCategory).toBe('I');
    expect(result.projectedAdultKg).toBeGreaterThanOrEqual(2.2);
    expect(result.projectedAdultKg).toBeLessThanOrEqual(3.5);
  });

  it('calibrates Category II for small breeds (Jack Russell Terrier)', () => {
    const birthDate = '2026-01-01T00:00:00.000Z';
    const logs = [
      { timestamp: '2026-03-01T00:00:00.000Z', weightKg: 2.2 },
      { timestamp: '2026-04-01T00:00:00.000Z', weightKg: 3.8 },
      { timestamp: '2026-05-01T00:00:00.000Z', weightKg: 5.1 },
    ];
    const result = calculateProjectedAdultWeightRange('Jack Russell Terrier', logs, birthDate, 5.1, 'female');
    expect(result.walthamCategory).toBe('II');
    expect(result.projectedAdultKg).toBeGreaterThanOrEqual(5.5);
    expect(result.projectedAdultKg).toBeLessThanOrEqual(7.5);
  });

  it('calibrates Category III for medium breeds (English Cocker Spaniel with gender)', () => {
    const birthDate = '2026-03-27T00:00:00.000Z';
    const logs = [
      { timestamp: '2026-05-27T00:00:00.000Z', weightKg: 4.1 },
      { timestamp: '2026-06-27T00:00:00.000Z', weightKg: 6.0 },
      { timestamp: '2026-07-25T00:00:00.000Z', weightKg: 7.8 },
      { timestamp: '2026-08-25T00:00:00.000Z', weightKg: 9.5 },
    ];
    // Female Cocker
    const femaleRes = calculateProjectedAdultWeightRange('English Cocker Spaniel', logs, birthDate, 9.5, 'female');
    expect(femaleRes.walthamCategory).toBe('III');
    expect(femaleRes.projectedAdultKg).toBeGreaterThanOrEqual(13.0);
    expect(femaleRes.projectedAdultKg).toBeLessThanOrEqual(15.5);
  });

  it('calibrates Category IV for large breeds (Border Collie / Australian Shepherd)', () => {
    const birthDate = '2026-01-01T00:00:00.000Z';
    const logs = [
      { timestamp: '2026-03-01T00:00:00.000Z', weightKg: 5.2 },
      { timestamp: '2026-04-01T00:00:00.000Z', weightKg: 9.5 },
      { timestamp: '2026-05-01T00:00:00.000Z', weightKg: 13.8 },
      { timestamp: '2026-06-01T00:00:00.000Z', weightKg: 17.5 },
    ];
    const result = calculateProjectedAdultWeightRange('Australian Shepherd', logs, birthDate, 17.5, 'male');
    expect(result.walthamCategory).toBe('IV');
    expect(result.projectedAdultKg).toBeGreaterThanOrEqual(24.0);
    expect(result.projectedAdultKg).toBeLessThanOrEqual(30.0);
  });

  it('calibrates Category V for giant breeds (Golden Retriever / Bernese Mountain Dog)', () => {
    const birthDate = '2026-01-01T00:00:00.000Z';
    const logs = [
      { timestamp: '2026-03-01T00:00:00.000Z', weightKg: 6.5 },
      { timestamp: '2026-04-01T00:00:00.000Z', weightKg: 12.0 },
      { timestamp: '2026-05-01T00:00:00.000Z', weightKg: 17.5 },
      { timestamp: '2026-06-01T00:00:00.000Z', weightKg: 22.0 },
    ];
    const result = calculateProjectedAdultWeightRange('Golden Retriever', logs, birthDate, 22.0, 'male');
    expect(result.walthamCategory).toBe('V');
    expect(result.projectedAdultKg).toBeGreaterThanOrEqual(30.0);
    expect(result.projectedAdultKg).toBeLessThanOrEqual(40.0);
  });

  it('calibrates growth trajectory using custom expected adult weight for crossbreeds', () => {
    const birthDate = '2026-01-01T00:00:00.000Z';
    const logs = [
      { timestamp: '2026-03-01T00:00:00.000Z', weightKg: 4.8 },
      { timestamp: '2026-04-01T00:00:00.000Z', weightKg: 8.5 },
      { timestamp: '2026-05-01T00:00:00.000Z', weightKg: 12.2 },
      { timestamp: '2026-06-01T00:00:00.000Z', weightKg: 15.5 },
    ];

    // Mixed breed with custom expected adult weight = 24 kg (Category IV)
    const customWeightKg = 24;
    const result = calculateProjectedAdultWeightRange(
      'Mixed Breed',
      logs,
      birthDate,
      15.5,
      undefined,
      customWeightKg
    );

    expect(getExpectedAdultWeight('Mixed Breed', undefined, customWeightKg)).toBe(24);
    expect(getWalthamCategory(24)).toBe('IV');
    expect(result.walthamCategory).toBe('IV');
    expect(result.projectedAdultKg).toBeGreaterThanOrEqual(21.0);
    expect(result.projectedAdultKg).toBeLessThanOrEqual(27.0);
  });
});
