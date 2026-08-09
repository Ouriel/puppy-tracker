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

/**
 * Calculates next antiparasitic / deworming due date following product SPC & ESCCAP France guidelines:
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

  // All-in-one monthly chewable tablets (Fleas + Ticks + Worms)
  if (nameLower.includes('credelio') || nameLower.includes('nexgard') || nameLower.includes('simparica')) {
    date.setMonth(date.getMonth() + 1); // Strictly monthly (30 days)
    return date.toISOString().slice(0, 10);
  }

  // 12-week flea & tick tablet
  if (nameLower.includes('bravecto')) {
    date.setMonth(date.getMonth() + 3); // 12 weeks / 3 months
    return date.toISOString().slice(0, 10);
  }

  // Classic internal wormers (Milbemax, Drontal, Panacur, Dolpac)
  if (ageMonths < 2) {
    date.setDate(date.getDate() + 14);
  } else if (ageMonths < 6) {
    date.setMonth(date.getMonth() + 1);
  } else {
    date.setMonth(date.getMonth() + 3);
  }
  return date.toISOString().slice(0, 10);
}
