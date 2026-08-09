import { describe, it, expect } from 'vitest';
import { formatLocalDate, getLocalDatetimeString, isSameLocalDate, formatRelativeTime, formatMinutesToXhXX } from '../date';

describe('date utility module', () => {
  it('formatLocalDate formats date in local YYYY-MM-DD', () => {
    const d = new Date(2026, 6, 29, 1, 30); // July 29 2026 01:30 AM local
    expect(formatLocalDate(d)).toBe('2026-07-29');
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

  it('formatMinutesToXhXX formats minutes < 60 as minutes and >= 60 as XhXX', () => {
    expect(formatMinutesToXhXX(45)).toBe('45m');
    expect(formatMinutesToXhXX(60)).toBe('1h');
    expect(formatMinutesToXhXX(75)).toBe('1h15');
    expect(formatMinutesToXhXX(120)).toBe('2h');
    expect(formatMinutesToXhXX(125)).toBe('2h05');
    expect(formatMinutesToXhXX(150)).toBe('2h30');
  });
});
