import { describe, it, expect } from 'vitest';
import { fr } from '../fr';
import protocols from '../../data/healthProtocols.json';

// App review 2026-10-16, 5.8: French punctuation. A no-break space (U+00A0 or the narrow U+202F) before : ; ! ?,
// « » quotes with no-break spaces inside, "…" rather than "...", and no straight or curly English double quote.
// Owner decision D12: units keep a no-break space after their number ('24 h', '{grams} g/j') and the app says tu, never vous.
// Not checked here: sentence case (proper nouns would need an allow-list).

type Dictionary = { [key: string]: string | Dictionary };
const entries = (dictionary: Dictionary, path = ''): [string, string][] =>
  Object.entries(dictionary).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${path}${key}`, value] as [string, string]] : entries(value, `${path}${key}.`)
  );

const NO_BREAK = /[  ]/;

/** Every : ; ! ? not preceded by a no-break space, a clock time ("07:30") aside. */
function badPunctuation(text: string): string[] {
  return [...text.matchAll(/[:;!?]/g)]
    .filter((match) => {
      const before = text[match.index - 1] ?? '';
      const after = text[match.index + 1] ?? '';
      if (match[0] === ':' && /\d/.test(before) && /\d/.test(after)) return false;
      return !NO_BREAK.test(before);
    })
    .map((match) => text.slice(Math.max(0, match.index - 12), match.index + 1));
}

/** A number (or a '{placeholder}') and its unit with a plain space: '24 h', '{grams} g/j'. */
const badUnits = (text: string): string[] =>
  [...text.matchAll(/(?:\d|\}) (?:g|kg|h|min|j|sem\.?|mois|ans?|fois)(?!\p{L})/gu)].map((match) => match[0]);

/** Vous, votre, or a verb in the vous form ('Choisissez'). */
const VOUS = /\b(?:vous|votre|vos)\b|\b(?:Cliqu|Sélectionn|Saisiss|Appel|Laiss|Vérifi|Indiqu|Choisiss|Touch|Entr|Ajout|Enregistr|Utilis)ez\b/i;

/** Everything wrong with one French string, empty when it is fine. */
function frenchIssues(text: string): string[] {
  return [
    ...badPunctuation(text),
    ...badUnits(text),
    ...(VOUS.test(text) ? ['vous'] : []),
    ...(/["“”]/.test(text) ? ['English double quote'] : []),
    ...(text.includes('...') ? ['...'] : []),
    ...(text.includes('&') ? ['&'] : []),
    ...(/«(?! )|(?<! )»/.test(text) ? ['« » spacing'] : []),
  ];
}

describe('French typography in fr.ts', () => {
  it.each(entries(fr as unknown as Dictionary))('%s', (_key, text) => {
    expect(frenchIssues(text)).toEqual([]);
  });

  it('the check catches what it should', () => {
    expect(badPunctuation('Dernier pipi :')).toEqual(['ernier pipi :']);
    expect(badPunctuation('Supprimer ?')).toEqual(['Supprimer ?']);
    expect(badPunctuation('Dernier pipi :')).toEqual([]);
    expect(badPunctuation('vers 07:30')).toEqual([]);
    expect(frenchIssues('Repos de 24 h')).toEqual(['4 h']);
    expect(frenchIssues('{grams} g/j')).toEqual(['} g']);
    expect(frenchIssues('Choisissez un chiot')).toEqual(['vous']);
    expect(frenchIssues('Touche “Peser”')).toEqual(['English double quote']);
    expect(frenchIssues('Puces & tiques')).toEqual(['&']);
    expect(frenchIssues('Repos de 24 h, {grams} g/j, 2 jours, 3 ans plus tard, choisis « Peser »')).toEqual([
      '3 ans',
    ]);
  });
});

// The vaccine and antiparasitic lists show these French strings as they are, in both languages
describe('French typography in the vaccine and antiparasitic lists (healthProtocols.json)', () => {
  const shown = [
    ...protocols.vaccines.map((vaccine) => vaccine.fullName),
    ...protocols.antiparasitics.map((product) => product.label),
  ];

  it.each(shown)('%s', (text) => {
    expect(frenchIssues(text)).toEqual([]);
    // '<6m' reads as minutes or metres
    expect(text).not.toMatch(/<\s*\d|\d\s*m\b/);
  });
});
