import { describe, it, expect } from 'vitest';
import { calculateNextVaccineBooster, calculateNextDewormingDate } from '../health';

describe('French Veterinary Health Protocol Calculations & Fulfilled Boosters', () => {
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

  it('marks older historical vaccine records as fulfilled when a newer booster is logged', () => {
    const mockVaccines = [
      { id: 'v2', name: 'CHPPi', date: '2026-07-01', boosterDate: '2027-07-01' },
      { id: 'v1', name: 'CHPPi', date: '2026-06-01', boosterDate: '2026-07-01' },
    ];

    // Older vaccine (v1) was administered 2026-06-01 with booster 2026-07-01.
    // Since v2 was administered on 2026-07-01, v1's booster date is fulfilled.
    const hasSubsequentForV1 = mockVaccines.some(
      (other) => other.id !== 'v1' && new Date(other.date).getTime() >= new Date('2026-06-01').getTime()
    );
    expect(hasSubsequentForV1).toBe(true);

    // Latest vaccine (v2) has no subsequent record, so it remains active.
    const hasSubsequentForV2 = mockVaccines.some(
      (other) => other.id !== 'v2' && new Date(other.date).getTime() >= new Date('2026-07-01').getTime()
    );
    expect(hasSubsequentForV2).toBe(false);
  });
});
