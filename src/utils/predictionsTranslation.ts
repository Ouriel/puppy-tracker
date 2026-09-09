import type { Language } from "../i18n";

const EXACT_FR: Record<string, string> = {
  "No pee recorded yet": "Aucun pipi enregistré pour l'instant",
  "No poop recorded yet": "Aucun caca enregistré pour l'instant",
  "No food logged yet today": "Aucun repas enregistré aujourd'hui",
  "Night mode: Young puppy mid-night potty break": "Mode nuit : Pause propreté nocturne",
};

const PATTERNS_FR: [RegExp, string][] = [
  [/Morning outing \(~(.+?)\)/, "Sortie du matin (~$1)"],
  [/Post-meal (?:potty|poop) break \(~(\d+)m after food\)/, "Sortie post-repas (~$1m après repas)"],
  [/Learned average: ~([0-9h]+(?:[0-9m]+)?) (?:bladder|digestive) interval/, "Moyenne apprise : intervalle d'env. ~$1"],
  [/Standard (?:bladder|digestive) interval \(~(.+?)\)/, "Intervalle standard (~$1)"],
  [/^Digestive alert:.*/, "Alerte digestion : sorties fréquentes conseillées"],
  [/^Digestive recovery:.*/, "Récupération : pause après selle dure"],
  [/Breakfast \(~(.+?), Meal (\d+) of (\d+)\)/, "Petit-déjeuner (~$1, Repas $2 sur $3)"],
  [/Meal (\d+) of (\d+) \(spaced ~([0-9.]+)h\)/, "Repas $1 sur $2 (espacés de ~$3h)"],
  [/Remaining portion \(spaced ~([0-9.]+)h\)/, "Portion restante (espacée de ~$1h)"],
  [/Daily goal reached \((\d+g)\)/, "Objectif du jour atteint ($1)"],
];

/**
 * Translates predictive engine reason strings dynamically based on user active language.
 */
export function translatePredictionReason(reason: string, lang: Language): string {
  if (!reason || lang === "en") return reason;
  if (EXACT_FR[reason]) return EXACT_FR[reason];
  for (const [pattern, replacement] of PATTERNS_FR) {
    if (pattern.test(reason)) return reason.replace(pattern, replacement);
  }
  return reason;
}

