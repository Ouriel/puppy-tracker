import { describe, it, expect } from 'vitest';
import { calculatePredictions } from '../predictions';
import type { PottyLocation, SleepSchedule } from '../../types';
import { BALMA, act, at, newestFirst } from './fixtures';

describe('Night Mode, Evening Outings, and Age Transitions Comprehensive Test Suite', () => {
  const balmaSleepSchedule: SleepSchedule = {
    bedtimeHour: 22.58, // 22:35 PM
    wakeupHour: 7.56,   // 07:34 AM
    bedtimeStr: '22:35',
    wakeupStr: '07:34',
  };

  // 1. Evening Pre-Bed Walk Preservation
  it('preserves pre-bed walk at 21:15 PM when last pee was at 17:36 PM (does NOT jump to morning)', () => {
    const activities = [
      act('pee', '2026-08-23T17:36:00+02:00'),
      act('food', '2026-08-23T17:06:00+02:00', { quantityGrams: 75 }),
    ];

    const refTime = new Date('2026-08-23T21:15:00+02:00'); // 21:15 PM
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-08-23 21:36'); // Tonight: 17:36 + 4h
    expect(pred.peeUrgency).toBe('safe');
  });

  // 2. Bladder Interval Landing Past Bedtime
  it('preserves tonight pre-bed walk when the 4h interval lands past bedtime (19:00 + 4h = 23:00)', () => {
    const activities = [act('pee', '2026-08-23T19:00:00+02:00')];

    const refTime = new Date('2026-08-23T22:15:00+02:00'); // 22:15 PM
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    // Past bedtime (22:35) but within bedtime + interval/2 (00:35), so tonight's outing is kept
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-08-23 23:00');
  });

  // 3. Pre-Bed Pee Logged -> Smooth Morning Rollover
  it('rolls over to morning wakeup once the pre-bedtime pee is logged at 22:30 PM', () => {
    const activities = [
      act('pee', '2026-08-23T17:36:00+02:00'),
      act('pee', '2026-08-23T22:30:00+02:00'),
    ];

    const refTime = new Date('2026-08-23T22:36:00+02:00'); // Right after bedtime walk
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('night_sleep');
    expect(pred.peeReason).toContain('Morning outing');
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-08-24 07:34'); // Next morning wakeup
  });

  // 4. Early Morning Awakening (05:38 AM)
  it('exits night mode immediately when an early morning pee is logged at 05:38 AM', () => {
    const activities = [
      act('pee', '2026-08-21T22:30:00+02:00'),
      act('pee', '2026-08-22T05:38:00+02:00'),
    ];

    const refTime = new Date('2026-08-22T06:00:00+02:00'); // 06:00 AM
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-08-22 09:38'); // 05:38 + 4h
  });

  // 5. Young Puppy Multi-Step Night Pauses
  it('schedules successive mid-night potty breaks for an 8-week-old young puppy overnight', () => {
    const youngProfile = {
      ...BALMA,
      birthDate: '2026-06-13', // 8 weeks old on August 8
    };

    const sleepSchedule: SleepSchedule = {
      bedtimeHour: 22.0,
      wakeupHour: 7.0,
      bedtimeStr: '22:00',
      wakeupStr: '07:00',
    };

    // Step 1: At 23:00 PM, last pee was 22:00 PM
    const step1Activities = [act('pee', '2026-08-08T22:00:00+02:00')];
    const step1Ref = new Date('2026-08-08T23:00:00+02:00');
    const pred1 = calculatePredictions(newestFirst(step1Activities), youngProfile, step1Ref, 'Europe/Paris', sleepSchedule);

    expect(pred1.peeMode).toBe('night_sleep');
    expect(pred1.peeReason).toContain('Young puppy mid-night potty break');
    expect(at(pred1.nextPeeExpectedAt!)).toBe('2026-08-09 02:00'); // 22:00 + 4h

    // Step 2: Logged 02:00 AM mid-night pee, checked at 02:30 AM
    const step2Activities = [
      ...step1Activities,
      act('pee', '2026-08-09T02:00:00+02:00'),
    ];
    const step2Ref = new Date('2026-08-09T02:30:00+02:00');
    const pred2 = calculatePredictions(newestFirst(step2Activities), youngProfile, step2Ref, 'Europe/Paris', sleepSchedule);

    expect(pred2.peeMode).toBe('night_sleep');
    expect(pred2.peeReason).toContain('Young puppy mid-night potty break');
    expect(at(pred2.nextPeeExpectedAt!)).toBe('2026-08-09 06:00'); // 02:00 + 4h
  });

  // 6. Late Evening Dinner
  it('allows late evening dinner logging at 21:30 PM when daily goal is not yet reached', () => {
    const activities = [
      act('food', '2026-08-23T08:13:00+02:00', { quantityGrams: 90 }),
      act('food', '2026-08-23T17:06:00+02:00', { quantityGrams: 75 }),
    ];

    const refTime = new Date('2026-08-23T21:30:00+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.foodMode).toBe('daytime_schedule');
    expect(pred.portionGrams).toBe(75); // 240 - 165 = 75g remaining
    expect(pred.foodReason).toContain('Meal 3 of 3');
  });

  // 7. Evening Pre-Bed Pee Preservation past Bedtime (Bug 1)
  it('preserves pre-bed pee at 22:45 PM past bedtime (22:35) when last pee was at 17:36 PM without jumping to morning', () => {
    const activities = [act('pee', '2026-08-23T17:36:00+02:00')];

    const refTime = new Date('2026-08-23T22:45:00+02:00'); // Past bedtime (22:35)
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-08-23 21:36'); // Tonight (17:36 + 4h), NOT August 24
    expect(pred.peeUrgency).toBe('overdue');
  });

  // 9. Quick action logging smoothly transitions from overdue pre-bed to night sleep (Bug 2)
  it('smoothly transitions to night mode when bedtime poop is logged at 22:48 PM', () => {
    const refTime = new Date('2026-08-23T22:48:15+02:00');
    const activities = [
      act('poop', '2026-08-23T12:34:00+02:00'),
      act('poop', '2026-08-23T22:48:15+02:00'),
    ];

    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.poopMode).toBe('night_sleep');
    expect(pred.poopUrgency).toBe('safe');
    // Rolled over to the morning outing (wakeup 07:34 + default 10m offset) because the 22:48:15 poop was recognized
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-08-24 07:44');
  });

  // 10. Split Pre-Bed Outing: Pee logged, Poop still pending
  it('decouples pee and poop: pee enters night_sleep while overdue poop remains daytime_baseline', () => {
    const activities = [
      act('pee', '2026-08-23T22:42:00+02:00'), // Pre-bed pee done
      act('poop', '2026-08-23T12:34:00+02:00'), // Poop pending since noon
    ];

    const refTime = new Date('2026-08-23T22:45:00+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', balmaSleepSchedule);

    expect(pred.peeMode).toBe('night_sleep');
    expect(pred.peeUrgency).toBe('safe');
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-08-24 07:34'); // Morning outing (August 24)

    expect(pred.poopMode).toBe('daytime_baseline');
    expect(pred.poopUrgency).toBe('overdue');
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-08-23 18:34'); // Preserved for tonight: 12:34 + 6h
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
    const acts1 = [act('pee', '2026-08-23T18:00:00+02:00')];
    const pred1 = calculatePredictions(newestFirst(acts1), BALMA, new Date('2026-08-23T23:45:00+02:00'), 'Europe/Paris', midnightSchedule);
    expect(pred1.peeMode).toBe('daytime_baseline');
    expect(pred1.peeUrgency).toBe('overdue');
    expect(at(pred1.nextPeeExpectedAt!)).toBe('2026-08-23 22:00'); // 18:00 + 4h

    // Case 2: At 00:45 (after bedtime 00:30), last pee was 18:00 (no pre-bed pee in >= 22:30) -> preserves pre-bed
    const pred2 = calculatePredictions(newestFirst(acts1), BALMA, new Date('2026-08-24T00:45:00+02:00'), 'Europe/Paris', midnightSchedule);
    expect(pred2.peeMode).toBe('daytime_baseline');
    expect(pred2.peeUrgency).toBe('overdue');
    expect(at(pred2.nextPeeExpectedAt!)).toBe('2026-08-23 22:00');

    // Case 3: At 00:45, pre-bed pee was logged at 23:30 (>= 22:30 window) -> enters night_sleep
    const acts3 = [act('pee', '2026-08-23T23:30:00+02:00')];
    const pred3 = calculatePredictions(newestFirst(acts3), BALMA, new Date('2026-08-24T00:45:00+02:00'), 'Europe/Paris', midnightSchedule);
    expect(pred3.peeMode).toBe('night_sleep');
    expect(at(pred3.nextPeeExpectedAt!)).toBe('2026-08-24 08:30'); // Morning outing
  });

  // 12. Indoor Accident in Pre-Bed Window
  it('recognizes indoor accident in pre-bed window as emptied bladder for overnight sleep', () => {
    const refTime = new Date('2026-08-23T22:45:00+02:00'); // After bedtime (22:35)
    const predictAfterPreBedPee = (pottyLocation: PottyLocation) => calculatePredictions(
      [act('pee', '2026-08-23T22:20:00+02:00', { pottyLocation })],
      BALMA, refTime, 'Europe/Paris', balmaSleepSchedule
    );
    const indoorPred = predictAfterPreBedPee('indoor_accident');
    const outsidePred = predictAfterPreBedPee('outside');

    expect(indoorPred.peeMode).toBe('night_sleep');
    expect(at(indoorPred.nextPeeExpectedAt!)).toBe('2026-08-24 07:34'); // Morning outing
    expect(indoorPred.nextPeeExpectedAt).toEqual(outsidePred.nextPeeExpectedAt);
  });

  // 13. Early Morning Walk Before Usual Wakeup (Balma Sept 1st scenario)
  it('exits night mode and rolls over to daytime baseline when walked early at 07:48 AM before wakeup time 08:38 AM', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.8, // 22:48 PM
      wakeupHour: 8.63,  // 08:38 AM
      bedtimeStr: '22:48',
      wakeupStr: '08:38',
    };

    const activities = [
      act('pee', '2026-08-31T21:33:00+02:00'),
      act('pee', '2026-09-01T07:48:04+02:00'),
    ];

    // Reference time in app component before 60s interval tick (e.g. 07:48:00)
    const refTime = new Date('2026-09-01T07:48:00+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.peeMode).toBe('daytime_baseline');
    expect(pred.peeReason).not.toContain('Morning outing');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    // Next pee is 07:48 + 4h = 11:48, not the 08:38 wakeup
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-09-01 11:48');
  });

  // 14. Morning Poop & Breakfast Sequence Anchors to First Morning Pee
  it('anchors morning poop and breakfast sequence to early morning pee when awake', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.8,
      wakeupHour: 8.63, // 08:38 AM
      bedtimeStr: '22:48',
      wakeupStr: '08:38',
    };

    const activities = [
      act('poop', '2026-08-31T12:34:00+02:00'),
      act('pee', '2026-08-31T21:33:00+02:00'),
      act('pee', '2026-09-01T07:48:00+02:00'),
    ];

    const refTime = new Date('2026-09-01T07:48:30+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    // Poop should anchor around early morning outing (07:48 + ~10m = 07:58), not wait until 08:48
    expect(pred.nextPoopExpectedAt).not.toBeNull();
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-09-01 07:58');
    // Breakfast follows the same walk (07:48 + 15m = 08:03), not the default 07:30 schedule
    expect(at(pred.nextFoodExpectedAt!)).toBe('2026-09-01 08:03');
  });

  // 15. Afternoon Poop Prediction Targets Tonight's Evening Walk (No 18h Skip to Morning)
  it('predicts evening outing tonight when puppy poops in early afternoon (13:52) with a learned ~5h09 interval', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities = [
      act('pee', '2026-09-03T08:37:00+02:00'),
      act('poop', '2026-09-03T08:43:00+02:00'),
      act('food', '2026-09-03T09:29:00+02:00', { quantityGrams: 100 }),
      act('pee', '2026-09-03T13:46:00+02:00'),
      act('poop', '2026-09-03T13:52:00+02:00'),
    ];

    // Reference time in afternoon (14:12 PM)
    const refTime = new Date('2026-09-03T14:12:25+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.poopMode).toBe('daytime_baseline');
    expect(pred.poopReason).not.toContain('Morning outing');
    expect(pred.poopReason).toContain('5h09'); // Learned from today's 08:43 -> 13:52 gap
    expect(pred.nextPoopExpectedAt).not.toBeNull();

    // Next poop is tonight (13:52 + 5h09 = 19:01), NOT next morning (~08:44)
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-09-03 19:01');
  });

  // 16. Pre-bed Poop Rolls Over to Morning Once Outing Is Logged
  it('transitions poop prediction to morning outing once pre-bed walk is logged at 23:17', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities = [
      act('pee', '2026-09-03T08:37:00+02:00'),
      act('poop', '2026-09-03T08:43:00+02:00'),
      act('pee', '2026-09-03T13:46:00+02:00'),
      act('poop', '2026-09-03T13:52:00+02:00'),
      act('poop', '2026-09-03T23:17:00+02:00'),
      act('pee', '2026-09-03T23:18:00+02:00'),
    ];

    const refTime = new Date('2026-09-03T23:25:00+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.poopMode).toBe('night_sleep');
    expect(pred.poopReason).toContain('Morning outing');
    expect(pred.nextPoopExpectedAt).not.toBeNull();
    // Next day: wakeup 08:38 + 6m morning offset (08:37 pee -> 08:43 poop)
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-09-04 08:44');
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
    const activities = [
      act('food', '2026-08-31T09:35:00+02:00', { quantityGrams: 90 }),
      act('food', '2026-09-01T09:35:00+02:00', { quantityGrams: 90 }),
      act('food', '2026-09-02T09:35:00+02:00', { quantityGrams: 90 }),
      act('pee', '2026-09-03T08:37:00+02:00'),
    ];

    const refTime = new Date('2026-09-03T09:01:49+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.nextFoodExpectedAt).not.toBeNull();
    expect(at(pred.nextFoodExpectedAt!)).toBe('2026-09-03 09:35');
    expect(pred.foodReason).toContain('09:35');
  });

  // 18. Evening Poop (18:48) with 9.5h Interval Rolls Over to Morning (NO 04:18 AM bug)
  it('rolls over to morning outing when an evening poop (18:48) creates a deep night standard expectation (04:18 AM)', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities = [
      // 4 historical poops with a 9h30 learned interval
      act('poop', '2026-09-01T08:30:00+02:00'),
      act('poop', '2026-09-01T18:00:00+02:00'),
      act('poop', '2026-09-02T08:30:00+02:00'),
      act('poop', '2026-09-02T18:00:00+02:00'),
      // Today Sept 3
      act('pee', '2026-09-03T18:41:00+02:00'),
      act('poop', '2026-09-03T18:48:00+02:00'),
    ];

    const refTime = new Date('2026-09-03T21:38:49+02:00'); // 21:38 PM (user screenshot time)
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    // Poop: 18:48 + 9h30 = 04:18 AM -> DEEP NIGHT -> must roll over to morning!
    expect(at(pred.standardPoopExpectedAt!)).toBe('2026-09-04 04:18');
    expect(pred.nextPoopExpectedAt).not.toBeNull();
    // Morning outing: wakeup 08:38 + 7m morning offset (18:41 pee -> 18:48 poop)
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-09-04 08:45');
    expect(pred.poopReason).toContain('Morning outing');

    // Pee: 18:41 + 4h = 22:41 -> before bedtime 22:49 -> preserved for tonight pre-bed outing!
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-09-03 22:41');
  });

  // 19. Afternoon Poop (13:52) with 9h38 Interval Preserves Tonight Pre-Bed Outing (23:30)
  it('preserves pre-bed poop when afternoon poop (13:52) creates a pre-bedtime expectation (23:30 <= bedtime + interval/2)', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities = [
      // Historical poops with 9h38m (578m) learned interval
      act('poop', '2026-09-01T08:30:00+02:00'),
      act('poop', '2026-09-01T18:08:00+02:00'),
      act('poop', '2026-09-02T08:30:00+02:00'),
      act('poop', '2026-09-02T18:08:00+02:00'),
      act('poop', '2026-09-03T08:30:00+02:00'),
      // Today Sept 3 afternoon
      act('poop', '2026-09-03T13:52:00+02:00'),
    ];

    const refTime = new Date('2026-09-03T16:58:26+02:00'); // 16:58 PM
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    // 13:52 + 9h38 = 23:30 (<= bedtime 22:49 + 578m/2 = 03:38) -> Preserved for tonight
    expect(pred.nextPoopExpectedAt).not.toBeNull();
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-09-03 23:30');
  });

  // 20. Late Evening Pee (21:30) with 4h Interval Rolls Over to Morning (NO 01:30 AM bug)
  it('rolls over to morning when late evening pee (21:30) creates a deep night expectation (01:30 AM)', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities = [act('pee', '2026-09-03T21:30:00+02:00')];

    const refTime = new Date('2026-09-03T22:45:00+02:00'); // 22:45 PM
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    // 21:30 + 4h = 01:30 AM (> bedtime 22:49 + 2h) -> DEEP NIGHT -> rolls over to morning wakeup 08:38
    expect(at(pred.standardPeeExpectedAt!)).toBe('2026-09-04 01:30');
    expect(pred.nextPeeExpectedAt).not.toBeNull();
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-09-04 08:38');
    expect(pred.peeReason).toContain('Morning outing');
  });

  // 21. Post-Bedtime Walk (00:10 Pee & 00:17 Poop) Enters Clean Overnight Sleep
  it('enters clean overnight sleep with morning outings when bedtime walk occurs past midnight (00:10 / 00:17)', () => {
    const lateWakeSchedule: SleepSchedule = {
      bedtimeHour: 22.81, // 22:49 PM
      wakeupHour: 8.63,   // 08:38 AM
      bedtimeStr: '22:49',
      wakeupStr: '08:38',
    };

    const activities = [
      act('pee', '2026-09-04T00:10:00+02:00'),
      act('poop', '2026-09-04T00:17:00+02:00'),
    ];

    const refTime = new Date('2026-09-04T00:30:00+02:00'); // 00:30 AM (in night sleep)
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', lateWakeSchedule);

    expect(pred.peeMode).toBe('night_sleep');
    expect(at(pred.nextPeeExpectedAt!)).toBe('2026-09-04 08:38');
    expect(pred.peeReason).toContain('Morning outing');

    expect(pred.poopMode).toBe('night_sleep');
    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-09-04 08:45'); // Wakeup + 7m morning offset (00:10 pee -> 00:17 poop)
    expect(pred.poopReason).toContain('Morning outing');
  });

  // 22. Midnight Wrapping Schedule with Deep Night Rollover
  it('handles midnight wrapping schedule (00:30 - 08:30) rolling over deep night predictions (06:30 AM) to morning', () => {
    const midnightSchedule: SleepSchedule = {
      bedtimeHour: 0.5, // 00:30 AM
      wakeupHour: 8.5,  // 08:30 AM
      bedtimeStr: '00:30',
      wakeupStr: '08:30',
    };

    const activities = [
      act('poop', '2026-08-20T08:30:00+02:00'),
      act('poop', '2026-08-20T18:00:00+02:00'),
      act('poop', '2026-08-21T08:30:00+02:00'),
      act('poop', '2026-08-21T18:00:00+02:00'),
      act('poop', '2026-08-23T21:00:00+02:00'),
    ];

    // 21:00 + 9.5h = 06:30 AM (deep night > 00:30 + interval/2)
    const refTime = new Date('2026-08-23T23:45:00+02:00');
    const pred = calculatePredictions(newestFirst(activities), BALMA, refTime, 'Europe/Paris', midnightSchedule);

    expect(at(pred.nextPoopExpectedAt!)).toBe('2026-08-24 08:40'); // Morning outing: 08:30 + default 10m offset
    expect(pred.poopReason).toContain('Morning outing');
  });

  // 23. Full Symmetry: Both Pee and Poop Evaluate Strictly by Learned Interval
  it('operates pee and poop symmetrically: pre-bed preserved if expiring <= bedtime + interval/2, rolled over if expiring > bedtime + interval/2', () => {
    const sleepSchedule: SleepSchedule = {
      bedtimeHour: 22.5, // 22:30 PM
      wakeupHour: 7.5,   // 07:30 AM
      bedtimeStr: '22:30',
      wakeupStr: '07:30',
    };
    const eveningRef = new Date('2026-09-03T21:00:00+02:00'); // 21:00 PM

    // Scenario A: Last pee at 19:00 (interval 4h -> due at 23:00, past bedtime but <= 22:30 + 2h) -> PRESERVED for tonight
    const peePred = calculatePredictions([act('pee', '2026-09-03T19:00:00+02:00')], BALMA, eveningRef, 'Europe/Paris', sleepSchedule);
    expect(peePred.peeMode).toBe('daytime_baseline');
    expect(at(peePred.nextPeeExpectedAt!)).toBe('2026-09-03 23:00');

    // Scenario B: Last poop at 18:48 (interval 9h30 -> due at 04:18 AM > 22:30 + 4h45) -> ROLLED OVER to morning
    const poopActivities = [
      act('poop', '2026-09-01T08:30:00+02:00'),
      act('poop', '2026-09-01T18:00:00+02:00'),
      act('poop', '2026-09-02T08:30:00+02:00'),
      act('poop', '2026-09-02T18:00:00+02:00'),
      act('pee', '2026-09-03T18:00:00+02:00'),
      act('poop', '2026-09-03T18:48:00+02:00'),
    ];
    const poopPred = calculatePredictions(newestFirst(poopActivities), BALMA, eveningRef, 'Europe/Paris', sleepSchedule);
    expect(at(poopPred.standardPoopExpectedAt!)).toBe('2026-09-04 04:18');
    // Wakeup 07:30 + 48m morning offset (18:00 pee -> 18:48 poop is the only same-day pair)
    expect(at(poopPred.nextPoopExpectedAt!)).toBe('2026-09-04 08:18');
    expect(poopPred.poopReason).toContain('Morning outing');
  });

  // 24. 50% Tank Capacity Threshold at Bedtime
  it('preserves pre-bed walk when >= 50% of voiding interval has elapsed by bedtime, rolls over to morning when < 50%', () => {
    const sleepSchedule: SleepSchedule = {
      bedtimeHour: 23.0, // 23:00 PM
      wakeupHour: 8.0,   // 08:00 AM
      bedtimeStr: '23:00',
      wakeupStr: '08:00',
    };

    // Bladder interval: 4 hours (240m)
    // Scenario 1: Peed at 20:30 (at 23:00 bedtime, 2.5h / 4h = 62.5% elapsed >= 50%) -> PRESERVED for pre-bed outing (~00:30 AM)
    const activities1 = [act('pee', '2026-09-03T20:30:00+02:00')];
    const pred1 = calculatePredictions(newestFirst(activities1), BALMA, new Date('2026-09-03T22:30:00+02:00'), 'Europe/Paris', sleepSchedule);
    expect(at(pred1.nextPeeExpectedAt!)).toBe('2026-09-04 00:30'); // Tonight's pre-bed outing
    expect(pred1.peeMode).toBe('daytime_baseline');

    // Scenario 1b: same pee, at 23:15 after bedtime: 00:30 is past bedtime + interval/3 (00:20) but within
    // bedtime + interval/2 (01:00), so the outing is still preserved instead of switching to night mode
    const pred1b = calculatePredictions(newestFirst(activities1), BALMA, new Date('2026-09-03T23:15:00+02:00'), 'Europe/Paris', sleepSchedule);
    expect(pred1b.peeMode).toBe('daytime_baseline');
    expect(at(pred1b.nextPeeExpectedAt!)).toBe('2026-09-04 00:30');

    // Scenario 2: Peed at 22:15 (at 23:00 bedtime, 0.75h / 4h = 18.75% elapsed < 50%) -> ROLLED OVER to morning wakeup (08:00 AM)
    const activities2 = [act('pee', '2026-09-03T22:15:00+02:00')];
    const pred2 = calculatePredictions(newestFirst(activities2), BALMA, new Date('2026-09-03T22:45:00+02:00'), 'Europe/Paris', sleepSchedule);
    expect(at(pred2.nextPeeExpectedAt!)).toBe('2026-09-04 08:00'); // Morning wakeup
    expect(pred2.peeReason).toContain('Morning outing');
  });
});
