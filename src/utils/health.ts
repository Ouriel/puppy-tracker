import healthProtocols from '../data/healthProtocols.json';
import type { Activity, HealthRecord } from '../types';
import { getPuppyAge } from './predictions';
import { formatLocalDate } from './date';

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

/** The same day N months later on the calendar (UTC dates, no clock change), capped at the month's last day: 31 Jan + 1 month = 28 Feb. */
function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDayOfTargetMonth))).toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const PUPPY_SERIES_VACCINES = ['chppi_l4', 'chppi_sans_l4', 'vanguard_cpv'];

/**
 * Suggested booster date, from the dog's age on the injection day (owner decision 2026-10-14, French practice):
 * - CHPPi family: a puppy dose before 16 weeks -> +1 month; the dose at 16 weeks or later -> the 1st birthday;
 *   from the 1st birthday, CHPPi + L4 yearly (L4 drives it), viral-only (CHPPi sans L4, Vanguard CPV) every 3 years from 16 months.
 * - Other vaccines: their `defaultBoosterMonths` (12 when unknown).
 * With no birth date, a CHPPi-family dose gets +12 months.
 */
export function calculateNextVaccineBooster(injectionDate: string, vaccineType: string, birthDate?: string): string {
  const matched = findVaccineProtocol(vaccineType);
  if (!matched || !PUPPY_SERIES_VACCINES.includes(matched.id)) return addMonths(injectionDate, matched?.defaultBoosterMonths ?? 12);

  const ageOnInjectionDay = birthDate ? getPuppyAge(birthDate, injectionDate) : undefined;
  if (ageOnInjectionDay && ageOnInjectionDay.weeks < 16) return addMonths(injectionDate, 1);
  const firstBirthday = birthDate ? addMonths(birthDate, 12) : undefined;
  if (firstBirthday && injectionDate.slice(0, 10) < firstBirthday) return firstBirthday;

  const isViralOnly = matched.id !== 'chppi_l4';
  return addMonths(injectionDate, isViralOnly && (ageOnInjectionDay?.months ?? 0) >= 16 ? 36 : 12);
}

export type HealthRecordDateError = 'dateRequired' | 'dateInFuture' | 'boosterBeforeDate';

/** The first date rule a vaccine or deworming form breaks: a date, not after today, and a next date (optional) not before it. */
export function getHealthRecordDateError(date: string, boosterDate: string, today: string = formatLocalDate()): HealthRecordDateError | null {
  if (!date) return 'dateRequired';
  if (date > today) return 'dateInFuture';
  if (boosterDate && boosterDate < date) return 'boosterBeforeDate';
  return null;
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

/** Next age-based deworming (Milbemax), from the dog's age on the dose day: see calculateNextAntiparasiticDate. */
export function calculateNextDewormingDate(lastDate: string, birthDate?: string): string {
  return calculateNextAntiparasiticDate(lastDate, 'milbemax', birthDate);
}

/**
 * Suggested next antiparasitic date, from the JSON protocol dataset:
 * - Products with an `intervalMonths` (Credelio Plus, Nexgard Spectra, Simparica Trio monthly; Bravecto every 3 months): that interval.
 * - Age-based wormers (Milbemax / Drontal / Panacur...), from the dog's age on the dose day (ESCCAP, as the app's guide says):
 *   every 2 weeks until 12 weeks, monthly until 6 months, then every 3 months.
 * - Unknown product: monthly until 6 months, then every 3 months. With no birth date, the puppy interval.
 */
export function calculateNextAntiparasiticDate(lastDate: string, productName: string, birthDate?: string): string {
  const nameLower = productName.toLowerCase();
  const matched = healthProtocols.antiparasitics.find((protocol) =>
    nameLower.includes(protocol.name.toLowerCase()) || nameLower.includes(protocol.id)
  );
  if (matched?.intervalMonths) return addMonths(lastDate, matched.intervalMonths);

  const ageOnDoseDay = birthDate ? getPuppyAge(birthDate, lastDate) : undefined;
  if (matched?.frequencyType === 'esccap_age_based' && ageOnDoseDay && ageOnDoseDay.weeks < 12) return addDays(lastDate, 14);
  if ((ageOnDoseDay?.months ?? 0) < 6) return addMonths(lastDate, matched?.intervalMonthsPuppy ?? 1);
  return addMonths(lastDate, matched?.intervalMonthsAdult ?? 3);
}
