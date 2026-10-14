import { describe, it, expect, vi } from 'vitest';
import { calculateNextVaccineBooster, calculateNextDewormingDate, calculateNextAntiparasiticDate, getHealthRecordStatus } from '../health';
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

  it('calculates 36-month (3-year) triennial booster for viral-only vaccines (CHPPi sans L4, Vanguard CPV) from 16 months', () => {
    // CHPPi sans L4 at age 18 months -> 36 months
    const nextDueViral = calculateNextVaccineBooster('2026-07-22', 'chppi_sans_l4', 18);
    expect(nextDueViral).toBe('2029-07-22');

    // 16 months is the cutoff: triennial from 16, annual at 14
    expect(calculateNextVaccineBooster('2026-07-22', 'chppi_sans_l4', 16)).toBe('2029-07-22');
    expect(calculateNextVaccineBooster('2026-07-22', 'chppi_sans_l4', 14)).toBe('2027-07-22');

    // Vanguard CPV at age 24 months -> 36 months
    const nextDueCpv = calculateNextVaccineBooster('2026-07-22', 'vanguard_cpv', 24);
    expect(nextDueCpv).toBe('2029-07-22');
  });

  it('calculates 12-month annual booster for combined CHPPi + L4 even for adult dogs (L4 drives annual cadence)', () => {
    const nextDueCombined = calculateNextVaccineBooster('2026-07-22', 'chppi_l4', 18);
    expect(nextDueCombined).toBe('2027-07-22');
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
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Milbemax Tab', 6)).toBe('2026-09-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Milbemax Tab', 8)).toBe('2026-09-15');
  });

  it('falls back to monthly (<6m) and quarterly (>=6m) for an unknown product', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Xyzzy', 3)).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Xyzzy', 6)).toBe('2026-09-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Xyzzy', 8)).toBe('2026-09-15');
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

  it('evaluates vaccines per vaccine: only a later record of the same vaccine renews one (same-day CHPPi + Rage stay overdue)', () => {
    // Same call as VaccineSection: each record against the vaccination list. The 16-week visit is logged as two
    // records on the same day, and a kennel-cough shot comes later; both 2027-07-22 boosters are past on 2027-08-01.
    const vaccines: HealthRecord[] = [
      ...healthPassportDataset.filter((record) => record.id === 'v1-8w' || record.id === 'v2-12w'),
      { id: 'v3-chppi', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'CHPPi + L4 (Rappel 2 - 16 sem)', date: '2026-07-22', boosterDate: '2027-07-22' },
      { id: 'v3-rage', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)', date: '2026-07-22', boosterDate: '2027-07-22' },
      { id: 'v4-kc', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'Toux de Chenil (Nobivac KC / Bronchi-Shield)', date: '2026-09-01', boosterDate: '2027-09-01' },
    ];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-08-01T10:00:00.000Z'));
    try {
      const urgencyById = Object.fromEntries(
        vaccines.map((record) => [record.id, getHealthRecordStatus(record, vaccines).urgency])
      );
      expect(urgencyById).toEqual({
        'v1-8w': 'fulfilled',
        'v2-12w': 'fulfilled',
        'v3-chppi': 'overdue',
        'v3-rage': 'overdue',
        'v4-kc': 'upToDate',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('renews a vaccine with a later vaccine that covers it (real carnet: CHPPi sans L4 primo, then CHPPi + L4 shots)', () => {
    const vaccines: HealthRecord[] = [
      { id: 'sans-l4', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'CHPPi / DAPPi (sans L4)', date: '2026-05-27', boosterDate: '2026-06-27' },
      { id: 'l4-1', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'CHPPi + L4 (Eurican / Nobivac / Versican)', date: '2026-06-27', boosterDate: '2026-07-25' },
      { id: 'l4-2', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)', date: '2026-07-25', boosterDate: '2027-03-27' },
    ];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00.000Z'));
    try {
      const urgencyById = Object.fromEntries(
        vaccines.map((record) => [record.id, getHealthRecordStatus(record, vaccines).urgency])
      );
      expect(urgencyById).toEqual({ 'sans-l4': 'fulfilled', 'l4-1': 'fulfilled', 'l4-2': 'upToDate' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('evaluates deworming dataset: older doses (d1..d4) are fulfilled and the latest dose (d5) is overdue after its booster date', () => {
    // Same call as DewormingSection: each record against the deworming list. d5's booster is 2026-08-23.
    const dewormingLogs = healthPassportDataset.filter((record) => record.type === 'deworming');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T10:00:00.000Z'));
    try {
      const urgencyById = Object.fromEntries(
        dewormingLogs.map((record) => [record.id, getHealthRecordStatus(record, dewormingLogs).urgency])
      );
      expect(urgencyById).toEqual({
        'd1-4w': 'fulfilled',
        'd2-6w': 'fulfilled',
        'd3-8w': 'fulfilled',
        'd4-12w': 'fulfilled',
        'd5-16w': 'overdue',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('flags the latest record as due soon up to 14 days before its booster date, up to date after that', () => {
    const urgencyForBooster = (boosterDate: string) => {
      const record = { type: 'vaccination' as const, name: 'Rage', date: '2026-08-01', boosterDate };
      return getHealthRecordStatus(record, [record]).urgency;
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T10:00:00.000Z'));
    try {
      expect(urgencyForBooster('2026-09-11')).toBe('soon'); // 9 days
      expect(urgencyForBooster('2026-09-16')).toBe('soon'); // 14 days
      expect(urgencyForBooster('2026-09-17')).toBe('upToDate'); // 15 days
    } finally {
      vi.useRealTimers();
    }
  });

  // Rest of R11, deferred in Phase 3a
  it.todo('due dates across a DST change: local setMonth can move a midnight-UTC record date one day early');
});
