/**
 * Veterinary Health Protocol Utilities — Vaccine booster and deworming schedule calculations
 */

/**
 * Calculates the next booster due date based on vaccine type.
 * - DHPP: 1-month booster for puppy primers
 * - Leptospirose: 6-month booster
 * - Rage (Rabies): Annual booster
 */
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

/**
 * Calculates the next deworming due date following ESCCAP France protocol:
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
