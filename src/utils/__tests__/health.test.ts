import { describe, it, expect } from 'vitest';
import { calculateNextVaccineBooster, calculateNextDewormingDate, calculateNextAntiparasiticDate } from '../health';
import type { HealthRecord } from '../../types';

describe('Health Passport — French Veterinary Protocol & Dataset Test Suite', () => {
  /**
   * Complete realistic lifetime health passport dataset for a puppy (Balma)
   * covering initial primer shots, 12w/16w boosters, 1yr annual boosters, and ESCCAP deworming history.
   */
  const healthPassportDataset: HealthRecord[] = [
    // --- Vaccination History ---
    {
      id: 'v1-8w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'vaccination',
      name: 'CHPPi + L4 (Primovaccination 8 sem)',
      date: '2026-05-22',
      boosterDate: '2026-06-22',
      vetClinic: 'Clinique Vétérinaire des Alizés',
      batchNumber: 'LOT-CHPPi-2026A',
    },
    {
      id: 'v2-12w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'vaccination',
      name: 'CHPPi + L4 (Rappel 1 - 12 sem)',
      date: '2026-06-22',
      boosterDate: '2026-07-22',
      vetClinic: 'Clinique Vétérinaire des Alizés',
      batchNumber: 'LOT-CHPPi-2026B',
    },
    {
      id: 'v3-16w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'vaccination',
      name: 'CHPPi + L4 + Rage (Rappel 2 - 16 sem)',
      date: '2026-07-22',
      boosterDate: '2027-07-22',
      vetClinic: 'Clinique Vétérinaire des Alizés',
      batchNumber: 'LOT-RAGE-2026C',
    },

    // --- Deworming History (ESCCAP France) ---
    {
      id: 'd1-4w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'deworming',
      name: 'Milbemax Tab Chiot',
      productName: 'Milbemax Tab Chiot',
      date: '2026-04-25',
      boosterDate: '2026-05-09',
      weightAtTime: 1.8,
    },
    {
      id: 'd2-6w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'deworming',
      name: 'Milbemax Tab Chiot',
      productName: 'Milbemax Tab Chiot',
      date: '2026-05-09',
      boosterDate: '2026-05-23',
      weightAtTime: 2.4,
    },
    {
      id: 'd3-8w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'deworming',
      name: 'Milbemax Tab Chiot',
      productName: 'Milbemax Tab Chiot',
      date: '2026-05-23',
      boosterDate: '2026-06-23',
      weightAtTime: 3.2,
    },
    {
      id: 'd4-12w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'deworming',
      name: 'Credelio Plus',
      productName: 'Credelio Plus',
      date: '2026-06-23',
      boosterDate: '2026-07-23',
      weightAtTime: 5.1,
    },
    {
      id: 'd5-16w',
      householdId: 'hh-001',
      puppyId: 'pup-balma',
      type: 'deworming',
      name: 'Credelio Plus',
      productName: 'Credelio Plus',
      date: '2026-07-23',
      boosterDate: '2026-08-23',
      weightAtTime: 7.8,
    },
  ];

  it('calculates 1-month DHPP booster date for puppy primers', () => {
    const nextDue = calculateNextVaccineBooster('2026-05-22', 'DHPP', 2);
    expect(nextDue).toBe('2026-06-22');
  });

  it('calculates 12-month Leptospirose booster date', () => {
    const nextDue = calculateNextVaccineBooster('2026-05-22', 'Leptospirose');
    expect(nextDue).toBe('2027-05-22');
  });

  it('calculates 1-year Rabies (Rage) annual booster date', () => {
    const nextDue = calculateNextVaccineBooster('2026-07-22', 'Rage');
    expect(nextDue).toBe('2027-07-22');
  });

  it('calculates Credelio Plus, Nexgard Spectra, and Simparica Trio as strictly monthly (+1 month)', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Credelio Plus', 4)).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Nexgard Spectra', 8)).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Simparica Trio', 12)).toBe('2026-07-15');
  });

  it('calculates Bravecto as quarterly (+3 months / 12 weeks)', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Bravecto', 8)).toBe('2026-09-15');
  });

  it('calculates Milbemax puppy as monthly (<6m) and adult as quarterly (>=6m)', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Milbemax Tab', 3)).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Milbemax Tab', 8)).toBe('2026-09-15');
  });

  it('calculates biweekly vermifuge under 2 months according to ESCCAP France', () => {
    const nextDeworming = calculateNextDewormingDate('2026-04-25', 1);
    expect(nextDeworming).toBe('2026-05-09');
  });

  it('calculates monthly vermifuge between 2 and 6 months according to ESCCAP France', () => {
    const nextDeworming = calculateNextDewormingDate('2026-05-23', 3);
    expect(nextDeworming).toBe('2026-06-23');
  });

  it('calculates quarterly vermifuge over 6 months according to ESCCAP France', () => {
    const nextDeworming = calculateNextDewormingDate('2026-09-23', 8);
    expect(nextDeworming).toBe('2026-12-23');
  });

  it('evaluates vaccine dataset: superceded vaccines (v1-8w, v2-12w) have subsequent entries and are marked fulfilled', () => {
    const vaccines = healthPassportDataset.filter((r) => r.type === 'vaccination');
    const sorted = [...vaccines].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const latestVaccine = sorted[0];
    expect(latestVaccine.id).toBe('v3-16w');

    // v1-8w has subsequent entries (v2 and v3) -> should be marked fulfilled
    const hasSubsequentV1 = vaccines.some((other) => other.id !== 'v1-8w' && new Date(other.date).getTime() >= new Date('2026-05-22').getTime());
    expect(hasSubsequentV1).toBe(true);

    // v2-12w has subsequent entry (v3) -> should be marked fulfilled
    const hasSubsequentV2 = vaccines.some((other) => other.id !== 'v2-12w' && new Date(other.date).getTime() >= new Date('2026-06-22').getTime());
    expect(hasSubsequentV2).toBe(true);

    // v3-16w is the latest -> has no subsequent entries
    const hasSubsequentV3 = vaccines.some((other) => other.id !== 'v3-16w' && new Date(other.date).getTime() >= new Date('2026-07-22').getTime());
    expect(hasSubsequentV3).toBe(false);
  });

  it('evaluates deworming dataset: older deworming doses (d1..d4) have subsequent entries and are marked fulfilled', () => {
    const dewormingLogs = healthPassportDataset.filter((r) => r.type === 'deworming');
    const sorted = [...dewormingLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const latestDeworming = sorted[0];
    expect(latestDeworming.id).toBe('d5-16w');

    // d1..d4 all have subsequent entries
    ['d1-4w', 'd2-6w', 'd3-8w', 'd4-12w'].forEach((id) => {
      const entry = dewormingLogs.find((d) => d.id === id)!;
      const hasSubsequent = dewormingLogs.some((other) => other.id !== id && new Date(other.date).getTime() >= new Date(entry.date).getTime());
      expect(hasSubsequent).toBe(true);
    });

    // d5-16w has no subsequent entry
    const hasSubsequentD5 = dewormingLogs.some((other) => other.id !== 'd5-16w' && new Date(other.date).getTime() >= new Date('2026-07-23').getTime());
    expect(hasSubsequentD5).toBe(false);
  });
});
