import { describe, it, expect } from "vitest";
import { translatePredictionReason } from "../predictionsTranslation";

describe("predictionsTranslation utility", () => {
  it("returns original reason string when lang is en", () => {
    const enReason = "Learned average: ~4h26 bladder interval (30-day history)";
    expect(translatePredictionReason(enReason, "en")).toBe(enReason);
  });

  it("translates learned bladder average into French", () => {
    const enReason = "Learned average: ~4h26 bladder interval (30-day history)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Moyenne apprise : intervalle vésical d'env. ~4h26 (historique 30j)"
    );
  });

  it("translates age bladder capacity baseline into French", () => {
    const enReason = "Based on ~4h age bladder capacity";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Basé sur la capacité vésicale théorique d'env. ~4h selon l'âge"
    );
  });

  it("translates post-meal pee override into French", () => {
    const enReason = "Pup fed recently (10m ago). Potty break expected ~20m post-meal.";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Chiot nourri récemment (il y a 10m). Sortie pipi prévue ~20m après le repas."
    );
  });

  it("translates bladder emptied before meal into French", () => {
    const enReason = "Bladder emptied before meal (15m ago). Next break during daytime cycle.";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Vessie vidée avant le repas (il y a 15m). Prochaine pause selon le cycle diurne."
    );
  });

  it("translates learned digestive interval into French", () => {
    const enReason = "Learned average: ~9h59 digestive interval (30-day history)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Moyenne apprise : intervalle digestif d'env. ~9h59 (historique 30j)"
    );
  });

  it("translates night sleep modes into French", () => {
    expect(translatePredictionReason("Night mode: Sleeping until morning wakeup (~07:37)", "fr")).toBe(
      "Mode nuit : Sommeil jusqu'au réveil matinal (~07:37)"
    );
    expect(translatePredictionReason("Night mode: Young puppy mid-night potty break", "fr")).toBe(
      "Mode nuit : Pause propreté nocturne pour jeune chiot"
    );
  });

  it("translates GI upset alert into French", () => {
    const enReason = "GI Upset Alert: Liquid/diarrhea stool recorded. Frequent potty checks recommended (60m window).";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Alerte digestion : Selle liquide/diarrhée enregistrée. Contrôles fréquents conseillés (fenêtre de 60m)."
    );
  });

  it("translates daytime meal schedule into French", () => {
    const enReason = "Daytime meal schedule: Meal 2 of 3 (spaced ~5.4h)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Planning des repas : Repas 2 sur 3 (espacés d'env. ~5.4h)"
    );
  });

  it("translates food goal reached into French", () => {
    const enReason = "Today's food goal reached (240g logged). Next: Breakfast tomorrow ~07:00";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Objectif alimentaire du jour atteint (240g enregistrés). Prochain : Petit-déjeuner demain ~07:00"
    );
  });
});
