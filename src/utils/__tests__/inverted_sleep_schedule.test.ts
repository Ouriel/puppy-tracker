import { describe, it, expect } from 'vitest';
import {
  calculatePredictions,
} from '../predictions';
import type { Activity, PuppyProfile } from '../../types';

describe('Inverted Day-Sleep / Night-Active Dog Test Suite', () => {
  const invertedProfile: PuppyProfile = {
    id: 'pup-inverted',
    name: 'Luna',
    breed: 'French Bulldog',
    birthDate: '2026-02-15',
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 200,
  };

  it('Validates predictions for a dog sleeping 10:00 AM - 20:00 PM and active 20:00 PM - 10:00 AM', () => {
    // Manually pass sleep schedule: Bedtime 10:00 AM (10.0), Wakeup 20:00 PM (20.0)
    const customSleepSchedule = { bedtimeHour: 10, wakeupHour: 20, bedtimeStr: '10:00', wakeupStr: '20:00' };

    const lastPee = new Date('2026-08-10T04:00:00Z'); // 04:00 AM (during active night)
    const activities: Activity[] = [
      { id: '1', puppyId: invertedProfile.id, type: 'pee', timestamp: lastPee.toISOString(), loggedBy: 'Matthieu' },
    ];

    // 1. Test during active waking period (02:00 AM)
    const activeNightTime = new Date('2026-08-10T02:00:00Z');
    const activePred = calculatePredictions(activities, invertedProfile, activeNightTime, 'UTC', customSleepSchedule);

    expect(activePred.peeMode).toBe('daytime_baseline');

    // 2. Test during daytime sleep period (14:00 PM = 2:00 PM)
    const sleepDayTime = new Date('2026-08-10T14:00:00Z');
    const sleepPred = calculatePredictions(activities, invertedProfile, sleepDayTime, 'UTC', customSleepSchedule);

    expect(sleepPred.peeMode).toBe('night_sleep');
    expect(sleepPred.peeReason).toContain('Night mode');
  });
});
