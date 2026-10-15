import { describe, it, expect, vi } from 'vitest';
import {
  formatLocalDate,
  formatLogicalDate,
  isSameLogicalDate,
  getLocalDatetimeString,
  formatRelativeTime,
  formatMinutesToXhXX,
  parseIsoDate,
  getLocalHour,
  getLocalDecimalHour,
  formatLocalTime,
  getOccurrenceOfClockTimeInTimezone,
  formatShortDate,
} from '../date';

describe('date utility module — comprehensive test suite', () => {
  it('formatLocalDate formats date in local YYYY-MM-DD for specified timezones', () => {
    const d = new Date('2026-08-09T22:30:00.000Z');
    expect(formatLocalDate(d, 'Europe/Paris')).toBe('2026-08-10'); // 00:30 CEST next day
    expect(formatLocalDate(d, 'America/New_York')).toBe('2026-08-09'); // 18:30 EDT same day
  });

  it('getLocalHour extracts exact local hour across IANA timezones', () => {
    const d = new Date('2026-08-09T21:00:00.000Z');
    expect(getLocalHour(d, 'Europe/Paris')).toBe(23); // 23:00 CEST
    expect(getLocalHour(d, 'America/New_York')).toBe(17); // 17:00 EDT
    expect(getLocalHour(d, 'Asia/Tokyo')).toBe(6); // 06:00 JST next morning
  });

  it('formatLocalTime formats HH:mm string in target timezone', () => {
    const d = new Date('2026-08-09T21:15:00.000Z');
    expect(formatLocalTime(d, 'Europe/Paris')).toBe('23:15');
    expect(formatLocalTime(d, 'America/New_York')).toBe('17:15');
  });

  it('builds each Intl.DateTimeFormat once and reuses it on later calls (P5 formatter cache)', () => {
    const date = new Date('2026-08-09T21:15:00.000Z');
    // getUserTimezone is read live on purpose (follows the device), so it is not part of the cache
    const formatAll = () => [
      formatLocalDate(date, 'Asia/Tokyo'),
      getLocalHour(date, 'Asia/Tokyo'),
      getLocalDecimalHour(date, 'Asia/Tokyo'),
      formatLocalTime(date, 'Asia/Tokyo'),
      getOccurrenceOfClockTimeInTimezone(date, 7.5, 'Asia/Tokyo').toISOString(),
    ];
    expect(formatAll()).toEqual(['2026-08-10', 6, 6.25, '06:15', '2026-08-09T22:30:00.000Z']);

    const constructorSpy = vi.spyOn(Intl, 'DateTimeFormat');
    try {
      expect(formatAll()).toEqual(['2026-08-10', 6, 6.25, '06:15', '2026-08-09T22:30:00.000Z']);
      expect(constructorSpy).not.toHaveBeenCalled();
    } finally {
      constructorSpy.mockRestore();
    }
  });

  it('getLocalDatetimeString formats date for datetime-local input', () => {
    const d = new Date(2026, 6, 29, 14, 15);
    expect(getLocalDatetimeString(d)).toBe('2026-07-29T14:15');
  });

  it('formatRelativeTime returns Today and Yesterday correctly', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 9, 14, 0));
    try {
      const todayLog = new Date(2026, 7, 9, 10, 0).toISOString();
      const formattedToday = formatRelativeTime(todayLog, 'en', { today: 'Today', yesterday: 'Yesterday' });
      expect(formattedToday).toContain('Today');

      const yesterdayLog = new Date(2026, 7, 8, 20, 0).toISOString();
      const formattedYesterday = formatRelativeTime(yesterdayLog, 'en', { today: 'Today', yesterday: 'Yesterday' });
      expect(formattedYesterday).toContain('Yesterday');

      const olderLog = new Date(2026, 7, 5, 9, 30).toISOString();
      expect(formatRelativeTime(olderLog, 'fr')).toBe('5 août 09:30');
      expect(formatRelativeTime(olderLog, 'en')).toBe('Aug 5 09:30 AM');
    } finally {
      vi.useRealTimers();
    }
  });

  it('formatRelativeTime gracefully handles unparseable date strings with localized fallback', () => {
    const resFr = formatRelativeTime('Invalid Date', 'fr', { today: 'Aujourd\'hui', yesterday: 'Hier' });
    expect(resFr).toContain('Aujourd\'hui');
    expect(resFr).not.toContain('Invalid');

    const resEn = formatRelativeTime('corrupted', 'en', { today: 'Today', yesterday: 'Yesterday' });
    expect(resEn).toContain('Today');
    expect(resEn).not.toContain('Invalid');
  });

  it('formatMinutesToXhXX formats minutes into XhXX format when >= 60', () => {
    expect(formatMinutesToXhXX(45)).toBe('45m');
    expect(formatMinutesToXhXX(60)).toBe('1h');
    expect(formatMinutesToXhXX(75)).toBe('1h15');
    expect(formatMinutesToXhXX(120)).toBe('2h');
    expect(formatMinutesToXhXX(125)).toBe('2h05');
    expect(formatMinutesToXhXX(150)).toBe('2h30');
  });

  describe('Logical Day Boundary (4:00 AM cutoff)', () => {
    it('formatLogicalDate attributes post-midnight activities (00:00 to 03:59 AM) to previous calendar day', () => {
      // 01:30 AM on Tuesday August 11 -> logical day is Monday August 10
      const nightDate = new Date(2026, 7, 11, 1, 30);
      expect(formatLogicalDate(nightDate)).toBe('2026-08-10');

      // 03:55 AM on Tuesday August 11 -> logical day is Monday August 10
      const lateNightDate = new Date(2026, 7, 11, 3, 55);
      expect(formatLogicalDate(lateNightDate)).toBe('2026-08-10');

      // 04:00 AM on Tuesday August 11 -> logical day is Tuesday August 11
      const morningDate = new Date(2026, 7, 11, 4, 0);
      expect(formatLogicalDate(morningDate)).toBe('2026-08-11');

      // 10:00 AM on Tuesday August 11 -> logical day is Tuesday August 11
      const middayDate = new Date(2026, 7, 11, 10, 0);
      expect(formatLogicalDate(middayDate)).toBe('2026-08-11');
    });

    it('isSameLogicalDate correctly groups evening and post-midnight outings together', () => {
      const eveningWalk = new Date(2026, 7, 10, 22, 30); // 22:30 Monday
      const bedtimePee = new Date(2026, 7, 11, 0, 45); // 00:45 Tuesday morning (post-midnight)
      const nextMorningPee = new Date(2026, 7, 11, 7, 30); // 07:30 Tuesday morning (new waking day)

      expect(isSameLogicalDate(eveningWalk, bedtimePee)).toBe(true);
      expect(isSameLogicalDate(eveningWalk, nextMorningPee)).toBe(false);
      expect(isSameLogicalDate(bedtimePee, nextMorningPee)).toBe(false);
    });
  });

  it('parseIsoDate safely parses ISO strings, Date objects, and date-only strings', () => {
    // A date-only string is UTC midnight (ECMAScript rule), whatever the host timezone
    const dOnly = parseIsoDate('2026-03-27');
    expect(dOnly.toISOString()).toBe('2026-03-27T00:00:00.000Z');

    const isoStr = '2026-08-09T21:10:14.280Z';
    const parsedIso = parseIsoDate(isoStr);
    expect(parsedIso.toISOString()).toBe(isoStr);

    const dObj = new Date(2026, 7, 9, 15, 30);
    expect(parseIsoDate(dObj)).toBe(dObj);
  });

  // Rest of R11, deferred in Phase 3a (no effect in the real-data replay)
  it.todo('formatRelativeTime: "Yesterday" across a DST change (it subtracts 24 h from local midnight)');
  it.todo('createDateInTimezone: second offset pass for wall-clock times next to a DST change');
  it.todo('formatLogicalDate: 04:00 cutoff on the wall clock, not now - 4 h (04:00-05:00 on the spring-forward day is still the previous day)');
});

describe('formatShortDate: health dates (backlog item 3)', () => {
  it('shows a calendar date in French, with the year only when it is not this year', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
    try {
      expect(formatShortDate('2026-09-27', 'fr')).toBe('27 sept.');
      expect(formatShortDate('2027-07-01', 'fr')).toBe('1 juil. 2027');
      expect(formatShortDate('2026-09-27', 'en')).toBe('Sep 27');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a calendar date as that same day west of UTC', () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(formatShortDate('2026-09-27', 'en')).toMatch(/^Sep 27\b/);
    } finally {
      process.env.TZ = previousTimeZone;
    }
  });
});
