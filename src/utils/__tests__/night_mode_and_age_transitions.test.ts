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

  // 7. Evening Pre-Bed Pee Preservation past Bedtime (Bug 1)
  it('preserves pre-bed pee at 22:45 PM past bedtime (22:35) when last pee was at 17:36 PM without jumping to morning', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T17:36:00+02:00', loggedBy: 'Daria' },
    ];

    const refTime = new Date('2026-08-23T22:45:00+02:00'); // Past bedtime (22:35)
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    const expDate = pred.nextPeeExpectedAt!;
    expect(expDate.getDate()).toBe(23); // Tonight (August 23), NOT August 24
    expect(pred.peeUrgency).toBe('overdue');
  });

  // 8. Evening Pre-Bed Poop Preservation past Bedtime (Bug 1)
  it('preserves pre-bed poop at 22:45 PM past bedtime (22:35) when last poop was at 12:34 PM without jumping to morning', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-08-23T12:34:00+02:00', loggedBy: 'Daria' },
    ];

    const refTime = new Date('2026-08-23T22:45:00+02:00'); // Past bedtime (22:35)
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.poopMode).toBe('daytime_baseline');
    expect(pred.nextPoopExpectedAt).not.toBeNull();
    const expDate = pred.nextPoopExpectedAt!;
    expect(expDate.getDate()).toBe(23); // Tonight (August 23), NOT August 24
  });

  // 9. Quick action logging smoothly transitions from overdue pre-bed to night sleep (Bug 2)
  it('smoothly transitions to night mode when bedtime poop is logged at 22:48 PM', () => {
    const refTime = new Date('2026-08-23T22:48:15+02:00');
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-08-23T12:34:00+02:00', loggedBy: 'Daria' },
      { id: '2', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-08-23T22:48:15+02:00', loggedBy: 'Matthieu' },
    ];

    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.poopMode).toBe('night_sleep');
    expect(pred.poopUrgency).toBe('safe');
    expect(pred.nextPoopExpectedAt!.getDate()).toBe(24); // Rolled over to morning because 22:48:15 poop was recognized
  });

  // 10. Split Pre-Bed Outing: Pee logged, Poop still pending
  it('decouples pee and poop: pee enters night_sleep while overdue poop remains daytime_baseline', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T22:42:00+02:00', loggedBy: 'Matthieu' }, // Pre-bed pee done
      { id: '2', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-08-23T12:34:00+02:00', loggedBy: 'Daria' },    // Poop pending since noon
    ];

    const refTime = new Date('2026-08-23T22:45:00+02:00');
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('night_sleep');
    expect(pred.peeUrgency).toBe('safe');
    expect(pred.nextPeeExpectedAt!.getDate()).toBe(24); // Morning outing (August 24)

    expect(pred.poopMode).toBe('daytime_baseline');
    expect(pred.nextPoopExpectedAt!.getDate()).toBe(23); // Preserved for tonight (August 23)
  });

  // 11. Midnight-Wrapping Bedtime Schedule (Bedtime 00:30, Wakeup 08:30)
  it('handles midnight-wrapping bedtime schedule (00:30 AM) with pre-bed preservation across midnight', () => {
    const midnightSchedule: SleepSchedule = {
      bedtimeHour: 0.5, // 00:30 AM
      wakeupHour: 8.5,  // 08:30 AM
      bedtimeStr: '00:30',
      wakeupStr: '08:30',
    };

    // Case 1: At 23:45 (before bedtime 00:30), last pee was 18:00 -> preserves tonight
    const acts1: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T18:00:00+02:00', loggedBy: 'Matthieu' },
    ];
    const pred1 = calculatePredictions(acts1, balmaProfile, new Date('2026-08-23T23:45:00+02:00'), 'Europe/Paris', midnightSchedule);
    expect(pred1.peeMode).toBe('daytime_baseline');
    expect(pred1.nextPeeExpectedAt!.getDate()).toBe(23);

    // Case 2: At 00:45 (after bedtime 00:30), last pee was 18:00 (no pre-bed pee in >= 22:30) -> preserves pre-bed
    const pred2 = calculatePredictions(acts1, balmaProfile, new Date('2026-08-24T00:45:00+02:00'), 'Europe/Paris', midnightSchedule);
    expect(pred2.peeMode).toBe('daytime_baseline');
    expect(pred2.peeUrgency).toBe('overdue');

    // Case 3: At 00:45, pre-bed pee was logged at 23:30 (>= 22:30 window) -> enters night_sleep
    const acts3: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T23:30:00+02:00', loggedBy: 'Matthieu' },
    ];
    const pred3 = calculatePredictions(acts3, balmaProfile, new Date('2026-08-24T00:45:00+02:00'), 'Europe/Paris', midnightSchedule);
    expect(pred3.peeMode).toBe('night_sleep');
    expect(pred3.nextPeeExpectedAt!.getHours()).toBe(8); // Morning outing ~08:30
  });

  // 12. Indoor Accident in Pre-Bed Window
  it('recognizes indoor accident in pre-bed window as emptied bladder for overnight sleep', () => {
    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-23T22:20:00+02:00', pottyLocation: 'indoor_accident', loggedBy: 'Matthieu' },
    ];

    const refTime = new Date('2026-08-23T22:45:00+02:00'); // After bedtime (22:35)
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('night_sleep');
    expect(pred.nextPeeExpectedAt!.getDate()).toBe(24);
  });

  // 13. Early Morning Walk Before Usual Wakeup (Balma Sept 1st scenario)
  it('exits night mode and rolls over to daytime baseline when walked early at 07:48 AM before wakeup time 08:38 AM', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.8, // 22:48 PM
      wakeupHour: 8.63,  // 08:38 AM
      bedtimeStr: '22:48',
      wakeupStr: '08:38',
    };

    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-31T21:33:00+02:00', loggedBy: 'Daria' },
      { id: '2', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-01T07:48:04+02:00', loggedBy: 'Matthieu' },
    ];

    // Reference time in app component before 60s interval tick (e.g. 07:48:00)
    const refTime = new Date('2026-09-01T07:48:00+02:00');
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.peeReason).not.toContain('Morning outing');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    // Next pee should be in early afternoon (~12:48 PM), not ~08:38 AM
    expect(pred.nextPeeExpectedAt!.getHours()).toBeGreaterThanOrEqual(11);
    expect(pred.nextPeeExpectedAt!.getHours()).toBeLessThanOrEqual(14);
  });

  // 14. Morning Poop & Breakfast Sequence Anchors to First Morning Pee
  it('anchors morning poop and breakfast sequence to early morning pee when awake', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.8,
      wakeupHour: 8.63, // 08:38 AM
      bedtimeStr: '22:48',
      wakeupStr: '08:38',
    };

    const activities: Activity[] = [
      { id: '0', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-08-31T12:34:00+02:00', loggedBy: 'Daria' },
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-08-31T21:33:00+02:00', loggedBy: 'Daria' },
      { id: '2', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-01T07:48:00+02:00', loggedBy: 'Matthieu' },
    ];

    const refTime = new Date('2026-09-01T07:48:30+02:00');
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', lateWakeSchedule);

    // Poop should anchor around early morning outing (07:48 + ~10m = 07:58), not wait until 08:48
    expect(pred.nextPoopExpectedAt).not.toBeNull();
    expect(pred.nextPoopExpectedAt!.getHours()).toBeLessThan(9);
    expect(pred.nextPoopExpectedAt!.getMinutes()).toBeLessThan(60);
  });

  // 15. Afternoon Poop Prediction Targets Tonight's Evening Walk (No 18h Skip to Morning)
  it('predicts evening/bedtime outing tonight when puppy poops in early afternoon (~13:52) with ~9.5h interval', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-03T08:37:00+02:00', loggedBy: 'Matthieu' },
      { id: '2', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-09-03T08:43:00+02:00', loggedBy: 'Matthieu' },
      { id: '3', puppyId: balmaProfile.id, type: 'food', timestamp: '2026-09-03T09:29:00+02:00', quantityGrams: 100, loggedBy: 'Matthieu' },
      { id: '4', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-03T13:46:00+02:00', loggedBy: 'Matthieu' },
      { id: '5', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-09-03T13:52:00+02:00', loggedBy: 'Matthieu' },
    ];

    // Reference time in afternoon (14:12 PM)
    const refTime = new Date('2026-09-03T14:12:25+02:00');
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.poopMode).toBe('daytime_baseline');
    expect(pred.poopReason).not.toContain('Morning outing');
    expect(pred.nextPoopExpectedAt).not.toBeNull();

    // Next poop must be tonight between 19:00 and 23:59 (e.g. ~19:52 fallback or ~23:32 learned), NOT next morning (~08:44)
    const nextDate = pred.nextPoopExpectedAt!;
    expect(nextDate.getDate()).toBe(3); // Same day (Sept 3)
    expect(nextDate.getHours()).toBeGreaterThanOrEqual(19);
    expect(nextDate.getHours()).toBeLessThanOrEqual(23);
  });

  // 16. Pre-bed Poop Rolls Over to Morning Once Outing Is Logged
  it('transitions poop prediction to morning outing once pre-bed walk is logged at 23:17', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities: Activity[] = [
      { id: '1', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-03T08:37:00+02:00', loggedBy: 'Matthieu' },
      { id: '2', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-09-03T08:43:00+02:00', loggedBy: 'Matthieu' },
      { id: '3', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-03T13:46:00+02:00', loggedBy: 'Matthieu' },
      { id: '4', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-09-03T13:52:00+02:00', loggedBy: 'Matthieu' },
      { id: '5', puppyId: balmaProfile.id, type: 'poop', timestamp: '2026-09-03T23:17:00+02:00', loggedBy: 'Matthieu' },
      { id: '6', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-03T23:18:00+02:00', loggedBy: 'Matthieu' },
    ];

    const refTime = new Date('2026-09-03T23:25:00+02:00');
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.poopMode).toBe('night_sleep');
    expect(pred.poopReason).toContain('Morning outing');
    expect(pred.nextPoopExpectedAt).not.toBeNull();
    expect(pred.nextPoopExpectedAt!.getDate()).toBe(4); // Next day (Sept 4)
    expect(pred.nextPoopExpectedAt!.getHours()).toBe(8);
  });

  // 17. Breakfast Syncs with Meal Schedule
  it('synchronizes big breakfast card target time with calculated mealSchedule.breakfastMins', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81,
      wakeupHour: 8.63, // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    // Historical breakfast at 09:35 AM (>= 3 samples for learned schedule)
    const activities: Activity[] = [
      { id: '0', puppyId: balmaProfile.id, type: 'food', timestamp: '2026-08-31T09:35:00+02:00', quantityGrams: 90, loggedBy: 'Matthieu' },
      { id: '1', puppyId: balmaProfile.id, type: 'food', timestamp: '2026-09-01T09:35:00+02:00', quantityGrams: 90, loggedBy: 'Matthieu' },
      { id: '2', puppyId: balmaProfile.id, type: 'food', timestamp: '2026-09-02T09:35:00+02:00', quantityGrams: 90, loggedBy: 'Matthieu' },
      { id: '3', puppyId: balmaProfile.id, type: 'pee', timestamp: '2026-09-03T08:37:00+02:00', loggedBy: 'Matthieu' },
    ];

    const refTime = new Date('2026-09-03T09:01:49+02:00');
    const pred = calculatePredictions(activities, balmaProfile, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.nextFoodExpectedAt).not.toBeNull();
    expect(pred.nextFoodExpectedAt!.getHours()).toBe(9);
    expect(pred.nextFoodExpectedAt!.getMinutes()).toBe(35);
    expect(pred.foodReason).toContain('09:35');
  });
});

