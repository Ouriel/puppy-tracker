import type { Language } from "../i18n";

/**
 * Translates predictive engine reason strings dynamically based on user active language.
 */
export function translatePredictionReason(reason: string, lang: Language): string {
  if (!reason || lang === "en") {
    return reason;
  }

  // 1. Pee Learned / Baseline reasons
  if (reason.startsWith("Learned average: ~") && reason.includes("bladder interval")) {
    return reason.replace(
      /Learned average: ~([0-9h]+(?:[0-9m]+)?) bladder interval \(30-day history\)/,
      "Moyenne apprise : intervalle vésical d'env. ~$1 (historique 30j)"
    );
  }

  if (reason.startsWith("Based on ~") && reason.includes("age bladder capacity")) {
    return reason.replace(
      /Based on ~([0-9h]+) age bladder capacity/,
      "Basé sur la capacité vésicale théorique d'env. ~$1 selon l'âge"
    );
  }

  if (reason.includes("Pup fed recently") && reason.includes("Potty break expected")) {
    return reason.replace(
      /Pup fed recently \((.+?) ago\)\. Potty break expected ~(\d+)m post-meal\./,
      "Chiot nourri récemment (il y a $1). Sortie pipi prévue ~$2m après le repas."
    );
  }

  if (reason.startsWith("Bladder emptied before meal")) {
    return reason.replace(
      /Bladder emptied before meal \((.+?) ago\)\. Next break during daytime cycle\./,
      "Vessie vidée avant le repas (il y a $1). Prochaine pause selon le cycle diurne."
    );
  }

  if (reason === "Night mode: Young puppy mid-night potty break") {
    return "Mode nuit : Pause propreté nocturne pour jeune chiot";
  }

  if (reason.startsWith("Night mode: Sleeping until morning wakeup")) {
    return reason.replace(
      /Night mode: Sleeping until morning wakeup \(~(.+?)\)/,
      "Mode nuit : Sommeil jusqu'au réveil matinal (~$1)"
    );
  }

  if (reason === "No pee recorded yet") {
    return "Aucun pipi enregistré pour l'instant";
  }

  // 2. Poop reasons
  if (reason.startsWith("Learned average: ~") && reason.includes("digestive interval")) {
    return reason.replace(
      /Learned average: ~([0-9h]+(?:[0-9m]+)?) digestive interval \(30-day history\)/,
      "Moyenne apprise : intervalle digestif d'env. ~$1 (historique 30j)"
    );
  }

  if (reason.startsWith("Standard digestive interval")) {
    return reason.replace(
      /Standard digestive interval \(~(.+?)\)/,
      "Intervalle digestif standard (~$1)"
    );
  }

  if (reason.includes("Pup fed recently") && reason.includes("Poop break expected")) {
    return reason.replace(
      /Pup fed recently \((.+?) ago\)\. Poop break expected ~(\d+)m post-meal\./,
      "Chiot nourri récemment (il y a $1). Sortie caca prévue ~$2m après le repas."
    );
  }

  if (reason.startsWith("Night mode: Sleeping until morning outing")) {
    return reason.replace(
      /Night mode: Sleeping until morning outing \(~(.+?)\)/,
      "Mode nuit : Sommeil jusqu'à la sortie matinale (~$1)"
    );
  }

  if (reason.startsWith("GI Upset Alert")) {
    return "Alerte digestion : Selle liquide/diarrhée enregistrée. Contrôles fréquents conseillés (fenêtre de 60m).";
  }

  if (reason.startsWith("Digestive system recovering from recent hard stool")) {
    return "Système digestif en récupération après selle dure. Remplissage du côlon après repas.";
  }

  if (reason === "No poop recorded yet") {
    return "Aucun caca enregistré pour l'instant";
  }

  // 3. Food reasons
  if (reason.startsWith("Night mode: Sleeping until morning breakfast")) {
    return reason.replace(
      /Night mode: Sleeping until morning breakfast \(~(.+?)\)/,
      "Mode nuit : Sommeil jusqu'au petit-déjeuner demain matin (~$1)"
    );
  }

  if (reason.startsWith("Today's food goal reached")) {
    return reason.replace(
      /Today's food goal reached \((\d+g) logged\)\. Next: Breakfast tomorrow ~(\d{1,2}:\d{2})/,
      "Objectif alimentaire du jour atteint ($1 enregistrés). Prochain : Petit-déjeuner demain ~$2"
    );
  }

  if (reason.startsWith("Evening mode: Next meal is breakfast tomorrow")) {
    return reason.replace(
      /Evening mode: Next meal is breakfast tomorrow ~(\d{1,2}:\d{2})/,
      "Mode soirée : Prochain repas au petit-déjeuner demain ~$1"
    );
  }

  if (reason.startsWith("Breakfast scheduled at")) {
    return reason.replace(
      /Breakfast scheduled at ~(\d{1,2}:\d{2}) \(Meal 1 of (\d+)\)/,
      "Petit-déjeuner prévu à ~$1 (Repas 1 sur $2)"
    );
  }

  if (reason.startsWith("Morning breakfast due")) {
    return reason.replace(
      /Morning breakfast due \(~(\d{1,2}:\d{2}), Meal 1 of (\d+)\)/,
      "Petit-déjeuner du matin attendu (~$1, Repas 1 sur $2)"
    );
  }

  if (reason.startsWith("Breakfast overdue")) {
    return reason.replace(
      /Breakfast overdue \(expected ~(\d{1,2}:\d{2}), Meal 1 of (\d+)\)/,
      "Petit-déjeuner en retard (attendu à ~$1, Repas 1 sur $2)"
    );
  }

  if (reason.startsWith("Daytime meal schedule:")) {
    return reason.replace(
      /Daytime meal schedule: Meal (\d+) of (\d+) \(spaced ~([0-9.]+)h\)/,
      "Planning des repas : Repas $1 sur $2 (espacés d'env. ~$3h)"
    );
  }

  if (reason === "No food logged yet today") {
    return "Aucun repas enregistré aujourd'hui";
  }

  return reason;
}
