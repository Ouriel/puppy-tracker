import { describe, it, expect } from "vitest";
import { translatePredictionReason } from "../predictionsTranslation";
import { calculatePredictions } from "../predictions";
import type { Activity, PuppyProfile } from "../../types";
import { act, BALMA } from "./fixtures";

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
  });

  it("translates the young-puppy mid-night break into French", () => {
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

  it("passes an unknown reason through unchanged", () => {
    expect(translatePredictionReason("Some future reason (~42m)", "fr")).toBe("Some future reason (~42m)");
  });

  it("has a French translation for every reason template calculatePredictions emits", () => {
    const lunchDay = [7, 12, 19].map((hour) =>
      act("food", `2026-08-07T${String(hour).padStart(2, "0")}:00:00+02:00`, { quantityGrams: 80 })
    );
    const smallMeals = [7, 11, 14].map((hour) =>
      act("food", `2026-08-07T${String(hour).padStart(2, "0")}:00:00+02:00`, { quantityGrams: 40 })
    );
    const olderDog: PuppyProfile = { ...BALMA, birthDate: "2025-10-01" };
    const youngPuppy: PuppyProfile = { ...BALMA, birthDate: "2026-07-01" };
    const scenarios: Array<[Activity[], PuppyProfile, string]> = [
      // No pee / no poop yet, breakfast
      [[], BALMA, "2026-08-07T10:00:00+02:00"],
      // Learned bladder and digestive intervals, next meal of the day
      [
        [
          act("pee", "2026-08-07T07:00:00+02:00"),
          act("pee", "2026-08-07T10:00:00+02:00"),
          act("poop", "2026-08-07T07:10:00+02:00"),
          act("poop", "2026-08-07T12:00:00+02:00"),
          act("food", "2026-08-07T07:30:00+02:00", { quantityGrams: 80 }),
        ],
        BALMA,
        "2026-08-07T12:30:00+02:00",
      ],
      // Post-meal pee and poop breaks
      [[act("pee", "2026-08-07T09:00:00+02:00"), act("poop", "2026-08-07T08:00:00+02:00"), act("food", "2026-08-07T12:00:00+02:00")], BALMA, "2026-08-07T12:10:00+02:00"],
      // Standard bladder and digestive intervals (no post-meal trigger from 5 months)
      [[act("pee", "2026-08-07T10:00:00+02:00"), act("poop", "2026-08-07T08:00:00+02:00")], olderDog, "2026-08-07T11:00:00+02:00"],
      // Night: morning outing
      [[act("pee", "2026-08-06T22:00:00+02:00"), act("poop", "2026-08-06T19:00:00+02:00")], BALMA, "2026-08-07T02:00:00+02:00"],
      // Night: young-puppy mid-night break
      [[act("pee", "2026-08-07T23:00:00+02:00")], youngPuppy, "2026-08-08T00:30:00+02:00"],
      // Digestive alert after diarrhea
      [[act("poop", "2026-08-07T10:00:00+02:00", { stoolConsistency: "diarrhea" })], BALMA, "2026-08-07T10:30:00+02:00"],
      // Digestive recovery after a hard stool
      [[act("poop", "2026-08-07T09:00:00+02:00", { stoolConsistency: "hard" })], BALMA, "2026-08-07T10:00:00+02:00"],
      // 3 meals but under 90% of the gram goal: remaining portion
      [smallMeals, BALMA, "2026-08-07T15:00:00+02:00"],
      // Daily gram goal reached
      [lunchDay, BALMA, "2026-08-07T19:30:00+02:00"],
    ];

    const reasons = new Set<string>();
    for (const [activities, profile, referenceIso] of scenarios) {
      const predictions = calculatePredictions(activities, profile, new Date(referenceIso), "Europe/Paris");
      reasons.add(predictions.peeReason).add(predictions.poopReason).add(predictions.foodReason);
    }

    // Every reason template of predictNextPee, predictNextPoop and predictNextFood is covered
    const templates = new Set([...reasons].map((reason) => reason.replace(/\d+/g, "#")));
    expect([...templates].sort()).toEqual([
      "Breakfast (~#:#, Meal # of #)",
      "Daily goal reached (#g)",
      "Digestive alert: frequent checks recommended",
      "Digestive recovery: pause after hard stool",
      "Learned average: ~#h bladder interval",
      "Learned average: ~#h# digestive interval",
      "Meal # of # (spaced ~#.#h)",
      "Morning outing (~#:#)",
      "Night mode: Young puppy mid-night potty break",
      "No pee recorded yet",
      "No poop recorded yet",
      "Post-meal poop break (~#m after food)",
      "Post-meal potty break (~#m after food)",
      "Remaining portion (spaced ~#.#h)",
      "Standard bladder interval (~#h)",
      "Standard digestive interval (~#h)",
    ]);
    for (const reason of reasons) {
      expect(translatePredictionReason(reason, "fr")).not.toBe(reason);
    }
  });
});
