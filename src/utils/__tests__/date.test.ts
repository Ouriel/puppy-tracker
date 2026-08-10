import { describe, it, expect } from 'vitest';
import {
  formatLocalDate,
  getLocalDatetimeString,
  isSameLocalDate,
  formatRelativeTime,
  formatMinutesToXhXX,
  parseIsoDate,
  getLocalHour,
  formatLocalTime,
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

  it('getLocalDatetimeString formats date for datetime-local input', () => {
    const d = new Date(2026, 6, 29, 14, 15);
    expect(getLocalDatetimeString(d)).toBe('2026-07-29T14:15');
  });

  it('isSameLocalDate correctly identifies same local day', () => {
    const d1 = new Date(2026, 6, 29, 1, 30);
    const d2 = new Date(2026, 6, 29, 23, 45);
    const d3 = new Date(2026, 6, 30, 0, 15);

    expect(isSameLocalDate(d1, d2)).toBe(true);
    expect(isSameLocalDate(d1, d3)).toBe(false);
  });

  it('formatRelativeTime returns Today and Yesterday correctly', () => {
    const now = new Date();
    const todayLog = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString();
    const formattedToday = formatRelativeTime(todayLog, 'en', { today: 'Today', yesterday: 'Yesterday' });
    expect(formattedToday).toContain('Today');

    const yesterdayLog = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0).toISOString();
    const formattedYesterday = formatRelativeTime(yesterdayLog, 'en', { today: 'Today', yesterday: 'Yesterday' });
    expect(formattedYesterday).toContain('Yesterday');
  });

  it('formatRelativeTime gracefully handles unparseable date strings with localized fallback', () => {
    const resFr = formatRelativeTime('Invalid Date', 'fr', { today: 'Aujourd\'hui', yesterday: 'Hier' });
    expect(resFr).toContain('Aujourd\'hui');
    expect(resFr).not.toContain('Invalid');

    const resEn = formatRelativeTime('corrupted', 'en', { today: 'Today', yesterday: 'Yesterday' });
    expect(resEn).toContain('Today');
    expect(resEn).not.toContain('Invalid');
  });

  it('formatMinutesToXhXX formats minutes < 60 as minutes and >= 60 as XhXX', () => {
    expect(formatMinutesToXhXX(45)).toBe('45m');
    expect(formatMinutesToXhXX(60)).toBe('1h');
    expect(formatMinutesToXhXX(75)).toBe('1h15');
    expect(formatMinutesToXhXX(120)).toBe('2h');
    expect(formatMinutesToXhXX(125)).toBe('2h05');
    expect(formatMinutesToXhXX(150)).toBe('2h30');
  });

  it('parseIsoDate safely parses ISO strings, Date objects, and date-only strings', () => {
    const dOnly = parseIsoDate('2026-03-27');
    expect(dOnly.getFullYear()).toBe(2026);
    expect(dOnly.getMonth()).toBe(2); // March = index 2

    const isoStr = '2026-08-09T21:10:14.280Z';
    const parsedIso = parseIsoDate(isoStr);
    expect(parsedIso.toISOString()).toBe(isoStr);

    const dObj = new Date(2026, 7, 9, 15, 30);
    expect(parseIsoDate(dObj)).toBe(dObj);
  });
});
