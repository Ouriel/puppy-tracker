import { describe, it, expect } from 'vitest';
import { getPuppyAge, calculateLearnedIntervalMinutes, calculatePredictions, calculateVetFoodGramGoal } from '../predictions';
import type { Activity, PuppyProfile } from '../../types';

describe('predictions utility', () => {
  const mockProfile: PuppyProfile = {
    id: 'pup-1',
    name: 'Charlie',
    breed: 'Cocker Spaniel',
    birthDate: '2026-04-01',
    weightKg: 6.5,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 200,
  };

  it('calculates puppy age in weeks/months correctly', () => {
    const ageInfo = getPuppyAge(mockProfile.birthDate);
    expect(ageInfo.weeks).toBeGreaterThan(0);
    expect(ageInfo.text).toContain('old');
  });

  it('calculates adaptive learned interval from past logs', () => {
    const now = Date.now();
    const activities: Activity[] = [
      { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(now - 180 * 60 * 1000).toISOString(), loggedBy: 'Matthieu' },
      { id: '2', puppyId: 'pup-1', type: 'pee', timestamp: new Date(now - 90 * 60 * 1000).toISOString(), loggedBy: 'Matthieu' },
      { id: '3', puppyId: 'pup-1', type: 'pee', timestamp: new Date(now - 10 * 60 * 1000).toISOString(), loggedBy: 'Matthieu' },
    ];

    const result = calculateLearnedIntervalMinutes(activities, 'pee', 120);
    expect(result.isLearned).toBe(true);
    expect(result.sampleCount).toBe(2);
    expect(result.intervalMins).toBeGreaterThan(0);
  });

  it('predicts next post-meal potty time when food is logged', () => {
    const now = Date.now();
    const activities: Activity[] = [
      { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(now - 60 * 60 * 1000).toISOString(), loggedBy: 'Matthieu' },
      { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(now - 10 * 60 * 1000).toISOString(), loggedBy: 'Matthieu' },
    ];

    const predictions = calculatePredictions(activities, mockProfile);
    expect(predictions.peeReason).toContain('Pup fed recently');
    expect(predictions.nextPeeExpectedAt).not.toBeNull();
  });

  it('correctly predicts morning breakfast without overnight overdue bug', () => {
    const todayMorning = new Date();
    todayMorning.setHours(7, 30, 0, 0);

    const yesterdayDinner = new Date(todayMorning);
    yesterdayDinner.setDate(yesterdayDinner.getDate() - 1);
    yesterdayDinner.setHours(20, 0, 0, 0);

    const activities: Activity[] = [
      { id: '1', puppyId: 'pup-1', type: 'food', timestamp: yesterdayDinner.toISOString(), loggedBy: 'Matthieu' },
    ];

    const predictions = calculatePredictions(activities, mockProfile, todayMorning);
    expect(predictions.foodUrgency).not.toBe('overdue');
    expect(predictions.nextFoodExpectedAt).not.toBeNull();
  });

  it('triggers overdue status when post-meal potty break is not yet fulfilled', () => {
    const now = new Date();

    // Food logged 40 minutes ago, no pee logged since
    const activities: Activity[] = [
      { id: '1', puppyId: 'pup-1', type: 'pee', timestamp: new Date(now.getTime() - 120 * 60 * 1000).toISOString(), loggedBy: 'Matthieu' },
      { id: '2', puppyId: 'pup-1', type: 'food', timestamp: new Date(now.getTime() - 40 * 60 * 1000).toISOString(), loggedBy: 'Matthieu' },
    ];

    const predictions = calculatePredictions(activities, mockProfile, now);
    expect(predictions.peeUrgency).toBe('overdue');
    expect(predictions.peeReason).toContain('overdue');
  });

  it('calculates veterinary food gram goal correctly based on RER and MER', () => {
    const goal = calculateVetFoodGramGoal(6.5, 3);
    expect(goal).toBeGreaterThan(150);
    expect(goal).toBeLessThan(350);
  });

  it('does not trigger night mode during daytime hours (e.g. 16:12 PM) even if last poop was logged late yesterday', () => {
    const afternoon = new Date(2026, 7, 9, 16, 12); // 16:12 PM
    const activities: Activity[] = [
      { id: '1', puppyId: 'pup-1', type: 'poop', timestamp: new Date(2026, 7, 8, 21, 11).toISOString(), loggedBy: 'Matthieu' },
    ];
    const predictions = calculatePredictions(activities, mockProfile, afternoon);
    expect(predictions.poopMode).not.toBe('night_sleep');
    expect(predictions.poopReason).not.toContain('Night mode');
    expect(predictions.poopUrgency).toBe('overdue');
  });
});
