import { describe, it, expect } from 'vitest';

export function calculateNextVaccineBooster(injectionDate: string, vaccineType: 'Rage' | 'DHPP' | 'Leptospirose'): string {
  const date = new Date(injectionDate);
  if (vaccineType === 'DHPP') {
    date.setMonth(date.getMonth() + 1); // 1 month booster for puppy primers
  } else if (vaccineType === 'Leptospirose') {
    date.setMonth(date.getMonth() + 6); // 6 month booster
  } else {
    date.setFullYear(date.getFullYear() + 1); // Annual Rabies booster
  }
  return date.toISOString().slice(0, 10);
}

export function calculateNextDewormingDate(injectionDate: string, ageMonths: number): string {
  const date = new Date(injectionDate);
  if (ageMonths < 6) {
    date.setMonth(date.getMonth() + 1); // Monthly under 6 months
  } else {
    date.setMonth(date.getMonth() + 3); // Quarterly after 6 months
  }
  return date.toISOString().slice(0, 10);
}

describe('French Veterinary Health Protocol Calculations', () => {
  it('should calculate 1-month DHPP booster date for puppies', () => {
    const nextDue = calculateNextVaccineBooster('2026-06-15', 'DHPP');
    expect(nextDue).toBe('2026-07-15');
  });

  it('should calculate 1-year Rabies (Rage) booster date', () => {
    const nextDue = calculateNextVaccineBooster('2026-06-15', 'Rage');
    expect(nextDue).toBe('2027-06-15');
  });

  it('should calculate monthly vermifuge schedule for puppies under 6 months', () => {
    const nextDeworming = calculateNextDewormingDate('2026-06-01', 3);
    expect(nextDeworming).toBe('2026-07-01');
  });

  it('should calculate quarterly vermifuge schedule for dogs over 6 months', () => {
    const nextDeworming = calculateNextDewormingDate('2026-06-01', 8);
    expect(nextDeworming).toBe('2026-09-01');
  });
});
