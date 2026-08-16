import healthProtocols from '../data/healthProtocols.json';

export interface HealthProtocolData {
  vaccines: Array<{ id: string; name: string; fullName: string; defaultBoosterMonths: number; description: string; aliases?: string[] }>;
  antiparasitics: Array<{
    id: string;
    name: string;
    label: string;
    category: string;
    minAgeWeeks: number;
    minWeightKg: number;
    intervalMonths?: number;
    intervalMonthsPuppy?: number;
    intervalMonthsAdult?: number;
    frequencyType: string;
    activeIngredients: string;
  }>;
}

export function getHealthProtocols(): HealthProtocolData {
  return {
    ...healthProtocols,
    vaccines: [...healthProtocols.vaccines].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'fr', { sensitivity: 'base' })
    ),
    antiparasitics: [...healthProtocols.antiparasitics].sort((a, b) =>
      a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    ),
  } as HealthProtocolData;
}

/**
 * Calculates the next booster due date based on vaccine type dataset.
 */
export function calculateNextVaccineBooster(injectionDate: string, vaccineType: string, ageMonths: number = 6): string {
  const date = new Date(injectionDate);
  const typeLower = vaccineType.toLowerCase();
  const matched = healthProtocols.vaccines.find(
    (v) =>
      v.name.toLowerCase().includes(typeLower) ||
      v.id === typeLower ||
      (v.aliases && v.aliases.some((alias) => typeLower.includes(alias) || alias.includes(typeLower)))
  );

  let months = matched ? matched.defaultBoosterMonths : 12;

  // WSAVA: After primovaccination (≥4 months age), core vaccines switch to annual boosters
  if (matched && ['chppi_l4', 'chppi_sans_l4', 'vanguard_cpv'].includes(matched.id)) {
    if (ageMonths >= 4) {
      months = 12;
    }
  }

  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export interface HealthStatusResult {
  urgency: 'overdue' | 'soon' | 'upToDate' | 'fulfilled';
  label: string;
  color: 'danger' | 'warning' | 'success' | 'default';
}

/**
 * Evaluates health record booster status (fulfilled, overdue, due soon, or up-to-date)
 */
export function getHealthRecordStatus<T extends { id: string; date: string; boosterDate?: string }>(
  record: T,
  allRecords: T[],
  upToDateLabel: string = 'Up to Date',
  fulfilledLabel: string = 'Fulfilled'
): HealthStatusResult {
  if (!record.boosterDate) {
    return { urgency: 'upToDate', label: upToDateLabel, color: 'success' };
  }

  const sorted = [...allRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isLatest = sorted.length > 0 && sorted[0].id === record.id;
  const hasSubsequent = allRecords.some(
    (other) => other.id !== record.id && new Date(other.date).getTime() >= new Date(record.date).getTime()
  );

  if (!isLatest || hasSubsequent) {
    return { urgency: 'fulfilled', label: fulfilledLabel, color: 'default' };
  }

  const due = new Date(record.boosterDate);
  const now = new Date();
  const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) {
    return { urgency: 'overdue', label: 'Overdue', color: 'danger' };
  } else if (daysUntilDue <= 14) {
    return { urgency: 'soon', label: 'Due Soon', color: 'warning' };
  }
  return { urgency: 'upToDate', label: upToDateLabel, color: 'success' };
}

/**
 * Calculates the next deworming due date following ESCCAP France protocol dataset:
 * - Under 2 months: Every 2 weeks
 * - 2 to 6 months: Monthly (Milbemax / Drontal)
 * - Over 6 months: Quarterly (seasonal)
 */
export function calculateNextDewormingDate(lastDate: string, ageMonths: number): string {
  const date = new Date(lastDate);
  if (ageMonths < 2) {
    date.setDate(date.getDate() + 14); // Every 2 weeks under 2 months
  } else if (ageMonths < 6) {
    date.setMonth(date.getMonth() + 1); // Monthly under 6 months
  } else {
    date.setMonth(date.getMonth() + 3); // Quarterly after 6 months
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Calculates next antiparasitic / deworming due date following JSON protocol dataset:
 * - Credelio Plus / Nexgard Spectra / Simparica Trio: Monthly (all-in-one fleas, ticks & worms)
 * - Bravecto: Every 3 months (12 weeks)
 * - Milbemax / Drontal / Panacur:
 *   - Under 2 months: Every 2 weeks
 *   - 2 to 6 months: Monthly
 *   - Over 6 months: Quarterly (every 3 months)
 */
export function calculateNextAntiparasiticDate(
  lastDate: string,
  productName: string,
  ageMonths: number
): string {
  const date = new Date(lastDate);
  const nameLower = productName.toLowerCase();

  const matched = healthProtocols.antiparasitics.find((p) =>
    nameLower.includes(p.name.toLowerCase()) || nameLower.includes(p.id)
  );

  if (matched) {
    if (matched.intervalMonths) {
      date.setMonth(date.getMonth() + matched.intervalMonths);
      return date.toISOString().slice(0, 10);
    }
    if (matched.frequencyType === 'esccap_age_based') {
      if (ageMonths < 2) {
        date.setDate(date.getDate() + 14);
      } else if (ageMonths < 6) {
        date.setMonth(date.getMonth() + (matched.intervalMonthsPuppy || 1));
      } else {
        date.setMonth(date.getMonth() + (matched.intervalMonthsAdult || 3));
      }
      return date.toISOString().slice(0, 10);
    }
  }

  // Fallback if not matched
  if (ageMonths < 6) {
    date.setMonth(date.getMonth() + 1);
  } else {
    date.setMonth(date.getMonth() + 3);
  }
  return date.toISOString().slice(0, 10);
}
