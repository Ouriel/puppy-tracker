import type { Language } from "../i18n";
import { formatDuration } from "./date";
import { formatGrams } from "./weight";

const NBSP = "\u00a0";

/** The engine's '4h26', '4h' or '45m' (formatMinutesToXhXX) in French: '4 h 26', '4 h', '45 min'. */
const frenchDuration = (text: string) => {
  const [, hours = "0", minutes = "0"] = /^(?:(\d+)h)?(\d+)?m?$/.exec(text) ?? [];
  return formatDuration(Number(hours) * 60 + Number(minutes), "fr");
};

/** The engine's '5.4' hours as the app's duration: '5 h 24'. */
const frenchHours = (text: string) => formatDuration(Number(text) * 60, "fr");

const EXACT_FR: Record<string, string> = {
  "No pee recorded yet": "Aucun pipi enregistré pour l'instant",
  "No poop recorded yet": "Aucun caca enregistré pour l'instant",
  "Night mode: Young puppy mid-night potty break": `Mode nuit${NBSP}: pause propreté nocturne`,
};

const PATTERNS_FR: [RegExp, (...groups: string[]) => string][] = [
  [/Morning outing \(~(.+?)\)/, (time) => `Sortie du matin (~${time})`],
  [/First pee of the day \(~(.+?)\)/, (time) => `Premier pipi du jour (~${time})`],
  [/First poop of the day \(~(.+?)\)/, (time) => `Premier caca du jour (~${time})`],
  [/Post-meal (?:potty|poop) break \(~(\d+)m after food\)/, (minutes) => `Sortie post-repas (~${frenchDuration(`${minutes}m`)} après le repas)`],
  [/Learned average: ~([0-9hm]+) (?:bladder|digestive) interval/, (duration) => `Moyenne apprise${NBSP}: intervalle d'env. ${frenchDuration(duration)}`],
  [/Standard (?:bladder|digestive) interval \(~([0-9hm]+)\)/, (duration) => `Intervalle standard (~${frenchDuration(duration)})`],
  [/^Digestive alert:.*/, () => `Alerte digestion${NBSP}: sorties fréquentes conseillées`],
  [/^Digestive recovery:.*/, () => `Récupération${NBSP}: pause après selle dure`],
  [/Breakfast \(~(.+?), Meal (\d+) of (\d+)\)/, (time, meal, meals) => `Petit-déjeuner (~${time}, Repas ${meal} sur ${meals})`],
  [/Meal (\d+) of (\d+) \(spaced ~([0-9.]+)h\)/, (meal, meals, hours) => `Repas ${meal} sur ${meals} (espacés de ~${frenchHours(hours)})`],
  [/Remaining portion \(spaced ~([0-9.]+)h\)/, (hours) => `Portion restante (espacée de ~${frenchHours(hours)})`],
  [/Daily goal reached \((\d+)g\)/, (grams) => `Objectif du jour atteint (${formatGrams(Number(grams), "fr")})`],
  [/Daily goal reached \((\d+) meals?\)/, (meals) => `Objectif du jour atteint (${meals} repas)`],
];

/**
 * Translates predictive engine reason strings dynamically based on user active language.
 * The engine writes English ('~4h26', '~20m', '~5.4h'); French reads '4 h 26', '20 min', '5 h 24'.
 */
export function translatePredictionReason(reason: string, lang: Language): string {
  if (!reason || lang === "en") return reason;
  if (EXACT_FR[reason]) return EXACT_FR[reason];
  for (const [pattern, translate] of PATTERNS_FR) {
    if (pattern.test(reason)) return reason.replace(pattern, (_match, ...groups: string[]) => translate(...groups));
  }
  return reason;
}
