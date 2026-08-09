import { describe, it, expect } from 'vitest';
import { calculateNextVaccineBooster, calculateNextDewormingDate } from '../health';

describe('French Veterinary Health Protocol Calculations', () => {
  it('should calculate 1-month DHPP booster date for puppies', () => {
    const nextDue = calculateNextVaccineBooster('2026-06-15', 'DHPP');
    expect(nextDue).toBe('2026-07-15');
  });

  it('should calculate 1-year Rabies (Rage) booster date', () => {
    const nextDue = calculateNextVaccineBooster('2026-06-15', 'Rage');
    expect(nextDue).toBe('2027-06-15');
  });

  it('should calculate every-2-weeks vermifuge for puppies under 2 months', () => {
    const nextDeworming = calculateNextDewormingDate('2026-06-01', 1);
    expect(nextDeworming).toBe('2026-06-15');
  });

  it('should calculate monthly vermifuge schedule for puppies 2-6 months', () => {
    const nextDeworming = calculateNextDewormingDate('2026-06-01', 3);
    expect(nextDeworming).toBe('2026-07-01');
  });

  it('should calculate quarterly vermifuge schedule for dogs over 6 months', () => {
    const nextDeworming = calculateNextDewormingDate('2026-06-01', 8);
    expect(nextDeworming).toBe('2026-09-01');
  });
});
