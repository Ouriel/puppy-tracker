import { describe, it, expect } from "vitest";
import { translatePredictionReason } from "../predictionsTranslation";
import { calculatePredictions } from "../predictions";
import type { Activity, PuppyProfile } from "../../types";
import { act, PISTACHE } from "./fixtures";

describe("predictionsTranslation utility", () => {
  it("returns original reason string when lang is en", () => {
    const enReason = "Learned average: ~4h26 bladder interval";
    expect(translatePredictionReason(enReason, "en")).toBe(enReason);
  });

  it("translates learned bladder average into French", () => {
    const enReason = "Learned average: ~4h26 bladder interval";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Moyenne apprise\u00a0: intervalle d'env. 4\u00a0h\u00a026"
    );
  });

  it("translates standard bladder interval into French", () => {
    const enReason = "Standard bladder interval (~4h)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Intervalle standard (~4\u00a0h)"
    );
  });

  it("translates post-meal potty break into French", () => {
    const enReason = "Post-meal potty break (~20m after food)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Sortie post-repas (~20\u00a0min après le repas)"
    );
  });

  it("translates learned digestive interval into French", () => {
    const enReason = "Learned average: ~9h59 digestive interval";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Moyenne apprise\u00a0: intervalle d'env. 9\u00a0h\u00a059"
    );
  });

  it("translates morning outing into French", () => {
    expect(translatePredictionReason("Morning outing (~07:37)", "fr")).toBe(
      "Sortie du matin (~07:37)"
    );
  });

  it("translates the young-puppy mid-night break into French", () => {
    expect(translatePredictionReason("Night mode: Young puppy mid-night potty break", "fr")).toBe(
      "Mode nuit\u00a0: pause propreté nocturne"
    );
  });

  it("translates digestive alert and recovery into French", () => {
    expect(translatePredictionReason("Digestive alert: frequent checks recommended", "fr")).toBe(
      "Alerte digestion\u00a0: sorties fréquentes conseillées"
    );
    expect(translatePredictionReason("Digestive recovery: pause after hard stool", "fr")).toBe(
      "Récupération\u00a0: pause après selle dure"
    );
  });

  it("translates breakfast into French", () => {
    const enReason = "Breakfast (~08:15, Meal 1 of 3)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Petit-déjeuner (~08:15, Repas 1 sur 3)"
    );
  });

  it("French durations: '45 min', never '45m' (metres)", () => {
    expect(translatePredictionReason("Learned average: ~45m bladder interval", "fr")).toBe(
      "Moyenne apprise\u00a0: intervalle d'env. 45\u00a0min"
    );
    expect(translatePredictionReason("Standard digestive interval (~11h)", "fr")).toBe("Intervalle standard (~11\u00a0h)");
  });

  // One duration style on the meal card: '~2 h 30', like 'il y a 2 h 30' above it, never '2,5 h'
  it("translates the remaining portion with the app's duration: '~2 h 30'", () => {
    expect(translatePredictionReason("Remaining portion (spaced ~2.5h)", "fr")).toBe("Portion restante (espacée de ~2\u00a0h\u00a030)");
    expect(translatePredictionReason("Remaining portion (spaced ~3.0h)", "fr")).toBe("Portion restante (espacée de ~3\u00a0h)");
  });

  it("translates daytime meal schedule into French", () => {
    const enReason = "Meal 2 of 3 (spaced ~5.4h)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Repas 2 sur 3 (espacés de ~5\u00a0h\u00a024)"
    );
  });

  it("translates food goal reached into French", () => {
    const enReason = "Daily goal reached (240g)";
    expect(translatePredictionReason(enReason, "fr")).toBe(
      "Objectif du jour atteint (240\u00a0g)"
    );
  });

  it.each([
    ["Daily goal reached (1 meal)", "Objectif du jour atteint (1 repas)"],
    ["Daily goal reached (2 meals)", "Objectif du jour atteint (2 repas)"],
  ])("translates %j (no gram goal) into French", (enReason, frReason) => {
    expect(translatePredictionReason(enReason, "fr")).toBe(frReason);
  });

  it("passes an unknown reason through unchanged", () => {
    expect(translatePredictionReason("Some future reason (~42m)", "fr")).toBe("Some future reason (~42m)");
  });

  it("has a French translation for every reason template calculatePredictions emits", () => {
    const lunchDay = [7, 12, 19].map((hour) =>
      act("food", `2026-08-14T${String(hour).padStart(2, "0")}:00:00+02:00`, { quantityGrams: 80 })
    );
    const smallMeals = [7, 11, 14].map((hour) =>
      act("food", `2026-08-14T${String(hour).padStart(2, "0")}:00:00+02:00`, { quantityGrams: 40 })
    );
    const olderDog: PuppyProfile = { ...PISTACHE, birthDate: "2025-10-08" };
    const youngPuppy: PuppyProfile = { ...PISTACHE, birthDate: "2026-07-08" };
    const scenarios: Array<[Activity[], PuppyProfile, string]> = [
      // No pee / no poop yet, breakfast
      [[], PISTACHE, "2026-08-14T10:00:00+02:00"],
      // Learned bladder and digestive intervals, next meal of the day
      [
        [
          act("pee", "2026-08-14T07:00:00+02:00"),
          act("pee", "2026-08-14T10:00:00+02:00"),
          act("poop", "2026-08-14T07:10:00+02:00"),
          act("poop", "2026-08-14T12:00:00+02:00"),
          act("food", "2026-08-14T07:30:00+02:00", { quantityGrams: 80 }),
        ],
        PISTACHE,
        "2026-08-14T12:30:00+02:00",
      ],
      // Post-meal pee and poop breaks
      [[act("pee", "2026-08-14T09:00:00+02:00"), act("poop", "2026-08-14T08:00:00+02:00"), act("food", "2026-08-14T12:00:00+02:00")], PISTACHE, "2026-08-14T12:10:00+02:00"],
      // Standard bladder and digestive intervals (no post-meal trigger from 5 months)
      [[act("pee", "2026-08-14T10:00:00+02:00"), act("poop", "2026-08-14T08:00:00+02:00")], olderDog, "2026-08-14T11:00:00+02:00"],
      // Night: morning outing
      [[act("pee", "2026-08-13T22:00:00+02:00"), act("poop", "2026-08-13T19:00:00+02:00")], PISTACHE, "2026-08-14T02:00:00+02:00"],
      // Night: young-puppy mid-night break
      [[act("pee", "2026-08-14T23:00:00+02:00")], youngPuppy, "2026-08-15T00:30:00+02:00"],
      // Digestive alert after diarrhea
      [[act("poop", "2026-08-14T10:00:00+02:00", { stoolConsistency: "diarrhea" })], PISTACHE, "2026-08-14T10:30:00+02:00"],
      // Digestive recovery after a hard stool
      [[act("poop", "2026-08-14T09:00:00+02:00", { stoolConsistency: "hard" })], PISTACHE, "2026-08-14T10:00:00+02:00"],
      // 3 meals but under 90% of the gram goal: remaining portion
      [smallMeals, PISTACHE, "2026-08-14T15:00:00+02:00"],
      // Daily gram goal reached
      [lunchDay, PISTACHE, "2026-08-14T19:30:00+02:00"],
      // No gram goal: reached once the meals are logged
      [lunchDay, { ...PISTACHE, dailyFoodGramGoal: 0 }, "2026-08-14T19:30:00+02:00"],
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
      "Daily goal reached (# meals)",
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
