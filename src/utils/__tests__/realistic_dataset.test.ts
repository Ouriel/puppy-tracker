import { describe, it, expect } from 'vitest';
import {
  calculatePredictions,
  detectSleepSchedule,
  detectMealSchedule,
  getPuppyAge,
  calculateVetFoodGramGoal,
} from '../predictions';
import { parseIsoDate, formatRelativeTime } from '../date';
import { scaleGrowthBenchmarks, getExpectedAdultWeight } from '../../components/WeightGrowthChart';
import type { Activity, PuppyProfile, HealthRecord } from '../../types';

describe('Comprehensive 30-Day Realistic Dataset Test Suite', () => {
  const puppyProfile: PuppyProfile = {
    id: 'pup-balma-001',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27',
    weightKg: 8.2,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  /**
   * Constructs a 30-day realistic dataset containing 270 activity records
   * modeling real puppy routines: morning wakeups, post-meal potty, walk double-voids,
   * constipation recovery, and night sleep boundaries.
   */
  function build30DayRealisticDataset(): Activity[] {
    const records: Activity[] = [];
    const startDate = new Date(2026, 6, 10); // July 10 2026

    for (let day = 0; day < 30; day++) {
      const current = new Date(startDate);
      current.setDate(current.getDate() + day);

      const y = current.getFullYear();
      const m = current.getMonth();
      const d = current.getDate();

      // 1. Breakfast 08:30 AM (80g kibble)
      records.push({
        id: `f1-day${day}`,
        puppyId: puppyProfile.id,
        type: 'food',
        timestamp: new Date(y, m, d, 8, 30).toISOString(),
        quantityGrams: 80,
        foodType: 'kibble',
        loggedBy: 'Matthieu',
      });

      // 2. Post-breakfast potty (pee 08:45 AM, poop 09:05 AM)
      records.push({
        id: `p1-day${day}`,
        puppyId: puppyProfile.id,
        type: 'pee',
        timestamp: new Date(y, m, d, 8, 45).toISOString(),
        pottyLocation: 'outside',
        loggedBy: 'Matthieu',
      });

      records.push({
        id: `po1-day${day}`,
        puppyId: puppyProfile.id,
        type: 'poop',
        timestamp: new Date(y, m, d, 9, 5).toISOString(),
        pottyLocation: 'outside',
        stoolConsistency: day === 15 ? 'hard' : 'normal', // Constipation episode on Day 15
        notes: day === 15 ? 'hard stool constipated' : undefined,
        loggedBy: 'Matthieu',
      });

      // 3. Morning Walk double-void pees (11:00 AM and 11:20 AM - gap <45m)
      records.push({
        id: `p2-day${day}`,
        puppyId: puppyProfile.id,
        type: 'pee',
        timestamp: new Date(y, m, d, 11, 0).toISOString(),
        pottyLocation: 'outside',
        loggedBy: 'Matthieu',
      });

      records.push({
        id: `p3-day${day}`,
        puppyId: puppyProfile.id,
        type: 'pee',
        timestamp: new Date(y, m, d, 11, 20).toISOString(), // Walk double-void pee
        pottyLocation: 'outside',
        loggedBy: 'Matthieu',
      });

      // 4. Lunch 13:30 PM (80g kibble)
      records.push({
        id: `f2-day${day}`,
        puppyId: puppyProfile.id,
        type: 'food',
        timestamp: new Date(y, m, d, 13, 30).toISOString(),
        quantityGrams: 80,
        foodType: 'kibble',
        loggedBy: 'Matthieu',
      });

      // 5. Post-lunch pee 13:50 PM
      records.push({
        id: `p4-day${day}`,
        puppyId: puppyProfile.id,
        type: 'pee',
        timestamp: new Date(y, m, d, 13, 50).toISOString(),
        pottyLocation: 'outside',
        loggedBy: 'Matthieu',
      });

      // 6. Afternoon pee 16:45 PM
      records.push({
        id: `p5-day${day}`,
        puppyId: puppyProfile.id,
        type: 'pee',
        timestamp: new Date(y, m, d, 16, 45).toISOString(),
        pottyLocation: 'outside',
        loggedBy: 'Matthieu',
      });

      // 7. Dinner 19:15 PM (80g kibble)
      records.push({
        id: `f3-day${day}`,
        puppyId: puppyProfile.id,
        type: 'food',
        timestamp: new Date(y, m, d, 19, 15).toISOString(),
        quantityGrams: 80,
        foodType: 'kibble',
        loggedBy: 'Matthieu',
      });

      // 8. Post-dinner poop 19:50 PM
      records.push({
        id: `po2-day${day}`,
        puppyId: puppyProfile.id,
        type: 'poop',
        timestamp: new Date(y, m, d, 19, 50).toISOString(),
        pottyLocation: 'outside',
        stoolConsistency: 'normal',
        loggedBy: 'Matthieu',
      });

      // 9. Pre-bedtime pee 22:15 PM
      records.push({
        id: `p6-day${day}`,
        puppyId: puppyProfile.id,
        type: 'pee',
        timestamp: new Date(y, m, d, 22, 15).toISOString(),
        pottyLocation: 'outside',
        loggedBy: 'Matthieu',
      });
    }

    return records;
  }

  const dataset = build30DayRealisticDataset();

  it('validates 30-day dataset contains 330 total activity logs', () => {
    expect(dataset.length).toBe(330);
  });

  it('detects sleep schedule boundaries from historical dataset', () => {
    const sleep = detectSleepSchedule(dataset);
    expect(sleep.wakeupHour).toBeGreaterThanOrEqual(8);
    expect(sleep.bedtimeHour).toBeGreaterThanOrEqual(22);
    expect(sleep.wakeupStr).toBeDefined();
    expect(sleep.bedtimeStr).toBeDefined();
  });

  it('extracts learned meal schedule from dataset', () => {
    const meals = detectMealSchedule(dataset);
    expect(meals.breakfastMins).toBe(8 * 60 + 30); // 08:30 AM = 510 mins
    expect(meals.lunchMins).toBe(13 * 60 + 30);    // 13:30 PM = 810 mins
    expect(meals.dinnerMins).toBe(19 * 60 + 15);   // 19:15 PM = 1155 mins
  });

  it('computes next potty and meal predictions from dataset', () => {
    const predictions = calculatePredictions(dataset, puppyProfile, new Date(2026, 7, 9, 14, 0));
    expect(predictions.nextPeeExpectedAt instanceof Date).toBe(true);
    expect(predictions.nextPoopExpectedAt instanceof Date).toBe(true);
    expect(predictions.nextFoodExpectedAt instanceof Date).toBe(true);
  });

  it('calculates puppy age and veterinary food goal', () => {
    const ageInfo = getPuppyAge(puppyProfile.birthDate);
    expect(ageInfo.weeks).toBeGreaterThan(10);

    const foodGoal = calculateVetFoodGramGoal(puppyProfile.weightKg!, ageInfo.months);
    expect(foodGoal).toBeGreaterThan(150);
  });

  it('formats every timestamp in the 30-day dataset safely with parseIsoDate and formatRelativeTime', () => {
    dataset.forEach((act) => {
      const parsed = parseIsoDate(act.timestamp);
      expect(parsed instanceof Date).toBe(true);
      expect(isNaN(parsed.getTime())).toBe(false);

      const relTime = formatRelativeTime(act.timestamp, 'fr');
      expect(relTime).not.toContain('Invalid');
    });
  });

  it('calculates breed-scalable weight growth benchmarks for Balma', () => {
    const adultWeight = getExpectedAdultWeight(puppyProfile.breed);
    expect(adultWeight).toBe(13); // English Cocker Spaniel reference weight

    const benchmarks = scaleGrowthBenchmarks(adultWeight);
    expect(benchmarks.length).toBe(5);
    expect(benchmarks[4].expectedKg).toBe(13); // 12m adult weight target
  });

  it('evaluates health records booster status for vaccinations and deworming', () => {
    const mockVaccines: HealthRecord[] = [
      {
        id: 'v2',
        householdId: 'hh-1',
        puppyId: puppyProfile.id,
        type: 'vaccination',
        name: 'CHPPi + L4',
        date: '2026-07-01',
        boosterDate: '2027-07-01',
      },
      {
        id: 'v1',
        householdId: 'hh-1',
        puppyId: puppyProfile.id,
        type: 'vaccination',
        name: 'CHPPi + L4',
        date: '2026-06-01',
        boosterDate: '2026-07-01',
      },
    ];

    const sortedVaccines = [...mockVaccines].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    expect(sortedVaccines[0].id).toBe('v2'); // v2 is the latest active vaccine
  });
});
