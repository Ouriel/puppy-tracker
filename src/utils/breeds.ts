import type { Language } from '../i18n';

/**
 * Formats bilingual breed strings using PupPace i18n system
 */
export function formatBreedName(rawBreed: string, lang: Language): string {
  if (!rawBreed) return '';

  const lower = rawBreed.toLowerCase();

  if (lower.includes('cocker anglais') || lower.includes('english cocker')) {
    return lang === 'fr' ? 'Cocker Anglais' : 'English Cocker Spaniel';
  }
  if (lower.includes('cocker américain') || lower.includes('american cocker')) {
    return lang === 'fr' ? 'Cocker Américain' : 'American Cocker Spaniel';
  }
  if (lower.includes('bouledogue') || lower.includes('french bulldog')) {
    return lang === 'fr' ? 'Bouledogue Français' : 'French Bulldog';
  }
  if (lower.includes('berger australien') || lower.includes('australian shepherd')) {
    return lang === 'fr' ? 'Berger Australien' : 'Australian Shepherd';
  }
  if (lower.includes('berger allemand') || lower.includes('german shepherd')) {
    return lang === 'fr' ? 'Berger Allemand' : 'German Shepherd';
  }
  if (lower.includes('teckel') || lower.includes('dachshund')) {
    return lang === 'fr' ? 'Teckel' : 'Dachshund';
  }
  if (lower.includes('caniche') || lower.includes('poodle')) {
    return lang === 'fr' ? 'Caniche' : 'Poodle';
  }
  if (lower.includes('bâtard') || lower.includes('mixed breed')) {
    return lang === 'fr' ? 'Bâtard / Croisé' : 'Mixed Breed';
  }
  if (lower.includes('inconnu') || lower.includes('unknown')) {
    return lang === 'fr' ? 'Race Inconnue' : 'Unknown Breed';
  }

  if (rawBreed.includes(' / ')) {
    const parts = rawBreed.split(' / ');
    return lang === 'fr' ? parts[1].trim() : parts[0].trim();
  }

  return rawBreed;
}
