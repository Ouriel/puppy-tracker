import { describe, it, expect } from "vitest";
import { translatePredictionReason } from "../predictionsTranslation";

describe("predictionsTranslation utility", () => {
  it("returns original reason string when lang is en", () => {
    const enReason = "Learned average: ~4h26 bladder interval";
    expect(translatePredictionReason(enReason, "en")).toBe(enReason);
  });

  it("translates learned bladder average into French", () => {
    const enReason = "Learned average: ~4h26 bladder interval";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Moyenne apprise : intervalle d'env. ~4h26"
    );
  });

  it("translates standard bladder interval into French", () => {
    const enReason = "Standard bladder interval (~4h)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Intervalle standard (~4h)"
    );
  });

  it("translates post-meal potty break into French", () => {
    const enReason = "Post-meal potty break (~20m after food)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Sortie post-repas (~20m après repas)"
    );
  });

  it("translates learned digestive interval into French", () => {
    const enReason = "Learned average: ~9h59 digestive interval";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Moyenne apprise : intervalle d'env. ~9h59"
    );
  });

  it("translates morning outing into French", () => {
    expect(translatePredictionReason("Morning outing (~07:37)", "fr")).toBe(
      "Sortie du matin (~07:37)"
    );
    expect(translatePredictionReason("Night mode: Young puppy mid-night potty break", "fr")).toBe(
      "Mode nuit : Pause propreté nocturne"
    );
  });

  it("translates digestive alert and recovery into French", () => {
    expect(translatePredictionReason("Digestive alert: frequent checks recommended", "fr")).toBe(
      "Alerte digestion : sorties fréquentes conseillées"
    );
    expect(translatePredictionReason("Digestive recovery: pause after hard stool", "fr")).toBe(
      "Récupération : pause après selle dure"
    );
  });

  it("translates breakfast into French", () => {
    const enReason = "Breakfast (~08:15, Meal 1 of 3)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Petit-déjeuner (~08:15, Repas 1 sur 3)"
    );
  });

  it("translates daytime meal schedule into French", () => {
    const enReason = "Meal 2 of 3 (spaced ~5.4h)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Repas 2 sur 3 (espacés de ~5.4h)"
    );
  });

  it("translates food goal reached into French", () => {
    const enReason = "Daily goal reached (240g)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Objectif du jour atteint (240g)"
    );
  });
});
