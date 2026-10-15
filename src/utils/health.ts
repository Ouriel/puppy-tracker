import healthProtocols from '../data/healthProtocols.json';
import type { Activity, HealthRecord } from '../types';

const VET_PRODUCT_NAMES = new Set([...healthProtocols.vaccines, ...healthProtocols.antiparasitics].map((protocol) => protocol.name));

/** A weigh-in entered with a vaccine or deworming: its note is the vaccine or product name. */
export function isVetVisitWeight(activity: Activity): boolean {
  return VET_PRODUCT_NAMES.has(activity.notes ?? '');
}

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
 * Protocol vaccine for a record name: by id, exact alias, name, then partial alias.
 * Partial alias: the longest matching alias wins ('chppi sans l4' is CHPPi sans L4, not the first 'chppi'),
 * and short aliases (r, l4, kc) only match as whole words ('Herpès' is not a rabies shot).
 */
function findVaccineProtocol(vaccineType: string) {
  const typeLower = vaccineType.toLowerCase();
  const matchesPartially = (alias: string) => {
    const aliasLower = alias.toLowerCase();
    if (aliasLower.length < 3) return new RegExp(`(^|[^\\p{L}\\p{N}])${aliasLower}([^\\p{L}\\p{N}]|$)`, 'u').test(typeLower);
    return typeLower.includes(aliasLower) || (typeLower.length >= 3 && aliasLower.includes(typeLower));
  };
  const bestPartialMatch = healthProtocols.vaccines
    .flatMap((vaccine) => (vaccine.aliases ?? []).filter(matchesPartially).map((alias) => ({ vaccine, aliasLength: alias.length })))
    .sort((first, second) => second.aliasLength - first.aliasLength)[0];
  return (
    healthProtocols.vaccines.find((vaccine) => vaccine.id === typeLower) ||
    healthProtocols.vaccines.find((vaccine) => vaccine.aliases && vaccine.aliases.some((alias) => alias.toLowerCase() === typeLower)) ||
    healthProtocols.vaccines.find((vaccine) => vaccine.name.toLowerCase().includes(typeLower)) ||
    bestPartialMatch?.vaccine
  );
}

/**
 * Calculates the next booster due date based on vaccine type dataset.
 */
export function calculateNextVaccineBooster(injectionDate: string, vaccineType: string, ageMonths: number = 6): string {
  const date = new Date(injectionDate);
  const matched = findVaccineProtocol(vaccineType);

  let months = matched ? matched.defaultBoosterMonths : 12;

  // WSAVA / French vet practice:
  // - CHPPi+L4: Annual recall (L4 Leptospirose drives the cadence)
  // - CHPPi sans L4 / Vanguard CPV (viral-only): Triennial (36 months) after the 1-year booster
  if (matched && ['chppi_l4', 'chppi_sans_l4', 'vanguard_cpv'].includes(matched.id)) {
    if ((matched.id === 'chppi_sans_l4' || matched.id === 'vanguard_cpv') && ageMonths >= 16) {
      months = 36; // Triennial for viral-only post-first-booster (CDV/CAV/CPV immunity lasts 3+ years)
    } else if (ageMonths >= 4) {
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

type HealthStatusRecord = Pick<HealthRecord, 'type' | 'name' | 'date' | 'boosterDate'>;

/**
 * What a record renews. `type` only says vaccination or deworming, so a vaccine is identified by its `name`
 * resolved to the protocol vaccine (the same match as its booster date), else the name itself.
 * Any deworming renews a deworming (switching product, e.g. Milbemax to Credelio Plus, is a renewal).
 */
function getRenewalKey(record: HealthStatusRecord): string {
  if (record.type === 'deworming') return 'deworming';
  return findVaccineProtocol(record.name)?.id ?? record.name.trim().toLowerCase();
}

/**
 * Vaccines that also renew narrower ones they contain: CHPPi + L4 holds the CHPPi valences (parvo included)
 * and L4; CHPPi sans L4 holds parvo. To be confirmed by the owner's vet.
 */
const VACCINE_COVERS: Record<string, string[]> = {
  chppi_l4: ['chppi_sans_l4', 'l4', 'vanguard_cpv'],
  chppi_sans_l4: ['vanguard_cpv'],
};

/**
 * Narrower vaccines that also renew a combo because they set its booster date: L4 drives the yearly CHPPi + L4
 * recall (see calculateNextVaccineBooster), so an L4-only booster renews it (adult schedule: combo, then L4 alone).
 */
const VACCINE_RENEWED_BY: Record<string, string[]> = {
  chppi_l4: ['l4'],
};

/**
 * Evaluates health record booster status (fulfilled, overdue, due soon, or up-to-date).
 * Fulfilled only when a later record of the same vaccine, or of one that covers it, exists: a same-day or later
 * record of another vaccine (e.g. Rage given with CHPPi) does not renew it.
 */
export function getHealthRecordStatus(
  record: HealthStatusRecord,
  allRecords: HealthStatusRecord[],
  upToDateLabel: string = 'Up to Date',
  fulfilledLabel: string = 'Fulfilled'
): HealthStatusResult {
  if (!record.boosterDate) {
    return { urgency: 'upToDate', label: upToDateLabel, color: 'success' };
  }

  const renewalKey = getRenewalKey(record);
  const isRenewed = allRecords.some((other) => {
    if (new Date(other.date).getTime() <= new Date(record.date).getTime()) return false;
    const otherKey = getRenewalKey(other);
    return (
      otherKey === renewalKey ||
      (VACCINE_COVERS[otherKey]?.includes(renewalKey) ?? false) ||
      (VACCINE_RENEWED_BY[renewalKey]?.includes(otherKey) ?? false)
    );
  });

  if (isRenewed) {
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
  return calculateNextAntiparasiticDate(lastDate, 'milbemax', ageMonths);
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
