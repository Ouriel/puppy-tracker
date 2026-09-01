import type { Language } from '../i18n';
import { BREED_CATALOG, findBreed } from '../data/breedsCatalog';

export const DOG_BREEDS = BREED_CATALOG.map((b) => b.nameEn);

/**
 * Formats breed name according to active language using the veterinary catalog.
 * Falls back cleanly to legacy slash splitting or raw string if not recognized.
 */
export function formatBreedName(rawBreed: string, lang: Language): string {
  if (!rawBreed) return '';

  const match = findBreed(rawBreed);
  if (match) {
    return lang === 'fr' ? match.nameFr : match.nameEn;
  }

  // Legacy fallback if rawBreed had 'English / French' format
  if (rawBreed.includes(' / ')) {
    const parts = rawBreed.split(' / ');
    return lang === 'fr' ? parts[1].trim() : parts[0].trim();
  }

  return rawBreed;
}
