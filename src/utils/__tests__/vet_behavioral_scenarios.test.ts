import { describe, it, expect } from 'vitest';
import {
  calculatePredictions,
  calculateLearnedIntervalMinutes,
} from '../predictions';
import type { Activity, PuppyProfile } from '../../types';

describe('Veterinary & Behavioral Scenario Test Suite (Classic Rules)', () => {
  const profile: PuppyProfile = {
    id: 'pup-balma-vet',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27',
    weightKg: 8.4,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  it('1. Gastrocolic Post-Meal Pee Trigger: Potty urge expected ~20m post-meal (age 4.5m)', () => {
    const lastPee = new Date('2026-08-10T11:00:00Z');
    const mealTime = new Date('2026-08-10T12:00:00Z');
    const refTime = new Date('2026-08-10T12:05:00Z');

    const activities: Activity[] = [
      { id: '1', puppyId: profile.id, type: 'pee', timestamp: lastPee.toISOString(), loggedBy: 'Matthieu' },
      { id: '2', puppyId: profile.id, type: 'food', timestamp: mealTime.toISOString(), quantityGrams: 80, loggedBy: 'Matthieu' },
    ];

    const pred = calculatePredictions(activities, profile, refTime, 'UTC');

    expect(pred.peeMode).toBe('post_meal_override');
    const expectedMinutes = (pred.nextPeeExpectedAt!.getTime() - mealTime.getTime()) / 60000;
    expect(expectedMinutes).toBe(20);
  });

  it('2. Double-Void Walk: Walk pees (<45m gap) do NOT pollute learned daytime retention', () => {
    const activities: Activity[] = [];
    const base = new Date('2026-08-10T08:00:00Z');

    for (let day = 10; day >= 0; day--) {
      const d1 = new Date(base.getTime() - day * 86400000);
      const d2 = new Date(d1.getTime() + 14 * 60000); // 14 mins later (walk double-void)
      const d3 = new Date(d1.getTime() + 210 * 60000); // 3.5 hours later

      activities.push({ id: `p1-${day}`, puppyId: profile.id, type: 'pee', timestamp: d1.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `p2-${day}`, puppyId: profile.id, type: 'pee', timestamp: d2.toISOString(), loggedBy: 'Matthieu' });
      activities.push({ id: `p3-${day}`, puppyId: profile.id, type: 'pee', timestamp: d3.toISOString(), loggedBy: 'Matthieu' });
    }

    const learned = calculateLearnedIntervalMinutes(activities, 'pee', 180, { bedtimeHour: 23, wakeupHour: 7 }, 'UTC');

    // The 14-minute walk double-void pees (<45m) are excluded by minThresholdMins, learning the 196m interval (08:14 to 11:30)
    expect(learned.intervalMins).toBe(196);
  });

  it('3. Diarrhea Emergency Spikes: Frequent 60m check-in window and GI upset alert', () => {
    const lastPoopTime = new Date('2026-08-10T10:00:00Z');

    // Within first hour: window should be at 60m mark
    const earlyRef = new Date('2026-08-10T10:30:00Z');
    const activities: Activity[] = [
      {
        id: 'diarrhea-1',
        puppyId: profile.id,
        type: 'poop',
        timestamp: lastPoopTime.toISOString(),
        stoolConsistency: 'diarrhea',
        notes: 'diarrhea episode',
        loggedBy: 'Matthieu',
      },
    ];

    const earlyPred = calculatePredictions(activities, profile, earlyRef, 'UTC');
    expect(earlyPred.poopReason).toContain('Digestive alert');
    const earlyMinutes = (earlyPred.nextPoopExpectedAt!.getTime() - lastPoopTime.getTime()) / 60000;
    expect(earlyMinutes).toBe(60);

    // After first hour: sliding window advances to next hourly boundary
    const lateRef = new Date('2026-08-10T11:15:00Z');
    const latePred = calculatePredictions(activities, profile, lateRef, 'UTC');
    expect(latePred.poopReason).toContain('Digestive alert');
    const lateMinutes = (latePred.nextPoopExpectedAt!.getTime() - lastPoopTime.getTime()) / 60000;
    expect(lateMinutes).toBe(120);
  });

  it('4. Constipation Refractory Window: Stool recovery keeps poop urgency safe', () => {
    const lastPoopTime = new Date('2026-08-10T10:00:00Z');
    const refTime = new Date('2026-08-10T14:00:00Z');

    const activities: Activity[] = [
      {
        id: 'constipated-1',
        puppyId: profile.id,
        type: 'poop',
        timestamp: lastPoopTime.toISOString(),
        stoolConsistency: 'hard',
        notes: 'hard stool episode',
        loggedBy: 'Matthieu',
      },
    ];

    const pred = calculatePredictions(activities, profile, refTime, 'UTC');

    expect(pred.poopUrgency).toBe('safe');
    expect(pred.poopReason).toContain('hard stool');
  });

  it('5. Night Sleep Boundary: Sleeping overnight postpones potty until morning wakeup', () => {
    const lastPee = new Date('2026-08-10T22:30:00Z');
    const refTime = new Date('2026-08-10T23:30:00Z'); // Night sleep hours

    const activities: Activity[] = [
      { id: '1', puppyId: profile.id, type: 'pee', timestamp: lastPee.toISOString(), loggedBy: 'Matthieu' },
    ];

    const pred = calculatePredictions(activities, profile, refTime, 'UTC');

    expect(pred.peeMode).toBe('night_sleep');
    expect(pred.peeReason).toContain('Morning outing');
  });
});
