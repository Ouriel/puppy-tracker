import type { Language } from "../i18n";

/**
 * Translates predictive engine reason strings dynamically based on user active language.
 */
export function translatePredictionReason(reason: string, lang: Language): string {
  if (!reason || lang === "en") {
    return reason;
  }

  // 1. Morning Outing (Pee & Poop)
  if (reason.startsWith("Morning outing (~")) {
    return reason.replace(/Morning outing \(~(.+?)\)/, "Sortie du matin (~$1)");
  }

  // 2. Post-Meal Breaks
  if (reason.startsWith("Post-meal potty break (~")) {
    return reason.replace(/Post-meal potty break \(~(\d+)m after food\)/, "Sortie post-repas (~$1m après repas)");
  }
  if (reason.startsWith("Post-meal poop break (~")) {
    return reason.replace(/Post-meal poop break \(~(\d+)m after food\)/, "Sortie post-repas (~$1m après repas)");
  }

  // 3. Learned / Baseline Intervals
  if (reason.startsWith("Learned average: ~") && reason.includes("bladder interval")) {
    return reason.replace(
      /Learned average: ~([0-9h]+(?:[0-9m]+)?) bladder interval/,
      "Moyenne apprise : intervalle d'env. ~$1"
    );
  }
  if (reason.startsWith("Learned average: ~") && reason.includes("digestive interval")) {
    return reason.replace(
      /Learned average: ~([0-9h]+(?:[0-9m]+)?) digestive interval/,
      "Moyenne apprise : intervalle d'env. ~$1"
    );
  }
  if (reason.startsWith("Standard bladder interval")) {
    return reason.replace(
      /Standard bladder interval \(~(.+?)\)/,
      "Intervalle standard (~$1)"
    );
  }
  if (reason.startsWith("Standard digestive interval")) {
    return reason.replace(
      /Standard digestive interval \(~(.+?)\)/,
      "Intervalle standard (~$1)"
    );
  }

  // 4. Health Alerts & Recovery
  if (reason.startsWith("Digestive alert:")) {
    return "Alerte digestion : sorties fréquentes conseillées";
  }
  if (reason.startsWith("Digestive recovery:")) {
    return "Récupération : pause après selle dure";
  }

  // 5. Food Reasons
  if (reason.startsWith("Breakfast (~")) {
    return reason.replace(
      /Breakfast \(~(.+?), Meal (\d+) of (\d+)\)/,
      "Petit-déjeuner (~$1, Repas $2 sur $3)"
    );
  }
  if (reason.startsWith("Meal ") && reason.includes("spaced ~")) {
    return reason.replace(
      /Meal (\d+) of (\d+) \(spaced ~([0-9.]+)h\)/,
      "Repas $1 sur $2 (espacés de ~$3h)"
    );
  }
  if (reason.startsWith("Remaining portion (spaced ~")) {
    return reason.replace(
      /Remaining portion \(spaced ~([0-9.]+)h\)/,
      "Portion restante (espacée de ~$1h)"
    );
  }
  if (reason.startsWith("Daily goal reached (")) {
    return reason.replace(
      /Daily goal reached \((\d+g)\)/,
      "Objectif du jour atteint ($1)"
    );
  }

  // 6. Empty states & Edge cases
  if (reason === "No pee recorded yet") return "Aucun pipi enregistré pour l'instant";
  if (reason === "No poop recorded yet") return "Aucun caca enregistré pour l'instant";
  if (reason === "No food logged yet today") return "Aucun repas enregistré aujourd'hui";
  if (reason === "Night mode: Young puppy mid-night potty break") return "Mode nuit : Pause propreté nocturne";

  return reason;
}
