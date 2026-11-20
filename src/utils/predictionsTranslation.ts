import type { Language } from "../i18n";
import { formatDuration } from "./date";
import { formatGrams } from "./weight";

const NBSP = "\u00a0";

type Translations = { exact: Record<string, string>; patterns: [RegExp, (...groups: string[]) => string][] };

/** The engine's '4h26', '4h' or '45m' (formatMinutesToXhXX) as the app's duration: '4h 26m' / '4 h 26', '4h' / '4 h', '45m' / '45 min'. */
const appDuration = (text: string, lang: Language) => {
  const [, hours = "0", minutes = "0"] = /^(?:(\d+)h)?(\d+)?m?$/.exec(text) ?? [];
  return formatDuration(Number(hours) * 60 + Number(minutes), lang);
};
const frenchDuration = (text: string) => appDuration(text, "fr");

/** The engine's '5.4' hours as the app's duration: '5h 24m' / '5 h 24'. */
const appHours = (text: string, lang: Language) => formatDuration(Number(text) * 60, lang);

// English keeps the engine's words, in sentence case, with the durations and grams the rest of the app shows
const ENGLISH: Translations = {
  exact: {
    "Night mode: Young puppy mid-night potty break": "Night mode: young puppy mid-night potty break",
  },
  patterns: [
    [/Post-meal (potty|poop) break \(~(\d+)m after food\)/, (kind, minutes) => `Post-meal ${kind} break (~${appDuration(`${minutes}m`, "en")} after food)`],
    [/Learned average: ~([0-9hm]+) (bladder|digestive) interval/, (duration, kind) => `Learned average: ~${appDuration(duration, "en")} ${kind} interval`],
    [/Standard (bladder|digestive) interval \(~([0-9hm]+)\)/, (kind, duration) => `Standard ${kind} interval (~${appDuration(duration, "en")})`],
    [/Breakfast \(~(.+?), Meal (\d+) of (\d+)\)/, (time, meal, meals) => `Breakfast (~${time}, meal ${meal} of ${meals})`],
    [/Remaining portion \(spaced ~([0-9.]+)h\)/, (hours) => `Remaining portion (spaced ~${appHours(hours, "en")})`],
    [/Daily goal reached \((\d+)g\)/, (grams) => `Daily goal reached (${formatGrams(Number(grams), "en")})`],
  ],
};

const FRENCH: Translations = {
  exact: {
    "No pee recorded yet": "Aucun pipi enregistré pour l'instant",
    "No poop recorded yet": "Aucun caca enregistré pour l'instant",
    "Night mode: Young puppy mid-night potty break": `Mode nuit${NBSP}: pause propreté nocturne`,
  },
  patterns: [
    [/Morning outing \(~(.+?)\)/, (time) => `Sortie du matin (~${time})`],
    [/First pee of the day \(~(.+?)\)/, (time) => `Premier pipi du jour (~${time})`],
    [/First poop of the day \(~(.+?)\)/, (time) => `Premier caca du jour (~${time})`],
    [/Post-meal (?:potty|poop) break \(~(\d+)m after food\)/, (minutes) => `Sortie post-repas (~${frenchDuration(`${minutes}m`)} après le repas)`],
    [/Learned average: ~([0-9hm]+) (?:bladder|digestive) interval/, (duration) => `Moyenne apprise${NBSP}: intervalle d'env. ${frenchDuration(duration)}`],
    [/Standard (?:bladder|digestive) interval \(~([0-9hm]+)\)/, (duration) => `Intervalle standard (~${frenchDuration(duration)})`],
    [/^Digestive alert:.*/, () => `Alerte digestion${NBSP}: sorties fréquentes conseillées`],
    [/^Digestive recovery:.*/, () => `Récupération${NBSP}: pause après selle dure`],
    [/Breakfast \(~(.+?), Meal (\d+) of (\d+)\)/, (time, meal, meals) => `Petit-déjeuner (~${time}, repas ${meal} sur ${meals})`],
    [/Meal (\d+) of (\d+) \(~(.+?)\)/, (meal, meals, time) => `Repas ${meal} sur ${meals} (~${time})`],
    [/Remaining portion \(spaced ~([0-9.]+)h\)/, (hours) => `Portion restante (espacée de ~${appHours(hours, "fr")})`],
    [/Daily goal reached \((\d+)g\)/, (grams) => `Objectif du jour atteint (${formatGrams(Number(grams), "fr")})`],
    [/Daily goal reached \((\d+) meals?\)/, (meals) => `Objectif du jour atteint (${meals} repas)`],
  ],
};

/**
 * The engine's reason in the app's language and formats. The engine writes '~4h26', '~20m', '~5.4h' and '240g';
 * English reads '4h 26m', '20m', '5h 24m' and '240 g', French '4 h 26', '20 min', '5 h 24' and '240 g'.
 */
export function translatePredictionReason(reason: string, lang: Language): string {
  if (!reason) return reason;
  const { exact, patterns } = lang === "fr" ? FRENCH : ENGLISH;
  if (exact[reason]) return exact[reason];
  for (const [pattern, translate] of patterns) {
    if (pattern.test(reason)) return reason.replace(pattern, (_match, ...groups: string[]) => translate(...groups));
  }
  return reason;
}
