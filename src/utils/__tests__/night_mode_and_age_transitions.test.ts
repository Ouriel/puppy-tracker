import { describe, it, expect } from 'vitest';
import { calculatePredictions } from '../predictions';
import type { Activity, PuppyProfile, SleepSchedule } from '../../types';

describe('Night Mode, Evening Outings, and Age Transitions Comprehensive Test Suite', () => {
  const balmaProfile: PuppyProfile = {
    id: 'pup-balma',
    name: 'Balma',
    breed: 'English Cocker Spaniel',
    birthDate: '2026-03-27', // ~5 months old in August 2026
    weightKg: 7.8,
    targetMealsPerDay: 3,
    dailyFoodGramGoal: 240,
  };

  const balmaSleepSchedule: SleepSchedule = {
    bedtimeHour: 22.58, // 22:35 PM
    wakeupHour: 7.56,   // 07:34 AM
    bedtimeStr: '22:35',
    wakeupStr: '07:34',
  };

  // 1. Evening Pre-Bed Walk Preservation
  it('preserves pre-bed walk at 21:15 PM when last pee was at 17:36 PM (does NOT jump to morning)', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T17:36:00+02:00', loggedBy: 'Daria' },
      { id: '2', puppyId: balmaProfile.id, type: 'food', timestamp: '2026-08-23T17:06:00+02:00', quantityGrams: 75, loggedBy: 'Daria' },
    ];

    const refTime = new Date('2026-08-23T21:15:00+02:00'); // 21:15 PM
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    const expDate = pred.nextPeeExpectedAt!;
    expect(expDate.getDate()).toBe(23); // Tonight (August 23)
    const expectedHours = expDate.getHours();
    expect(expectedHours).toBeGreaterThanOrEqual(21);
    expect(expectedHours).toBeLessThanOrEqual(22);
  });

  // 2. Expanding Bladder Interval in Evening
  it('preserves tonight pre-bed walk even when expanding interval lands slightly past bedtime (18:00 + 5h = 23:00)', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T18:00:00+02:00', loggedBy: 'Matthieu' },
    ];

    const refTime = new Date('2026-08-23T22:15:00+02:00'); // 22:15 PM
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    const expDate = pred.nextPeeExpectedAt!;
    expect(expDate.getDate()).toBe(23);
  });

  // 3. Pre-Bed Pee Logged -> Smooth Morning Rollover
  it('rolls over to morning wakeup once the pre-bedtime pee is logged at 22:30 PM', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T17:36:00+02:00', loggedBy: 'Daria' },
      { id: '2', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T22:30:00+02:00', loggedBy: 'Matthieu' },
    ];

    const refTime = new Date('2026-08-23T22:36:00+02:00'); // Right after bedtime walk
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeReason).toContain('Morning outing');
    const expDate = pred.nextPeeExpectedAt!;
    expect(expDate.getDate()).toBe(24); // Next morning (August 24)
    expect(expDate.getHours()).toBe(7);
  });

  // 4. Early Morning Awakening (05:38 AM)
  it('exits night mode immediately when an early morning pee is logged at 05:38 AM', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-21T22:30:00+02:00', loggedBy: 'Matthieu' },
      { id: '2', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-22T05:38:00+02:00', loggedBy: 'Matthieu' },
    ];

    const refTime = new Date('2026-08-22T06:00:00+02:00'); // 06:00 AM
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    const expHours = pred.nextPeeExpectedAt!.getHours();
    expect(expHours).toBeGreaterThanOrEqual(9);
    expect(expHours).toBeLessThanOrEqual(11);
  });

  // 5. Young Puppy Multi-Step Night Pauses
  it('schedules successive mid-night potty breaks for an 8-week-old young puppy overnight', () => {
    const youngProfile: PuppyProfile = {
      ...balmaProfile,
      birthDate: '2026-06-25', // ~6 weeks old on August 8
    };

    const sleepSchedule: SleepSchedule = {
      bedtimeHour: 22.0,
      wakeupHour: 7.0,
      bedtimeStr: '22:00',
      wakeupStr: '07:00',
    };

    // Step 1: At 23:00 PM, last pee was 22:00 PM
    const step1Activities: Activity[] = [
      { id: '1', puppyId: youngProfile.id, type: 'pee', timestamp: '2026-08-08T22:00:00+02:00', loggedBy: 'Matthieu' },
    ];
    const step1Ref = new Date('2026-08-08T23:00:00+02:00');
    const pred1 = calculatePredictions(step1Activities, youngProfile, step1Ref, 'Europe/Paris', sleepSchedule);

    expect(pred1.peeMode).toBe('night_sleep');
    expect(pred1.peeReason).toContain('Young puppy mid-night potty break');
    expect(pred1.nextPeeExpectedAt!.getHours()).toBe(2); // ~02:00 AM

    // Step 2: Logged 02:00 AM mid-night pee, checked at 02:30 AM
    const step2Activities: Activity[] = [
      ...step1Activities,
      { id: '2', puppyId: youngProfile.id, type: 'pee', timestamp: '2026-08-09T02:00:00+02:00', loggedBy: 'Matthieu' },
    ];
    const step2Ref = new Date('2026-08-09T02:30:00+02:00');
    const pred2 = calculatePredictions(step2Activities, youngProfile, step2Ref, 'Europe/Paris', sleepSchedule);

    expect(pred2.peeMode).toBe('night_sleep');
    expect(pred2.peeReason).toContain('Young puppy mid-night potty break');
    expect(pred2.nextPeeExpectedAt!.getHours()).toBe(6); // ~06:00 AM
  });

  // 6. Late Evening Dinner
  it('allows late evening dinner logging at 21:30 PM when daily goal is not yet reached', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'food', timestamp: '2026-08-23T08:13:00+02:00', quantityGrams: 90, loggedBy: 'Daria' },
      { id: '2', puppyId: balmaProfile.id, type: 'food', timestamp: '2026-08-23T17:06:00+02:00', quantityGrams: 75, loggedBy: 'Daria' },
    ];

    const refTime = new Date('2026-08-23T21:30:00+02:00');
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.foodMode).toBe('daytime_schedule');
    expect(pred.portionGrams).toBe(75); // 240 - 165 = 75g remaining
    expect(pred.foodReason).toContain('Meal 3 of 3');
  });
});
