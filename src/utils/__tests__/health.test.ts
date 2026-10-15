import { describe, it, expect, vi } from 'vitest';
import { calculateNextVaccineBooster, calculateNextDewormingDate, calculateNextAntiparasiticDate, getHealthRecordDateError, getHealthRecordStatus, isVetVisitWeight } from '../health';
import type { Activity, HealthRecord } from '../../types';

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
    },
  ];

  it('calculates 1-month DHPP booster date for puppy primers', () => {
    // 2 months old on the injection day
    const nextDue = calculateNextVaccineBooster('2026-05-22', 'DHPP', '2026-03-22');
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
    // CHPPi sans L4 given at 18 months -> 36 months
    const nextDueViral = calculateNextVaccineBooster('2026-07-22', 'chppi_sans_l4', '2025-01-22');
    expect(nextDueViral).toBe('2029-07-22');

    // 16 months on the injection day is the cutoff: triennial from 16, annual at 14
    expect(calculateNextVaccineBooster('2026-07-22', 'chppi_sans_l4', '2025-03-22')).toBe('2029-07-22');
    expect(calculateNextVaccineBooster('2026-07-22', 'chppi_sans_l4', '2025-05-22')).toBe('2027-07-22');

    // Vanguard CPV given at 24 months -> 36 months
    const nextDueCpv = calculateNextVaccineBooster('2026-07-22', 'vanguard_cpv', '2024-07-22');
    expect(nextDueCpv).toBe('2029-07-22');
  });

  it('calculates 12-month annual booster for combined CHPPi + L4 even for adult dogs (L4 drives annual cadence)', () => {
    const nextDueCombined = calculateNextVaccineBooster('2026-07-22', 'chppi_l4', '2025-01-22');
    expect(nextDueCombined).toBe('2027-07-22');
  });

  it('calculates Credelio Plus, Nexgard Spectra, and Simparica Trio as strictly monthly (+1 month)', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Credelio Plus', '2026-02-15')).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Nexgard Spectra', '2025-10-15')).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Simparica Trio', '2025-06-15')).toBe('2026-07-15');
  });

  it('calculates Bravecto as quarterly (+3 months / 12 weeks)', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Bravecto', '2025-10-15')).toBe('2026-09-15');
  });

  it('calculates Milbemax puppy as monthly (<6m) and adult as quarterly (>=6m)', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Milbemax Tab', '2026-03-15')).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Milbemax Tab', '2025-12-15')).toBe('2026-09-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Milbemax Tab', '2025-10-15')).toBe('2026-09-15');
  });

  it('falls back to monthly (<6m) and quarterly (>=6m) for an unknown product', () => {
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Xyzzy', '2026-03-15')).toBe('2026-07-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Xyzzy', '2025-12-15')).toBe('2026-09-15');
    expect(calculateNextAntiparasiticDate('2026-06-15', 'Xyzzy', '2025-10-15')).toBe('2026-09-15');
  });

  it('calculates biweekly vermifuge for a young puppy according to ESCCAP France', () => {
    const nextDeworming = calculateNextDewormingDate('2026-04-25', '2026-03-25');
    expect(nextDeworming).toBe('2026-05-09');
  });

  it('calculates monthly vermifuge between 12 weeks and 6 months according to ESCCAP France', () => {
    const nextDeworming = calculateNextDewormingDate('2026-05-23', '2026-02-23');
    expect(nextDeworming).toBe('2026-06-23');
  });

  it('calculates quarterly vermifuge over 6 months according to ESCCAP France', () => {
    const nextDeworming = calculateNextDewormingDate('2026-09-23', '2026-01-23');
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

  it('matches hand-typed vaccine names to the right vaccine (longest alias wins; r, l4, kc only as whole words)', () => {
    const record = (id: string, name: string, date: string, boosterDate: string): HealthRecord => (
      { id, householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name, date, boosterDate }
    );
    const statusOf = (target: HealthRecord, records: HealthRecord[]) => getHealthRecordStatus(target, records).urgency;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-08-01T10:00:00.000Z'));
    try {
      // 'chppi sans l4' must resolve to CHPPi sans L4 (which does not include L4), not to the first 'chppi' alias (CHPPi + L4)
      const lepto = record('lepto', 'Leptospirose L4', '2026-01-10', '2027-01-10');
      expect(statusOf(lepto, [lepto, record('sans', 'CHPPi sans L4', '2026-03-10', '2026-04-10')])).toBe('overdue');
      // An unknown name containing the letter r is not a rabies shot
      const rage = record('rage', 'Rage', '2026-01-10', '2027-01-10');
      expect(statusOf(rage, [rage, record('herpes', 'Herpès', '2026-03-10', '2027-03-10')])).toBe('overdue');
      // Whole-word short aliases still work: a later 'Lepto L4' renews the L4 shot
      expect(statusOf(lepto, [lepto, record('lepto2', 'Lepto L4', '2026-12-01', '2027-12-01')])).toBe('fulfilled');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renews a CHPPi + L4 shot with a later L4-only booster (L4 sets its yearly date; owner decision F2)', () => {
    const combo: HealthRecord = { id: 'combo', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'CHPPi + L4 (Eurican / Nobivac / Versican)', date: '2027-03-27', boosterDate: '2028-03-27' };
    const leptoOnly: HealthRecord = { id: 'l4', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'Leptospirose L4', date: '2028-03-27', boosterDate: '2029-03-27' };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2028-06-01T10:00:00.000Z'));
    try {
      expect(getHealthRecordStatus(combo, [combo, leptoOnly]).urgency).toBe('fulfilled');
      expect(getHealthRecordStatus(leptoOnly, [combo, leptoOnly]).urgency).toBe('upToDate');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not let two records of the same vaccine on the same day renew each other', () => {
    const first: HealthRecord = { id: 'rage-a', householdId: 'hh-001', puppyId: 'pup-balma', type: 'vaccination', name: 'Rage', date: '2026-07-22', boosterDate: '2027-07-22' };
    const duplicate: HealthRecord = { ...first, id: 'rage-b' };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-08-01T10:00:00.000Z'));
    try {
      expect(getHealthRecordStatus(first, [first, duplicate]).urgency).toBe('overdue');
      expect(getHealthRecordStatus(duplicate, [first, duplicate]).urgency).toBe('overdue');
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

describe('isVetVisitWeight (the stethoscope on a weigh-in, Phase 5c step 7)', () => {
  const weighIn = (notes: string | null): Activity => ({ id: 'act-w', puppyId: 'pup-1', type: 'weight', timestamp: '2026-07-27T10:00:00.000Z', weightKg: 7.5, notes, loggedBy: 'Tester' });

  it.each([
    ['Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)', true],
    ['Credelio Plus', true],
    ['après balade', false],
    ['Credelio', false],
    [null, false],
  ])('notes %j -> %s: only a vaccine or antiparasitic name of healthProtocols.json', (notes, expected) => {
    expect(isVetVisitWeight(weighIn(notes))).toBe(expected);
  });
});

describe('Suggested next dates (pre-fill review items 11, 12, 13; TZ=Europe/Paris)', () => {
  // Made-up dog born 5 Jan 2026: 16 weeks old on 27 Apr 2026, 1 year old on 5 Jan 2027
  const birthDate = '2026-01-05';

  describe('vaccines: age on the injection day, French puppy series (owner decision 2026-10-14)', () => {
    it('a CHPPi-family dose before 16 weeks suggests +1 month, even when entered months later', () => {
      expect(calculateNextVaccineBooster('2026-03-02', 'chppi_l4', birthDate)).toBe('2026-04-02'); // 8 weeks
      expect(calculateNextVaccineBooster('2026-04-20', 'CHPPi / DAPPi (sans L4)', birthDate)).toBe('2026-05-20'); // 15 weeks
      expect(calculateNextVaccineBooster('2026-03-02', 'vanguard_cpv', birthDate)).toBe('2026-04-02');
    });

    it('the dose at 16 weeks or later suggests the 1st birthday', () => {
      expect(calculateNextVaccineBooster('2026-04-27', 'chppi_l4', birthDate)).toBe('2027-01-05'); // exactly 16 weeks
      expect(calculateNextVaccineBooster('2026-05-04', 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)', birthDate)).toBe('2027-01-05');
      expect(calculateNextVaccineBooster('2026-09-10', 'chppi_sans_l4', birthDate)).toBe('2027-01-05');
    });

    it('from the 1st birthday, the adult rules apply unchanged (CHPPi + L4 yearly, viral-only every 3 years from 16 months)', () => {
      expect(calculateNextVaccineBooster('2027-01-05', 'chppi_l4', birthDate)).toBe('2028-01-05');
      expect(calculateNextVaccineBooster('2027-01-05', 'chppi_sans_l4', birthDate)).toBe('2028-01-05'); // 12 months old
      expect(calculateNextVaccineBooster('2027-07-05', 'chppi_sans_l4', birthDate)).toBe('2030-07-05'); // 18 months old
    });

    it('other vaccines keep their own interval, whatever the age', () => {
      expect(calculateNextVaccineBooster('2026-03-02', 'Rage', birthDate)).toBe('2027-03-02');
      expect(calculateNextVaccineBooster('2026-03-02', 'l4', birthDate)).toBe('2027-03-02');
    });

    it('with no birth date, a CHPPi-family dose suggests +12 months, as before', () => {
      expect(calculateNextVaccineBooster('2026-03-02', 'chppi_l4')).toBe('2027-03-02');
      expect(calculateNextVaccineBooster('2026-03-02', 'chppi_sans_l4', '')).toBe('2027-03-02');
    });
  });

  describe('age-based wormers: age on the dose day, every 2 weeks until 12 weeks', () => {
    it('a Drontal dose under 12 weeks suggests +14 days, even when entered months later', () => {
      expect(calculateNextAntiparasiticDate('2026-03-02', 'Drontal Chiot (Sirop / Comprimés)', birthDate)).toBe('2026-03-16'); // 8 weeks
      expect(calculateNextAntiparasiticDate('2026-03-26', 'Drontal Chiot (Sirop / Comprimés)', birthDate)).toBe('2026-04-09'); // 11 weeks
    });

    it('from 12 weeks to 6 months monthly, then quarterly', () => {
      expect(calculateNextAntiparasiticDate('2026-03-30', 'Drontal Chiot (Sirop / Comprimés)', birthDate)).toBe('2026-04-30'); // 12 weeks
      expect(calculateNextAntiparasiticDate('2026-08-10', 'Milbemax', birthDate)).toBe('2026-11-10'); // 7 months
    });

    it('a monthly product stays +1 month at any age', () => {
      expect(calculateNextAntiparasiticDate('2026-03-02', 'Credelio Plus', birthDate)).toBe('2026-04-02');
    });

    it('with no birth date, an age-based wormer suggests +1 month, as before', () => {
      expect(calculateNextAntiparasiticDate('2026-03-02', 'Drontal Chiot (Sirop / Comprimés)')).toBe('2026-04-02');
    });
  });

  describe('calendar month arithmetic', () => {
    it('keeps the day of the month across the spring clock change', () => {
      expect(calculateNextAntiparasiticDate('2027-03-15', 'Credelio Plus', birthDate)).toBe('2027-04-15');
      expect(calculateNextAntiparasiticDate('2027-03-20', 'Credelio Plus', birthDate)).toBe('2027-04-20');
    });

    it('caps a month end at the last day of the target month', () => {
      expect(calculateNextAntiparasiticDate('2027-01-31', 'Credelio Plus', birthDate)).toBe('2027-02-28');
      expect(calculateNextAntiparasiticDate('2027-05-31', 'Bravecto', birthDate)).toBe('2027-08-31');
      expect(calculateNextAntiparasiticDate('2027-11-30', 'Bravecto', birthDate)).toBe('2028-02-29');
      expect(calculateNextVaccineBooster('2028-02-29', 'Rage', birthDate)).toBe('2029-02-28');
    });

    it('a dog born on 29 February has its 1st birthday on 28 February', () => {
      expect(calculateNextVaccineBooster('2024-06-28', 'chppi_l4', '2024-02-29')).toBe('2025-02-28');
    });

    it('+14 days crosses the clock change on the calendar', () => {
      expect(calculateNextAntiparasiticDate('2027-03-20', 'Drontal Chiot (Sirop / Comprimés)', '2027-01-20')).toBe('2027-04-03');
    });
  });
});

describe('getHealthRecordDateError (pre-fill review items 37, 38)', () => {
  it('needs a date, not after today, and a next date not before it', () => {
    expect(getHealthRecordDateError('', '2026-11-01', '2026-10-15')).toBe('dateRequired');
    expect(getHealthRecordDateError('2026-10-16', '2026-11-16', '2026-10-15')).toBe('dateInFuture');
    expect(getHealthRecordDateError('2026-10-15', '2026-10-14', '2026-10-15')).toBe('boosterBeforeDate');
    expect(getHealthRecordDateError('2026-10-15', '2026-10-15', '2026-10-15')).toBeNull();
    expect(getHealthRecordDateError('2026-10-15', '', '2026-10-15')).toBeNull(); // no next date: allowed in an edit
  });
});
