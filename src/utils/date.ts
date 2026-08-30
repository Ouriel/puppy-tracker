/**
 * Timezone-safe & Localized Date Handling Utilities for PupPace
 */

/**
 * Gets user's IANA timezone string safely (e.g. 'Europe/Paris', 'America/New_York')
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

/**
 * Gets local hour (0-23) of a Date object in a specific timezone
 */
export function getLocalHour(date: Date = new Date(), timeZone?: string): number {
  const tz = timeZone || getUserTimezone();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    return parseInt(formatter.format(date), 10) % 24;
  } catch {
    return date.getHours();
  }
}

/**
 * Gets local decimal hour (e.g. 07:30 -> 7.5, 22:45 -> 22.75) of a Date object in a specific timezone
 */
export function getLocalDecimalHour(date: Date = new Date(), timeZone?: string): number {
  const tz = timeZone || getUserTimezone();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
      const p = parts.find((part) => part.type === type);
      return p ? parseInt(p.value, 10) : 0;
    };
    const hour = getPart('hour') % 24;
    const minute = getPart('minute');
    const second = getPart('second');
    return hour + minute / 60 + second / 3600;
  } catch {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  }
}

/**
 * Returns YYYY-MM-DD in specified timezone (defaulting to user timezone)
 */
export function formatLocalDate(date: Date = new Date(), timeZone?: string): string {
  const tz = timeZone || getUserTimezone();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Returns YYYY-MM-DDTHH:mm in local timezone for <input type="datetime-local">
 */
export function getLocalDatetimeString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a Date object into local HH:mm string in target timezone (e.g. '07:25' or '23:09')
 */
export function formatLocalTime(date: Date, timeZone?: string): string {
  const tz = timeZone || getUserTimezone();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Creates a Date object for a specific YYYY-MM-DD and HH:mm in a specified IANA timezone
 */
export function createDateInTimezone(dateStr: string, timeStr: string, timeZone?: string): Date {
  const tz = timeZone || getUserTimezone();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const utcDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0));

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

    let formattedHour = getPart('hour');
    if (formattedHour === 24) formattedHour = 0;
    const targetTimeInTz = Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      formattedHour,
      getPart('minute'),
      getPart('second')
    );

    const offsetMs = targetTimeInTz - utcDate.getTime();
    return new Date(utcDate.getTime() - offsetMs);
  } catch {
    return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
  }
}

/**
 * Calculates a specific occurrence of a clock hour (e.g. 7.3 -> 07:18) in target timezone
 */
export function getOccurrenceOfClockTimeInTimezone(
  referenceDate: Date,
  targetHourDecimal: number,
  timeZone?: string,
  daysOffset: number = 0
): Date {
  const tz = timeZone || getUserTimezone();
  const targetDay = new Date(referenceDate.getTime() + daysOffset * 24 * 3600 * 1000);
  const dateStr = formatLocalDate(targetDay, tz);
  const h = Math.floor(targetHourDecimal);
  const m = Math.round((targetHourDecimal - h) * 60);
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return createDateInTimezone(dateStr, timeStr, tz);
}

/**
 * Parses ISO timestamp string or Date object into a JavaScript Date object
 */
export function parseIsoDate(timestamp: string | Date): Date {
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

const LOGICAL_DAY_CUTOFF_HOURS = 4;

function getLogicalDate(date: Date | string = new Date(), cutoffHours: number = LOGICAL_DAY_CUTOFF_HOURS): Date {
  const d = typeof date === 'string' ? parseIsoDate(date) : date;
  return new Date(d.getTime() - cutoffHours * 3600 * 1000);
}

/**
 * Returns YYYY-MM-DD for the logical waking day of a timestamp
 */
export function formatLogicalDate(
  date: Date | string = new Date(),
  timeZone?: string,
  cutoffHours: number = LOGICAL_DAY_CUTOFF_HOURS
): string {
  return formatLocalDate(getLogicalDate(date, cutoffHours), timeZone);
}

/**
 * Checks whether two Date objects (or ISO strings) fall on the exact same local calendar day
 */
export function isSameLocalDate(dateA: Date | string, dateB: Date | string, timeZone?: string): boolean {
  const dA = typeof dateA === 'string' ? parseIsoDate(dateA) : dateA;
  const dB = typeof dateB === 'string' ? parseIsoDate(dateB) : dateB;
  return formatLocalDate(dA, timeZone) === formatLocalDate(dB, timeZone);
}

/**
 * Checks whether two Date objects (or ISO strings) fall on the exact same logical waking day (4:00 AM cutoff)
 */
export function isSameLogicalDate(
  dateA: Date | string,
  dateB: Date | string,
  timeZone?: string,
  cutoffHours: number = LOGICAL_DAY_CUTOFF_HOURS
): boolean {
  return formatLogicalDate(dateA, timeZone, cutoffHours) === formatLogicalDate(dateB, timeZone, cutoffHours);
}

/**
 * Formats timestamps for timeline activity feeds with precise local start-of-day boundaries
 */
export function formatRelativeTime(
  isoString: string | Date,
  lang: 'en' | 'fr' = 'en',
  labels = { today: 'Today', yesterday: 'Yesterday' }
): string {
  const date = parseIsoDate(isoString);
  if (isNaN(date.getTime())) {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    const nowTime = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${labels.today} ${nowTime}`;
  }
  const now = new Date();

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const timeStr = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: lang !== 'fr',
  });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const dateTime = date.getTime();

  if (dateTime >= startOfToday) {
    return `${labels.today} ${timeStr}`;
  } else if (dateTime >= startOfYesterday) {
    return `${labels.yesterday} ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
    return `${dateStr} ${timeStr}`;
  }
}

/**
 * Formats a Date object or ISO string into localized short date format (e.g. 'Nov 12' or '12 nov.')
 */
export function formatShortDate(date: string | Date, lang: 'en' | 'fr' = 'en'): string {
  const parsed = parseIsoDate(date);
  if (isNaN(parsed.getTime())) return '';
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/**
 * Formats minute durations into human-readable XhXX format when >= 60 (e.g. 75m -> 1h15, 120m -> 2h, 125m -> 2h05)
 */
export function formatMinutesToXhXX(minutes: number): string {
  const totalMins = Math.round(minutes);
  if (totalMins < 60) {
    return `${totalMins}m`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h${String(mins).padStart(2, '0')}`;
}
