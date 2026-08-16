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
 * Parses ISO timestamp string or Date object into a JavaScript Date object
 */
export function parseIsoDate(timestamp: string | Date): Date {
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
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
