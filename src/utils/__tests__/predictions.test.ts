import { describe, it, expect } from 'vitest';
import { getPuppyAge, calculateLearnedIntervalMinutes, calculatePredictions } from '../predictions';
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
});
