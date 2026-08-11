import type { Language } from '../i18n';

/**
 * Formats bilingual breed strings (e.g., 'English Cocker Spaniel / Cocker Anglais') into localized breed name
 */
export function formatBreedName(rawBreed: string, lang: Language): string {
  if (!rawBreed) return '';
  if (rawBreed.includes(' / ')) {
    const parts = rawBreed.split(' / ');
    return lang === 'fr' ? parts[1].trim() : parts[0].trim();
  }
  return rawBreed;
}
