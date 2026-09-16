import type { Language } from '../i18n';

export interface BreedEntry {
  id: string;
  nameEn: string;
  nameFr: string;
  femaleWeightKg: number;
  maleWeightKg: number;
  defaultWeightKg?: number;
  aliases: string[];
}

export const BREED_CATALOG: BreedEntry[] = [
  // Sheepdogs & Cattle Dogs
  {
    id: 'australian-shepherd',
    nameEn: 'Australian Shepherd',
    nameFr: 'Berger Australien',
    femaleWeightKg: 22,
    maleWeightKg: 27,
    defaultWeightKg: 25,
    aliases: ['australian shepherd', 'berger australien', 'aussie'],
  },
  {
    id: 'border-collie',
    nameEn: 'Border Collie',
    nameFr: 'Border Collie',
    femaleWeightKg: 17,
    maleWeightKg: 20,
    aliases: ['border collie', 'border'],
  },
  {
    id: 'german-shepherd',
    nameEn: 'German Shepherd',
    nameFr: 'Berger Allemand',
    femaleWeightKg: 30,
    maleWeightKg: 36,
    defaultWeightKg: 32,
    aliases: ['german shepherd', 'berger allemand', 'alsatian'],
  },
  {
    id: 'belgian-malinois',
    nameEn: 'Belgian Shepherd (Malinois)',
    nameFr: 'Berger Belge Malinois',
    femaleWeightKg: 24,
    maleWeightKg: 29,
    aliases: ['malinois', 'berger belge', 'belgian shepherd'],
  },
  {
    id: 'shetland-sheepdog',
    nameEn: 'Shetland Sheepdog',
    nameFr: 'Berger des Shetland',
    femaleWeightKg: 8,
    maleWeightKg: 9.5,
    aliases: ['shetland', 'sheltie', 'berger des shetland'],
  },
  {
    id: 'pembroke-welsh-corgi',
    nameEn: 'Pembroke Welsh Corgi',
    nameFr: 'Welsh Corgi Pembroke',
    femaleWeightKg: 11,
    maleWeightKg: 12.5,
    aliases: ['corgi', 'pembroke', 'welsh corgi'],
  },
  {
    id: 'cardigan-welsh-corgi',
    nameEn: 'Cardigan Welsh Corgi',
    nameFr: 'Welsh Corgi Cardigan',
    femaleWeightKg: 13,
    maleWeightKg: 15,
    aliases: ['cardigan corgi', 'cardigan'],
  },
  {
    id: 'beauceron',
    nameEn: 'Beauceron',
    nameFr: 'Beauceron',
    femaleWeightKg: 34,
    maleWeightKg: 42,
    aliases: ['beauceron', 'bas rouge', 'berger de beauce'],
  },
  {
    id: 'white-swiss-shepherd',
    nameEn: 'White Swiss Shepherd',
    nameFr: 'Berger Blanc Suisse',
    femaleWeightKg: 30,
    maleWeightKg: 37,
    aliases: ['white swiss shepherd', 'berger blanc suisse', 'bbs'],
  },
  {
    id: 'old-english-sheepdog',
    nameEn: 'Old English Sheepdog (Bobtail)',
    nameFr: 'Bobtail (Berger Anglais Ancestral)',
    femaleWeightKg: 30,
    maleWeightKg: 38,
    aliases: ['bobtail', 'old english sheepdog'],
  },

  // Molosser, Mastiff & Mountain Dogs
  {
    id: 'french-bulldog',
    nameEn: 'French Bulldog',
    nameFr: 'Bouledogue Français',
    femaleWeightKg: 11.5,
    maleWeightKg: 13,
    aliases: ['french bulldog', 'bouledogue français', 'bouledogue', 'frenchie'],
  },
  {
    id: 'english-bulldog',
    nameEn: 'English Bulldog',
    nameFr: 'Bouledogue Anglais',
    femaleWeightKg: 20,
    maleWeightKg: 24,
    aliases: ['english bulldog', 'bouledogue anglais', 'bulldog'],
  },
  {
    id: 'cane-corso',
    nameEn: 'Cane Corso',
    nameFr: 'Cane Corso',
    femaleWeightKg: 42,
    maleWeightKg: 48,
    aliases: ['cane corso', 'corso'],
  },
  {
    id: 'rottweiler',
    nameEn: 'Rottweiler',
    nameFr: 'Rottweiler',
    femaleWeightKg: 40,
    maleWeightKg: 50,
    aliases: ['rottweiler', 'rottie'],
  },
  {
    id: 'boxer',
    nameEn: 'Boxer',
    nameFr: 'Boxer',
    femaleWeightKg: 27,
    maleWeightKg: 32,
    aliases: ['boxer'],
  },
  {
    id: 'doberman',
    nameEn: 'Doberman Pinscher',
    nameFr: 'Dobermann',
    femaleWeightKg: 34,
    maleWeightKg: 42,
    aliases: ['doberman', 'dobermann', 'pinscher'],
  },
  {
    id: 'bernese-mountain-dog',
    nameEn: 'Bernese Mountain Dog',
    nameFr: 'Bouvier Bernois',
    femaleWeightKg: 40,
    maleWeightKg: 48,
    aliases: ['bernese', 'bouvier bernois', 'bernois'],
  },
  {
    id: 'great-dane',
    nameEn: 'Great Dane',
    nameFr: 'Dogue Allemand',
    femaleWeightKg: 55,
    maleWeightKg: 70,
    aliases: ['great dane', 'dogue allemand', 'danois'],
  },
  {
    id: 'dogue-de-bordeaux',
    nameEn: 'Dogue de Bordeaux',
    nameFr: 'Dogue de Bordeaux',
    femaleWeightKg: 45,
    maleWeightKg: 52,
    aliases: ['dogue de bordeaux', 'french mastiff'],
  },
  {
    id: 'staffordshire-bull-terrier',
    nameEn: 'Staffordshire Bull Terrier',
    nameFr: 'Staffordshire Bull Terrier',
    femaleWeightKg: 13,
    maleWeightKg: 15.5,
    aliases: ['staffordshire bull terrier', 'staffie', 'staffy'],
  },
  {
    id: 'american-staffordshire-terrier',
    nameEn: 'American Staffordshire Terrier',
    nameFr: 'American Staffordshire Terrier',
    femaleWeightKg: 24,
    maleWeightKg: 29,
    aliases: ['amstaff', 'american staffordshire'],
  },
  {
    id: 'newfoundland',
    nameEn: 'Newfoundland',
    nameFr: 'Terre-Neuve',
    femaleWeightKg: 50,
    maleWeightKg: 65,
    aliases: ['newfoundland', 'terre-neuve', 'terreneuve'],
  },
  {
    id: 'saint-bernard',
    nameEn: 'Saint Bernard',
    nameFr: 'Saint-Bernard',
    femaleWeightKg: 60,
    maleWeightKg: 75,
    aliases: ['saint bernard', 'saint-bernard', 'st bernard'],
  },
  {
    id: 'bullmastiff',
    nameEn: 'Bullmastiff',
    nameFr: 'Bullmastiff',
    femaleWeightKg: 45,
    maleWeightKg: 54,
    aliases: ['bullmastiff'],
  },

  // Terriers
  {
    id: 'jack-russell-terrier',
    nameEn: 'Jack Russell Terrier',
    nameFr: 'Jack Russell Terrier',
    femaleWeightKg: 6,
    maleWeightKg: 7,
    aliases: ['jack russell', 'jack russel', 'jrt'],
  },
  {
    id: 'yorkshire-terrier',
    nameEn: 'Yorkshire Terrier',
    nameFr: 'Yorkshire Terrier',
    femaleWeightKg: 3.1,
    maleWeightKg: 3.2,
    aliases: ['yorkshire', 'yorkie'],
  },
  {
    id: 'west-highland-white-terrier',
    nameEn: 'West Highland White Terrier',
    nameFr: 'Westie',
    femaleWeightKg: 7,
    maleWeightKg: 8.5,
    aliases: ['westie', 'west highland'],
  },
  {
    id: 'fox-terrier',
    nameEn: 'Fox Terrier',
    nameFr: 'Fox Terrier',
    femaleWeightKg: 7.5,
    maleWeightKg: 8.5,
    aliases: ['fox terrier'],
  },
  {
    id: 'cairn-terrier',
    nameEn: 'Cairn Terrier',
    nameFr: 'Cairn Terrier',
    femaleWeightKg: 6,
    maleWeightKg: 7.5,
    aliases: ['cairn terrier', 'cairn'],
  },
  {
    id: 'airedale-terrier',
    nameEn: 'Airedale Terrier',
    nameFr: 'Airedale Terrier',
    femaleWeightKg: 20,
    maleWeightKg: 26,
    aliases: ['airedale'],
  },
  {
    id: 'scottish-terrier',
    nameEn: 'Scottish Terrier',
    nameFr: 'Terrier Écossais',
    femaleWeightKg: 8.5,
    maleWeightKg: 9.5,
    aliases: ['scottish terrier', 'scottie', 'terrier ecossais'],
  },
  {
    id: 'bull-terrier',
    nameEn: 'Bull Terrier',
    nameFr: 'Bull Terrier',
    femaleWeightKg: 24,
    maleWeightKg: 29,
    aliases: ['bull terrier'],
  },

  // Dachshunds
  {
    id: 'standard-dachshund',
    nameEn: 'Standard Dachshund',
    nameFr: 'Teckel Standard',
    femaleWeightKg: 8.5,
    maleWeightKg: 9.5,
    aliases: ['dachshund', 'teckel', 'standard dachshund', 'teckel standard'],
  },
  {
    id: 'miniature-dachshund',
    nameEn: 'Miniature Dachshund',
    nameFr: 'Teckel Nain',
    femaleWeightKg: 4.5,
    maleWeightKg: 5,
    aliases: ['miniature dachshund', 'teckel nain', 'mini dachshund'],
  },
  {
    id: 'kaninchen-dachshund',
    nameEn: 'Rabbit Dachshund (Kaninchen)',
    nameFr: 'Teckel de Chasse au Lapin (Kaninchen)',
    femaleWeightKg: 3.2,
    maleWeightKg: 3.5,
    aliases: ['kaninchen', 'rabbit dachshund'],
  },

  // Spitz & Primitive Types
  {
    id: 'siberian-husky',
    nameEn: 'Siberian Husky',
    nameFr: 'Husky Sibérien',
    femaleWeightKg: 20,
    maleWeightKg: 25,
    aliases: ['siberian husky', 'husky', 'husky sibérien'],
  },
  {
    id: 'samoyed',
    nameEn: 'Samoyed',
    nameFr: 'Samoyède',
    femaleWeightKg: 20,
    maleWeightKg: 26,
    aliases: ['samoyed', 'samoyede'],
  },
  {
    id: 'shiba-inu',
    nameEn: 'Shiba Inu',
    nameFr: 'Shiba Inu',
    femaleWeightKg: 8.5,
    maleWeightKg: 10.5,
    aliases: ['shiba inu', 'shiba'],
  },
  {
    id: 'akita-inu',
    nameEn: 'Akita Inu',
    nameFr: 'Akita Inu',
    femaleWeightKg: 34,
    maleWeightKg: 45,
    aliases: ['akita', 'akita inu', 'american akita'],
  },
  {
    id: 'pomeranian',
    nameEn: 'Pomeranian',
    nameFr: 'Spitz Nain (Poméranien)',
    femaleWeightKg: 2.2,
    maleWeightKg: 2.5,
    aliases: ['pomeranian', 'spitz nain', 'pomeranien', 'loulou de pomeranie'],
  },
  {
    id: 'basenji',
    nameEn: 'Basenji',
    nameFr: 'Basenji',
    femaleWeightKg: 9.5,
    maleWeightKg: 11,
    aliases: ['basenji'],
  },
  {
    id: 'alaskan-malamute',
    nameEn: 'Alaskan Malamute',
    nameFr: 'Malamute de l\'Alaska',
    femaleWeightKg: 34,
    maleWeightKg: 39,
    aliases: ['alaskan malamute', 'malamute'],
  },
  {
    id: 'eurasier',
    nameEn: 'Eurasier',
    nameFr: 'Eurasier',
    femaleWeightKg: 22,
    maleWeightKg: 28,
    aliases: ['eurasier'],
  },

  // Hounds & Scenthounds
  {
    id: 'beagle',
    nameEn: 'Beagle',
    nameFr: 'Beagle',
    femaleWeightKg: 11,
    maleWeightKg: 13.5,
    aliases: ['beagle'],
  },
  {
    id: 'basset-hound',
    nameEn: 'Basset Hound',
    nameFr: 'Basset Hound',
    femaleWeightKg: 24,
    maleWeightKg: 29,
    aliases: ['basset hound', 'basset'],
  },
  {
    id: 'dalmatian',
    nameEn: 'Dalmatian',
    nameFr: 'Dalmatien',
    femaleWeightKg: 24,
    maleWeightKg: 29,
    aliases: ['dalmatian', 'dalmatien'],
  },
  {
    id: 'rhodesian-ridgeback',
    nameEn: 'Rhodesian Ridgeback',
    nameFr: 'Chien de Crête Rhodésien',
    femaleWeightKg: 32,
    maleWeightKg: 38,
    aliases: ['rhodesian ridgeback', 'ridgeback', 'chien de crete'],
  },

  // Pointing Dogs & Setters
  {
    id: 'brittany-spaniel',
    nameEn: 'Brittany Spaniel',
    nameFr: 'Épagneul Breton',
    femaleWeightKg: 15,
    maleWeightKg: 17,
    aliases: ['brittany', 'epagneul breton', 'breton', 'épagneul breton'],
  },
  {
    id: 'english-setter',
    nameEn: 'English Setter',
    nameFr: 'Setter Anglais',
    femaleWeightKg: 24,
    maleWeightKg: 29,
    aliases: ['english setter', 'setter anglais', 'setter'],
  },
  {
    id: 'german-shorthaired-pointer',
    nameEn: 'German Shorthaired Pointer',
    nameFr: 'Braque Allemand',
    femaleWeightKg: 25,
    maleWeightKg: 31,
    aliases: ['german shorthaired pointer', 'braque allemand', 'braque'],
  },
  {
    id: 'weimaraner',
    nameEn: 'Weimaraner',
    nameFr: 'Braque de Weimar',
    femaleWeightKg: 28,
    maleWeightKg: 35,
    aliases: ['weimaraner', 'braque de weimar'],
  },
  {
    id: 'vizsla',
    nameEn: 'Hungarian Vizsla',
    nameFr: 'Braque Hongrois (Vizsla)',
    femaleWeightKg: 20,
    maleWeightKg: 26,
    aliases: ['vizsla', 'braque hongrois'],
  },
  {
    id: 'irish-setter',
    nameEn: 'Irish Setter',
    nameFr: 'Setter Irlandais',
    femaleWeightKg: 25,
    maleWeightKg: 31,
    aliases: ['irish setter', 'setter irlandais'],
  },

  // Retrievers, Flushing Dogs & Water Dogs
  {
    id: 'labrador-retriever',
    nameEn: 'Labrador Retriever',
    nameFr: 'Labrador Retriever',
    femaleWeightKg: 28,
    maleWeightKg: 33,
    aliases: ['labrador', 'labrador retriever', 'lab'],
  },
  {
    id: 'golden-retriever',
    nameEn: 'Golden Retriever',
    nameFr: 'Golden Retriever',
    femaleWeightKg: 28,
    maleWeightKg: 32,
    defaultWeightKg: 30,
    aliases: ['golden retriever', 'golden'],
  },
  {
    id: 'english-cocker-spaniel',
    nameEn: 'English Cocker Spaniel',
    nameFr: 'Cocker Anglais',
    femaleWeightKg: 13,
    maleWeightKg: 14.5,
    defaultWeightKg: 13,
    aliases: ['english cocker spaniel', 'cocker anglais', 'cocker spaniel', 'cocker'],
  },
  {
    id: 'american-cocker-spaniel',
    nameEn: 'American Cocker Spaniel',
    nameFr: 'Cocker Américain',
    femaleWeightKg: 11,
    maleWeightKg: 13,
    aliases: ['american cocker spaniel', 'cocker américain', 'cocker americain'],
  },
  {
    id: 'english-springer-spaniel',
    nameEn: 'English Springer Spaniel',
    nameFr: 'Springer Anglais',
    femaleWeightKg: 18,
    maleWeightKg: 21,
    aliases: ['english springer spaniel', 'springer anglais', 'springer'],
  },
  {
    id: 'flat-coated-retriever',
    nameEn: 'Flat-Coated Retriever',
    nameFr: 'Retriever à Poil Plat',
    femaleWeightKg: 26,
    maleWeightKg: 32,
    aliases: ['flat-coated retriever', 'flat coated', 'retriever a poil plat'],
  },

  // Companion & Toy Dogs
  {
    id: 'cavalier-king-charles',
    nameEn: 'Cavalier King Charles Spaniel',
    nameFr: 'Cavalier King Charles',
    femaleWeightKg: 7,
    maleWeightKg: 8,
    aliases: ['cavalier king charles', 'cavalier', 'ckcs'],
  },
  {
    id: 'chihuahua',
    nameEn: 'Chihuahua',
    nameFr: 'Chihuahua',
    femaleWeightKg: 2.5,
    maleWeightKg: 2.8,
    defaultWeightKg: 3,
    aliases: ['chihuahua'],
  },
  {
    id: 'shih-tzu',
    nameEn: 'Shih Tzu',
    nameFr: 'Shih Tzu',
    femaleWeightKg: 6,
    maleWeightKg: 7.5,
    aliases: ['shih tzu', 'shihtzu'],
  },
  {
    id: 'bichon-frise',
    nameEn: 'Bichon Frisé',
    nameFr: 'Bichon Frisé',
    femaleWeightKg: 4.5,
    maleWeightKg: 5.5,
    aliases: ['bichon frisé', 'bichon frise', 'bichon'],
  },
  {
    id: 'maltese',
    nameEn: 'Maltese',
    nameFr: 'Bichon Maltais',
    femaleWeightKg: 3.5,
    maleWeightKg: 4,
    aliases: ['maltese', 'bichon maltais', 'maltais'],
  },
  {
    id: 'pug',
    nameEn: 'Pug',
    nameFr: 'Carlin',
    femaleWeightKg: 7.5,
    maleWeightKg: 8.5,
    aliases: ['pug', 'carlin'],
  },
  {
    id: 'toy-poodle',
    nameEn: 'Toy Poodle',
    nameFr: 'Caniche Toy',
    femaleWeightKg: 3,
    maleWeightKg: 3.5,
    aliases: ['toy poodle', 'caniche toy'],
  },
  {
    id: 'miniature-poodle',
    nameEn: 'Miniature Poodle',
    nameFr: 'Caniche Nain',
    femaleWeightKg: 6,
    maleWeightKg: 7.5,
    aliases: ['miniature poodle', 'caniche nain'],
  },
  {
    id: 'medium-poodle',
    nameEn: 'Medium Poodle',
    nameFr: 'Caniche Moyen',
    femaleWeightKg: 11,
    maleWeightKg: 13,
    aliases: ['medium poodle', 'caniche moyen', 'caniche', 'poodle'],
  },
  {
    id: 'standard-poodle',
    nameEn: 'Standard Poodle',
    nameFr: 'Grand Caniche (Royal)',
    femaleWeightKg: 22,
    maleWeightKg: 27,
    aliases: ['standard poodle', 'grand caniche', 'caniche royal'],
  },
  {
    id: 'lhasa-apso',
    nameEn: 'Lhasa Apso',
    nameFr: 'Lhassa Apso',
    femaleWeightKg: 6,
    maleWeightKg: 7.5,
    aliases: ['lhasa apso', 'lhassa apso'],
  },
  {
    id: 'havanese',
    nameEn: 'Havanese',
    nameFr: 'Bichon Havanais',
    femaleWeightKg: 4.5,
    maleWeightKg: 6,
    aliases: ['havanese', 'bichon havanais', 'havanais'],
  },
  {
    id: 'papillon',
    nameEn: 'Papillon (Continental Toy Spaniel)',
    nameFr: 'Épagneul Nain Continental (Papillon)',
    femaleWeightKg: 3.5,
    maleWeightKg: 4.2,
    aliases: ['papillon', 'epagneul papillon', 'épagneul papillon'],
  },
  {
    id: 'pekingese',
    nameEn: 'Pekingese',
    nameFr: 'Pékinois',
    femaleWeightKg: 4.5,
    maleWeightKg: 5.2,
    aliases: ['pekingese', 'pekinois', 'pékinois'],
  },

  // Sighthounds
  {
    id: 'whippet',
    nameEn: 'Whippet',
    nameFr: 'Whippet',
    femaleWeightKg: 11,
    maleWeightKg: 13.5,
    aliases: ['whippet'],
  },
  {
    id: 'italian-greyhound',
    nameEn: 'Italian Greyhound',
    nameFr: 'Petit Lévrier Italien',
    femaleWeightKg: 4,
    maleWeightKg: 4.8,
    aliases: ['italian greyhound', 'petit levrier italien', 'pli'],
  },
  {
    id: 'greyhound',
    nameEn: 'Greyhound',
    nameFr: 'Lévrier Greyhound',
    femaleWeightKg: 28,
    maleWeightKg: 34,
    aliases: ['greyhound', 'levrier greyhound'],
  },

  // Mixed & Special
  {
    id: 'mixed-breed',
    nameEn: 'Mixed Breed',
    nameFr: 'Bâtard / Croisé',
    femaleWeightKg: 13,
    maleWeightKg: 15,
    defaultWeightKg: 13,
    aliases: ['mixed breed', 'mixed', 'bâtard', 'croisé', 'batard', 'croise', 'mutt'],
  },
  {
    id: 'unknown',
    nameEn: 'Unknown Breed',
    nameFr: 'Race Inconnue',
    femaleWeightKg: 13,
    maleWeightKg: 15,
    defaultWeightKg: 13,
    aliases: ['unknown', 'inconnu', 'race inconnue', 'unknown breed'],
  },
  {
    id: 'other',
    nameEn: 'Other',
    nameFr: 'Autre',
    femaleWeightKg: 13,
    maleWeightKg: 15,
    defaultWeightKg: 13,
    aliases: ['other', 'autre'],
  },
];

/**
 * Searches the catalog by exact id, English name, French name, or aliases (case-insensitive).
 */
export function findBreed(query: string): BreedEntry | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();

  // 1. Direct match on id, nameEn, nameFr
  const exact = BREED_CATALOG.find(
    (b) => b.id === q || b.nameEn.toLowerCase() === q || b.nameFr.toLowerCase() === q
  );
  if (exact) return exact;

  // 2. Substring match or alias match
  return BREED_CATALOG.find((b) => b.aliases.some((alias) => q.includes(alias) || alias.includes(q)));
}

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

