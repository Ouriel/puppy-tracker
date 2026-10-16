/**
 * Edge cases of the pee, poop and meal cards (prediction review of 2026-10-16, items B2-B14, P7).
 * Made-up dogs and logs, Europe/Paris summer time (+02:00).
 */
import { describe, it, expect } from 'vitest';
import { calculatePredictions } from '../predictions';
import { translatePredictionReason } from '../predictionsTranslation';
import type { Activity, ActivityType, PredictionResult, PuppyProfile, SleepSchedule } from '../../types';
import { act, at, PISTACHE, newestFirst } from './fixtures';

const TIME_ZONE = 'Europe/Paris';
const NIGHT_22_TO_07: SleepSchedule = { bedtimeHour: 22, wakeupHour: 7, bedtimeStr: '22:00', wakeupStr: '07:00' };

const paris = (day: string, clockTime: string) => new Date(`${day}T${clockTime}:00+02:00`);
const logAt = (type: ActivityType, day: string, clockTime: string, extra: Partial<Activity> = {}) =>
  act(type, paris(day, clockTime).toISOString(), extra);

function addDays(day: string, count: number): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth + count)).toISOString().slice(0, 10);
}

/** `count` consecutive days from `firstDay`. */
const daysFrom = (firstDay: string, count: number) => Array.from({ length: count }, (_unused, index) => addDays(firstDay, index));

/** What the dashboard computes at `day clockTime`: only the logs up to then, newest first. */
function predictAt(logs: Activity[], profile: PuppyProfile, day: string, clockTime: string, schedule?: SleepSchedule): PredictionResult {
  const now = paris(day, clockTime);
  const visible = newestFirst(logs.filter((log) => Date.parse(log.timestamp) <= now.getTime()));
  return calculatePredictions(visible, profile, now, TIME_ZONE, schedule);
}

const twoMonthsOld = { ...PISTACHE, birthDate: '2026-06-15' }; // 2.0 months on 15 Aug
const threeMonthsOld = { ...PISTACHE, birthDate: '2026-06-15' }; // 3.0 months on 15 Sept
const adult = { ...PISTACHE, birthDate: '2024-08-01' };

describe('B2: a night potty between 02:00 and 05:00 is not the bedtime', () => {
  it('2-month puppy whose 02:30 pee is logged every night: bedtime 22:30, break card at 00:30', () => {
    const logs = daysFrom('2026-08-08', 7).flatMap((day) => [
      logAt('pee', day, '07:00'),
      logAt('food', day, '07:30', { quantityGrams: 60 }),
      logAt('pee', day, '10:00'),
      logAt('pee', day, '13:00'),
      logAt('pee', day, '16:00'),
      logAt('pee', day, '19:00'),
      logAt('pee', day, '22:30'),
      logAt('pee', addDays(day, 1), '02:30'),
    ]);

    const result = predictAt(logs, twoMonthsOld, '2026-08-15', '00:30');

    expect(result.sleepSchedule?.bedtimeStr).toBe('22:30');
    expect(result.peeMode).toBe('night_sleep');
    expect(result.peeReason).toBe('Night mode: Young puppy mid-night potty break');
    expect(at(result.nextPeeExpectedAt!)).toBe('2026-08-15 02:30');
  });
});

describe('B3: a 04:xx night potty neither ends the night nor anchors the morning', () => {
  const history = daysFrom('2026-08-12', 3).flatMap((day) => [
    logAt('pee', day, '07:00'),
    logAt('poop', day, '07:10'),
    logAt('pee', day, '10:00'),
    logAt('pee', day, '13:00'),
    logAt('poop', day, '14:00'),
    logAt('pee', day, '16:00'),
    logAt('pee', day, '19:00'),
    logAt('poop', day, '19:30'),
    logAt('pee', day, '21:45'),
  ]);
  const nightPee = logAt('pee', '2026-08-15', '04:10');

  it('04:10 pee, wake-up 07:00: no red card before anyone is up', () => {
    for (const clockTime of ['04:40', '05:20', '06:10', '06:30']) {
      const result = predictAt([...history, nightPee], twoMonthsOld, '2026-08-15', clockTime, NIGHT_22_TO_07);
      expect(result.poopUrgency, `poop at ${clockTime}`).not.toBe('overdue');
      expect(result.peeUrgency, `pee at ${clockTime}`).not.toBe('overdue');
    }
  });

  it('2 h pee gaps, 04:10 pee: the night goes on until 07:00, the pee card is not red from 06:10', () => {
    const twoHourGaps = daysFrom('2026-08-12', 3).flatMap((day) =>
      ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'].map((clockTime) => logAt('pee', day, clockTime))
    );
    const result = predictAt([...twoHourGaps, nightPee], twoMonthsOld, '2026-08-15', '06:15', NIGHT_22_TO_07);

    expect(result.peeMode).toBe('night_sleep');
    expect(result.peeUrgency).not.toBe('overdue');
    expect(result.peeReason).toBe('Morning outing (~07:00)');
  });

  it('breakfast logged at 06:30 with no pee since 05:00: the first poop is expected after wake-up, not at 04:20', () => {
    const breakfast = logAt('food', '2026-08-15', '06:30', { quantityGrams: 60 });
    const result = predictAt([...history, nightPee, breakfast], adult, '2026-08-15', '06:40', NIGHT_22_TO_07);

    expect(result.poopUrgency).not.toBe('overdue');
    expect(at(result.nextPoopExpectedAt!)).toBe('2026-08-15 07:10');
  });
});

describe('B4: one night target for the pee card, the break kept 30 min', () => {
  const pee = logAt('pee', '2026-08-15', '21:10');

  it('2-month puppy, pee at 21:10: the 01:10 break is already shown in the evening', () => {
    const result = predictAt([pee], twoMonthsOld, '2026-08-15', '21:30', NIGHT_22_TO_07);

    expect(result.peeReason).toBe('Night mode: Young puppy mid-night potty break');
    expect(at(result.nextPeeExpectedAt!)).toBe('2026-08-16 01:10');
  });

  it('10 min after the break is due: amber "due now", never red', () => {
    const result = predictAt([pee], twoMonthsOld, '2026-08-16', '01:20', NIGHT_22_TO_07);

    expect(result.peeReason).toBe('Night mode: Young puppy mid-night potty break');
    expect(at(result.nextPeeExpectedAt!)).toBe('2026-08-16 01:20');
    expect(result.peeUrgency).toBe('soon');
  });

  it('31 min after the break is due: the morning outing', () => {
    const result = predictAt([pee], twoMonthsOld, '2026-08-16', '01:41', NIGHT_22_TO_07);

    expect(result.peeReason).toBe('Morning outing (~07:00)');
    expect(at(result.nextPeeExpectedAt!)).toBe('2026-08-16 07:00');
    expect(result.peeUrgency).toBe('safe');
  });

  // P5 (break under 4 months) is on hold: once the family logs the 01:50 break, a 2nd break at 05:50 would follow,
  // and that log ends the night and turns the poop card red before wake-up
  it('3-month puppy whose 01:50 break pee is logged: the morning outing, no 2nd break at 05:50', () => {
    const logs = [logAt('pee', '2026-09-14', '21:50'), logAt('pee', '2026-09-15', '01:50')];
    const result = predictAt(logs, threeMonthsOld, '2026-09-15', '02:00', NIGHT_22_TO_07);

    expect(result.peeReason).toBe('Morning outing (~07:00)');
    expect(at(result.nextPeeExpectedAt!)).toBe('2026-09-15 07:00');
  });
});

describe('B10: an evening meal does not move the pee card into the night', () => {
  // A 3-month puppy (always post-meal eligible) whose daytime pees are 4 h apart
  const history = daysFrom('2026-09-08', 7).flatMap((day) => ['07:00', '11:00', '15:00', '19:00'].map((clockTime) => logAt('pee', day, clockTime)));
  const today = ['07:00', '11:00', '15:00'].map((clockTime) => logAt('pee', '2026-09-15', clockTime));

  const cases: [string, Activity[], Activity, string][] = [
    ['pee 20:30, meal 20:45 (peed just before eating)', [logAt('pee', '2026-09-15', '20:30')], logAt('food', '2026-09-15', '20:45', { quantityGrams: 60 }), '21:30'],
    ['pee 20:05, meal 20:40 (post-meal reminder over)', [logAt('pee', '2026-09-15', '20:05')], logAt('food', '2026-09-15', '20:40', { quantityGrams: 60 }), '21:45'],
  ];

  it.each(cases)('%s: same pee card as without the meal', (_name, pee, meal, clockTime) => {
    const withoutMeal = predictAt([...history, ...today, ...pee], threeMonthsOld, '2026-09-15', clockTime, NIGHT_22_TO_07);
    const withMeal = predictAt([...history, ...today, ...pee, meal], threeMonthsOld, '2026-09-15', clockTime, NIGHT_22_TO_07);

    expect(withMeal.peeReason).toBe(withoutMeal.peeReason);
    expect(withMeal.nextPeeExpectedAt).toEqual(withoutMeal.nextPeeExpectedAt);
    expect(withMeal.peeUrgency).toBe(withoutMeal.peeUrgency);
  });
});

describe('B5: the hard-stool pause ends due at its end, with its own reason', () => {
  it('adult, hard stool at 19:00: just after the pause, the card points to the pause end', () => {
    const history = daysFrom('2026-09-08', 6).flatMap((day) => [
      logAt('pee', day, '07:35'),
      logAt('poop', day, '08:00'),
      logAt('pee', day, '12:00'),
      logAt('pee', day, '17:00'),
      logAt('poop', day, '20:00'),
      logAt('pee', day, '22:00'),
    ]);
    const logs = [
      ...history,
      logAt('pee', '2026-09-14', '07:35'),
      logAt('poop', '2026-09-14', '08:00'),
      logAt('poop', '2026-09-14', '19:00', { stoolConsistency: 'hard' }),
      logAt('pee', '2026-09-15', '07:35'),
    ];
    const duringPause = predictAt(logs, adult, '2026-09-15', '09:00', NIGHT_22_TO_07);
    const pauseEnd = duringPause.standardPoopExpectedAt!;
    expect(duringPause.poopReason).toBe('Digestive recovery: pause after hard stool');

    const now = new Date(pauseEnd.getTime() + 2 * 60_000);
    const result = calculatePredictions(newestFirst(logs), adult, now, TIME_ZONE, NIGHT_22_TO_07);

    expect(result.nextPoopExpectedAt).toEqual(pauseEnd);
    expect(result.poopReason).toBe('Digestive recovery: pause after hard stool');
  });
});

describe('B7: breakfast is never expected before wake-up', () => {
  const lateRiser: SleepSchedule = { bedtimeHour: 22, wakeupHour: 8.5, bedtimeStr: '22:00', wakeupStr: '08:30' };
  const logs = [logAt('pee', '2026-09-14', '21:30')];

  it('wake-up 08:30, breakfast 07:30 (default): at 07:31 breakfast is due at 08:30 today, not tomorrow', () => {
    const result = predictAt(logs, adult, '2026-09-15', '07:31', lateRiser);

    expect(at(result.nextFoodExpectedAt!)).toBe('2026-09-15 08:30');
  });

  it('at 08:31 with nothing logged since: overdue since 08:30', () => {
    const result = predictAt(logs, adult, '2026-09-15', '08:31', lateRiser);

    expect(at(result.nextFoodExpectedAt!)).toBe('2026-09-15 08:30');
    expect(result.foodUrgency).toBe('overdue');
  });

  it('goal reached: tomorrow\'s breakfast at wake-up, 08:30', () => {
    const noGramGoal = { ...adult, targetMealsPerDay: 2, dailyFoodGramGoal: 0 };
    const meals = [logAt('food', '2026-09-15', '09:00'), logAt('food', '2026-09-15', '15:00')];
    const result = predictAt([...logs, ...meals], noGramGoal, '2026-09-15', '20:00', lateRiser);

    expect(result.foodMode).toBe('goal_reached');
    expect(at(result.nextFoodExpectedAt!)).toBe('2026-09-16 08:30');
  });
});

describe('B9: the sleep schedule is learned from 3 days with 2 or more logs', () => {
  it('a family starting in the evening (5 logs 19:00-22:30): next morning still 22:00 / 07:00', () => {
    const firstEvening = [
      logAt('pee', '2026-09-14', '19:00'),
      logAt('food', '2026-09-14', '20:00', { quantityGrams: 60 }),
      logAt('pee', '2026-09-14', '21:00'),
      logAt('poop', '2026-09-14', '22:00'),
      logAt('pee', '2026-09-14', '22:30'),
    ];
    const result = predictAt(firstEvening, adult, '2026-09-15', '08:00');

    expect(result.sleepSchedule).toEqual(NIGHT_22_TO_07);
  });
});

describe('B8: the cards read the last 14 days only', () => {
  it('logs 15 to 29 days old change nothing', () => {
    const recent = daysFrom('2026-09-02', 14).flatMap((day) => [
      logAt('pee', day, '07:00'),
      logAt('poop', day, '07:15'),
      logAt('food', day, '07:30', { quantityGrams: 80 }),
      logAt('pee', day, '11:00'),
      logAt('food', day, '12:30', { quantityGrams: 80 }),
      logAt('pee', day, '15:00'),
      logAt('poop', day, '18:00'),
      logAt('food', day, '19:00', { quantityGrams: 80 }),
      logAt('pee', day, '22:00'),
    ]);
    const older = daysFrom('2026-08-18', 14).flatMap((day) => [
      ...['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((clockTime) => logAt('pee', day, clockTime)),
      logAt('poop', day, '09:00'),
      logAt('poop', day, '12:00'),
      logAt('food', day, '05:30', { quantityGrams: 50 }),
      logAt('food', day, '10:30', { quantityGrams: 50 }),
    ]);

    const withoutOlder = predictAt(recent, PISTACHE, '2026-09-15', '15:30');
    const withOlder = predictAt([...recent, ...older], PISTACHE, '2026-09-15', '15:30');

    expect(withOlder).toEqual(withoutOlder);
  });
});

describe('B6 / P3: the diarrhoea alert comes from the stool choice only, steady amber', () => {
  const history = daysFrom('2026-09-11', 4).flatMap((day) => [
    logAt('pee', day, '07:00'),
    logAt('poop', day, '07:15'),
    logAt('pee', day, '12:00'),
    logAt('poop', day, '18:00'),
    logAt('pee', day, '21:30'),
  ]);
  const poopAt10 = (extra: Partial<Activity>) => [...history, logAt('pee', '2026-09-15', '07:00'), logAt('poop', '2026-09-15', '10:00', extra)];

  it('a note "pas liquide" on a normal stool starts no alert', () => {
    const result = predictAt(poopAt10({ stoolConsistency: 'normal', notes: 'pas liquide' }), adult, '2026-09-15', '10:30', NIGHT_22_TO_07);
    expect(result.poopReason).not.toMatch(/^Digestive alert/);
  });

  it('a legacy "soft" stool starts no alert', () => {
    const result = predictAt(poopAt10({ stoolConsistency: 'soft' }), adult, '2026-09-15', '10:30', NIGHT_22_TO_07);
    expect(result.poopReason).not.toMatch(/^Digestive alert/);
  });

  it('a legacy "runny" stool still starts the alert', () => {
    const result = predictAt(poopAt10({ stoolConsistency: 'runny' }), adult, '2026-09-15', '10:30', NIGHT_22_TO_07);
    expect(result.poopReason).toBe('Digestive alert: frequent checks recommended');
  });

  it('diarrhoea at 10:00: hourly checks, amber at :15, :45 and on the hour, never red', () => {
    const logs = poopAt10({ stoolConsistency: 'diarrhea' });
    for (const [clockTime, due] of [['10:15', '11:00'], ['10:45', '11:00'], ['11:00', '11:00'], ['11:15', '12:00']]) {
      const result = predictAt(logs, adult, '2026-09-15', clockTime, NIGHT_22_TO_07);
      expect(result.poopReason, clockTime).toBe('Digestive alert: frequent checks recommended');
      expect(at(result.nextPoopExpectedAt!), clockTime).toBe(`2026-09-15 ${due}`);
      expect(result.poopUrgency, clockTime).toBe('soon');
    }
  });

  it('diarrhoea at 01:30: the checks keep running at night, amber', () => {
    const logs = [...history, logAt('poop', '2026-09-15', '01:30', { stoolConsistency: 'diarrhea' })];
    const result = predictAt(logs, adult, '2026-09-15', '01:40', NIGHT_22_TO_07);

    expect(result.poopMode).toBe('daytime_baseline');
    expect(at(result.nextPoopExpectedAt!)).toBe('2026-09-15 02:30');
    expect(result.poopUrgency).toBe('soon');
  });
});

describe('B11: decimal grams are rounded', () => {
  it('3 meals of 52.5 g: "Daily goal reached (158g)", in French too', () => {
    const profile = { ...adult, targetMealsPerDay: 3, dailyFoodGramGoal: 160 };
    const meals = ['08:00', '12:00', '18:00'].map((clockTime) => logAt('food', '2026-09-15', clockTime, { quantityGrams: 52.5 }));
    const result = predictAt(meals, profile, '2026-09-15', '19:00', NIGHT_22_TO_07);

    expect(result.foodReason).toBe('Daily goal reached (158g)');
    expect(translatePredictionReason(result.foodReason, 'fr')).toBe('Objectif du jour atteint (158\u00a0g)');
  });
});

describe('B12: meal spacing with a bedtime after midnight', () => {
  it('bedtime 00:30 and a meal at 00:10: spaced 2.5 h, not half a day', () => {
    const afterMidnight: SleepSchedule = { bedtimeHour: 0.5, wakeupHour: 7.5, bedtimeStr: '00:30', wakeupStr: '07:30' };
    const profile = { ...adult, targetMealsPerDay: 4, dailyFoodGramGoal: 400 };
    const meals = [
      logAt('food', '2026-09-14', '08:00', { quantityGrams: 80 }),
      logAt('food', '2026-09-14', '13:00', { quantityGrams: 80 }),
      logAt('food', '2026-09-15', '00:10', { quantityGrams: 80 }),
    ];
    const result = predictAt(meals, profile, '2026-09-15', '00:20', afterMidnight);

    expect(result.foodReason).toBe('Meal 4 of 4 (spaced ~2.5h)');
  });
});

describe('P7: a missed meal stops at bedtime', () => {
  const meals = [logAt('food', '2026-09-15', '07:30', { quantityGrams: 80 }), logAt('food', '2026-09-15', '12:30', { quantityGrams: 80 })];

  it('before bedtime the missed meal is on the card', () => {
    const result = predictAt(meals, PISTACHE, '2026-09-15', '21:50', NIGHT_22_TO_07);
    expect(result.foodReason).toMatch(/^Meal 3 of 3/);
  });

  it('30 min after bedtime: tomorrow\'s breakfast', () => {
    const result = predictAt(meals, PISTACHE, '2026-09-15', '22:30', NIGHT_22_TO_07);

    expect(result.foodMode).toBe('night_sleep');
    expect(result.foodReason).toBe('Breakfast (~07:30, Meal 1 of 3)');
  });
});

describe('B14: the new-day reasons say "first of the day"', () => {
  it('no pee or poop since 04:00 at 07:30: "First pee of the day" and "First poop of the day", in French too', () => {
    const history = daysFrom('2026-09-12', 3).flatMap((day) => [
      logAt('pee', day, '07:00'),
      logAt('poop', day, '07:10'),
      logAt('pee', day, '12:00'),
      logAt('poop', day, '18:00'),
      logAt('pee', day, '21:30'),
    ]);
    const result = predictAt([...history, logAt('food', '2026-09-15', '07:20', { quantityGrams: 80 })], adult, '2026-09-15', '07:30', NIGHT_22_TO_07);

    expect(result.peeReason).toBe('First pee of the day (~07:00)');
    expect(result.poopReason).toBe('First poop of the day (~07:10)');
    expect(translatePredictionReason(result.peeReason, 'fr')).toBe('Premier pipi du jour (~07:00)');
    expect(translatePredictionReason(result.poopReason, 'fr')).toBe('Premier caca du jour (~07:10)');
  });
});
