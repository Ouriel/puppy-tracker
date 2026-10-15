/**
 * Golden (characterization) test for `calculatePredictions`.
 *
 * It freezes what the engine CURRENTLY outputs for a set of fixed scenarios, so that any change to the
 * prediction model shows up as an explicit diff in `__snapshots__/predictions_golden.test.ts.snap`.
 * The snapshot is a record of behaviour, not a spec: it also freezes the outputs of known issues left open
 * (R1, R4, R5, R8 and the rest of R11 in .agents/plans/2026-10-13-remediation-plan.md; R3, R7, NEW-1 and the
 * R11 clock-time fix landed in Phase 3a). Example: on 2027-03-28 04:00 and 04:15 the food portion is 0 g because
 * the 04:00 logical-day cutoff is computed as now - 4 h, which is still the previous day after the spring-forward change.
 * Known issue R1 x R7 ('night: pre-bed walk at 23:17, 10 Sept'): the learned bedtime is 18:00, then 19:10 (R1/INV-1,
 * Phase 8), while the dog is logged until 23:17. The R7 cap (missed meal kept until bedtime + 1 h) therefore drops the
 * missed meal at 19:00: 10 Sept 20:00-23:30 show night 'Breakfast' with 100 of 240 g eaten, and 11 Sept goes safe at 20:00,
 * night at 22:00, then overdue 'Meal 3 of 3' at 23:30 once the 23:05 log moves bedtime to 23:05. Phase 8 should move these lines.
 *
 * A snapshot diff is EXPECTED when the model is changed on purpose (Phase 3a/3b engine fixes, Phase 8 refactor).
 * - Review the diff line by line in the PR and explain each moved value in the PR description.
 * - A pure refactor must leave the snapshot unchanged.
 * - Never run `vitest -u` blindly to make this file green. Once every moved line is reviewed and explained:
 *   `TZ=Europe/Paris npx vitest run src/utils/__tests__/predictions_golden.test.ts -u`
 *
 * How it works: each scenario is replayed at a grid of Europe/Paris reference times (every 2 h, plus 00:30,
 * 04:15, 05:30, 07:00 and 23:30, plus scenario-specific times). At each time the engine only sees the logs
 * up to that time, newest first, like the app. Grid times before a scenario's first log are skipped.
 * Timestamps carry explicit offsets, so the output does not depend on the host timezone.
 */
import { describe, it, expect } from 'vitest';
import { calculatePredictions } from '../predictions';
import type { Activity, ActivityType, PuppyProfile } from '../../types';
import { act, at, PISTACHE, newestFirst } from './fixtures';

const TIME_ZONE = 'Europe/Paris';

/** Every 2 h, plus the night and early-morning times where the night/morning logic switches. */
const GRID_CLOCK_TIMES = [
  '00:00', '00:30', '02:00', '04:00', '04:15', '05:30', '06:00', '07:00', '08:00', '10:00',
  '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '23:30',
];

/** The Paris instant for a wall-clock time; the first occurrence when ambiguous, undefined when skipped by DST. */
function parisTime(day: string, clockTime: string): Date | undefined {
  return ['+02:00', '+01:00']
    .map((offset) => new Date(`${day}T${clockTime}:00${offset}`))
    .find((candidate) => at(candidate) === `${day} ${clockTime}`);
}

function paris(day: string, clockTime: string): Date {
  const instant = parisTime(day, clockTime);
  if (!instant) throw new Error(`${day} ${clockTime} does not exist in ${TIME_ZONE}`);
  return instant;
}

function addDays(day: string, count: number): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth + count)).toISOString().slice(0, 10);
}

type LogEntry = [ActivityType, string, Partial<Activity>?];

/** Logs of one Paris calendar day, from 'HH:mm' wall-clock entries. */
function dayLogs(day: string, entries: LogEntry[]): Activity[] {
  return entries.map(([type, clockTime, extra]) => act(type, paris(day, clockTime).toISOString(), extra));
}

/** One day of the 7-day routine from predictions.test.ts (generateRealisticMultiDayDataset). */
function routineDay(day: string, mealGrams = 80): Activity[] {
  return dayLogs(day, [
    ['food', '07:00', { quantityGrams: mealGrams }],
    ['pee', '07:15'],
    ['poop', '07:45'],
    ['pee', '10:00'],
    ['food', '12:00', { quantityGrams: mealGrams }],
    ['pee', '12:20'],
    ['pee', '15:30'],
    ['food', '19:00', { quantityGrams: mealGrams }],
    ['poop', '19:35'],
    ['pee', '22:30'],
  ]);
}

function routineDays(firstDay: string, count: number): Activity[] {
  return Array.from({ length: count }, (_unused, index) => routineDay(addDays(firstDay, index))).flat();
}

interface GoldenScenario {
  name: string;
  profile: PuppyProfile;
  activities: Activity[];
  /** The two Paris calendar days the grid covers. */
  days: [string, string];
  extraTimes?: Date[];
}

/** Pistache's routine 8–14 Aug 2026 (she is ~4.4 months old), used as history by the targeted scenarios. */
const ROUTINE_WEEK = routineDays('2026-08-08', 7);

const SCENARIOS: GoldenScenario[] = [
  {
    name: 'routine week: baseline, night, goal',
    profile: PISTACHE,
    activities: ROUTINE_WEEK,
    days: ['2026-08-13', '2026-08-14'],
  },
  {
    name: 'post-meal: 8-week puppy',
    profile: { ...PISTACHE, birthDate: '2026-06-19' },
    activities: [
      ...dayLogs('2026-08-15', [
        ['pee', '06:50'],
        ['food', '07:00', { quantityGrams: 80 }],
        ['poop', '09:30'],
        ['pee', '10:00'],
        ['food', '12:00', { quantityGrams: 80 }],
        ['pee', '14:30'],
        ['food', '19:00', { quantityGrams: 80 }],
        ['poop', '20:30'],
        ['pee', '22:30'],
      ]),
      ...routineDay('2026-08-16'),
    ],
    days: ['2026-08-15', '2026-08-16'],
    extraTimes: ['07:10', '07:30', '12:10', '12:30', '19:10', '19:40'].map((clockTime) => paris('2026-08-15', clockTime)),
  },
  {
    // Real logs of 3 days, moved to 8–10 Sept (night_mode_and_age_transitions.test.ts), then a regular 11 Sept.
    name: 'night: pre-bed walk at 23:17, 10 Sept',
    profile: PISTACHE,
    activities: [
      ...dayLogs('2026-09-08', [['poop', '08:30'], ['poop', '18:00']]),
      ...dayLogs('2026-09-09', [['poop', '08:30'], ['poop', '18:00']]),
      ...dayLogs('2026-09-10', [
        ['pee', '08:37'],
        ['poop', '08:43'],
        ['food', '09:29', { quantityGrams: 100 }],
        ['pee', '13:46'],
        ['poop', '13:52'],
        ['poop', '23:17'],
        ['pee', '23:18'],
      ]),
      ...dayLogs('2026-09-11', [
        ['pee', '08:41'],
        ['poop', '08:47'],
        ['food', '09:30', { quantityGrams: 100 }],
        ['pee', '13:40'],
        ['food', '18:30', { quantityGrams: 100 }],
        ['pee', '18:45'],
        ['poop', '19:10'],
        ['pee', '23:05'],
      ]),
    ],
    days: ['2026-09-10', '2026-09-11'],
  },
  {
    // night_mode_and_age_transitions.test.ts: 6-week puppy, pee at 22:00 then a mid-night pee at 02:00.
    name: 'young puppy night: 6 weeks, 02:00 pee',
    profile: { ...PISTACHE, birthDate: '2026-07-02' },
    activities: [...dayLogs('2026-08-15', [['pee', '22:00']]), ...dayLogs('2026-08-16', [['pee', '02:00']])],
    days: ['2026-08-15', '2026-08-16'],
    extraTimes: [paris('2026-08-15', '23:00'), paris('2026-08-16', '02:30')],
  },
  {
    name: 'diarrhea: loose stools, one at 01:30',
    profile: PISTACHE,
    activities: [
      ...ROUTINE_WEEK,
      ...dayLogs('2026-08-15', [
        ['pee', '07:10'],
        ['poop', '07:30', { stoolConsistency: 'diarrhea' }],
        ['food', '07:45', { quantityGrams: 80 }],
        ['poop', '09:00', { notes: 'liquide' }],
        ['pee', '10:00'],
        ['food', '12:00', { quantityGrams: 80 }],
        ['poop', '12:45', { stoolConsistency: 'soft' }],
        ['pee', '15:30'],
        ['food', '19:00', { quantityGrams: 80 }],
        ['pee', '22:30'],
      ]),
      ...dayLogs('2026-08-16', [['poop', '01:30', { stoolConsistency: 'diarrhea' }]]),
      ...routineDay('2026-08-16'),
    ],
    days: ['2026-08-15', '2026-08-16'],
    extraTimes: [paris('2026-08-16', '01:45'), paris('2026-08-16', '02:45')],
  },
  {
    // predictions.test.ts: hard stool at 21:11. A normal stool follows within 16 h, so R3 is not frozen here.
    name: 'hard stool at 21:11, normal at 11:30',
    profile: PISTACHE,
    activities: [
      ...ROUTINE_WEEK,
      ...dayLogs('2026-08-14', [['poop', '21:11', { stoolConsistency: 'hard' }]]),
      ...routineDay('2026-08-15').filter((activity) => activity.timestamp !== paris('2026-08-15', '07:45').toISOString()),
      ...dayLogs('2026-08-15', [['poop', '11:30', { stoolConsistency: 'normal' }]]),
      ...routineDay('2026-08-16'),
    ],
    days: ['2026-08-15', '2026-08-16'],
    extraTimes: [paris('2026-08-14', '21:30'), paris('2026-08-14', '23:30')],
  },
  {
    name: 'goal reached: 240 g by noon',
    profile: PISTACHE,
    activities: [
      ...ROUTINE_WEEK,
      ...dayLogs('2026-08-15', [
        ['pee', '07:15'],
        ['food', '07:30', { quantityGrams: 120 }],
        ['poop', '07:50'],
        ['pee', '10:00'],
        ['food', '12:00', { quantityGrams: 120 }],
        ['pee', '12:20'],
        ['pee', '15:30'],
        ['poop', '19:35'],
        ['pee', '22:30'],
      ]),
      ...routineDay('2026-08-16'),
    ],
    days: ['2026-08-15', '2026-08-16'],
  },
  {
    name: 'remaining portion: 3 meals of 50 g',
    profile: PISTACHE,
    activities: [...ROUTINE_WEEK, ...routineDay('2026-08-15', 50), ...routineDay('2026-08-16')],
    days: ['2026-08-15', '2026-08-16'],
    extraTimes: [paris('2026-08-15', '19:30'), paris('2026-08-15', '21:00')],
  },
  {
    name: 'empty history',
    profile: PISTACHE,
    activities: [],
    days: ['2026-08-15', '2026-08-16'],
  },
  {
    // Clocks go back 03:00 CEST -> 02:00 CET on 25 Oct 2026: 02:30 happens twice.
    name: 'DST autumn 2026: routine across 25 Oct',
    profile: PISTACHE,
    activities: routineDays('2026-10-18', 9),
    days: ['2026-10-25', '2026-10-26'],
    extraTimes: ['2026-10-25T01:30:00+02:00', '2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00', '2026-10-25T03:30:00+01:00'].map(
      (iso) => new Date(iso)
    ),
  },
  {
    // Clocks go forward 02:00 CET -> 03:00 CEST on 28 Mar 2027: 02:00 does not exist and is skipped.
    name: 'DST spring 2027: routine across 28 Mar',
    profile: PISTACHE,
    activities: routineDays('2027-03-21', 9),
    days: ['2027-03-28', '2027-03-29'],
    extraTimes: [new Date('2027-03-28T01:30:00+01:00'), new Date('2027-03-28T03:30:00+02:00')],
  },
];

function referenceTimes(scenario: GoldenScenario): Date[] {
  const firstLogTime = scenario.activities.length ? Math.min(...scenario.activities.map((activity) => Date.parse(activity.timestamp))) : -Infinity;
  const candidates = [
    ...scenario.days.flatMap((day) => GRID_CLOCK_TIMES.map((clockTime) => parisTime(day, clockTime))),
    ...(scenario.extraTimes ?? []),
  ].filter((candidate): candidate is Date => candidate !== undefined && candidate.getTime() >= firstLogTime);
  const uniqueTimes = [...new Set(candidates.map((candidate) => candidate.getTime()))];
  return uniqueTimes.sort((first, second) => first - second).map((time) => new Date(time));
}

function when(date: Date | null | undefined): string {
  return date ? at(date) : '-';
}

function clock(minutesSinceMidnight: number): string {
  return `${String(Math.floor(minutesSinceMidnight / 60)).padStart(2, '0')}:${String(minutesSinceMidnight % 60).padStart(2, '0')}`;
}

function utcOffset(date: Date): string {
  const offsetHours = (Date.parse(`${at(date).replace(' ', 'T')}:00Z`) - date.getTime()) / 3_600_000;
  return `UTC+${offsetHours}`;
}

/** Four lines per reference time: context, then pee, poop and food. */
function describePredictions(scenario: GoldenScenario, referenceTime: Date): string[] {
  const visibleLogs = newestFirst(scenario.activities.filter((activity) => Date.parse(activity.timestamp) <= referenceTime.getTime()));
  const result = calculatePredictions(visibleLogs, scenario.profile, referenceTime, TIME_ZONE);
  const sleep = result.sleepSchedule;
  const meals = result.mealSchedule;
  const mealsLabel = meals ? `${clock(meals.breakfastMins)} ${clock(meals.lunchMins)} ${clock(meals.dinnerMins)}` : '-';

  return [
    `== ${at(referenceTime)} ${utcOffset(referenceTime)} | ${visibleLogs.length} logs | sleep ${sleep?.bedtimeStr}-${sleep?.wakeupStr} | meals ${mealsLabel}`,
    `pee  ${when(result.nextPeeExpectedAt)} ${result.peeMode} ${result.peeUrgency} ±${result.peeDeltaMins} std ${when(result.standardPeeExpectedAt)} | ${result.peeReason}`,
    `poop ${when(result.nextPoopExpectedAt)} ${result.poopMode} ${result.poopUrgency} ±${result.poopDeltaMins} std ${when(result.standardPoopExpectedAt)} | ${result.poopReason}`,
    `food ${when(result.nextFoodExpectedAt)} ${result.foodMode} ${result.foodUrgency} ±${result.foodDeltaMins} ${result.portionGrams}g | ${result.foodReason}`,
  ];
}

describe('calculatePredictions golden snapshot (Europe/Paris replay)', () => {
  it.each(SCENARIOS)('$name', (scenario) => {
    expect(referenceTimes(scenario).flatMap((referenceTime) => describePredictions(scenario, referenceTime))).toMatchSnapshot();
  });
});
