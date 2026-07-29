/**
 * Timezone-safe & Localized Date Handling Utilities for PupPace
 */

/**
 * Returns YYYY-MM-DD in local timezone (never shifts date near midnight due to UTC)
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
 * Parses ISO timestamp string or standard date string safely into a Date object
 */
export function parseIsoDate(timestamp: string): Date {
  if (!timestamp) return new Date();
  const formatted = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  return new Date(formatted);
}

/**
 * Checks whether two Date objects (or ISO strings) fall on the exact same local calendar day
 */
export function isSameLocalDate(dateA: Date | string, dateB: Date | string): boolean {
  const dA = typeof dateA === 'string' ? parseIsoDate(dateA) : dateA;
  const dB = typeof dateB === 'string' ? parseIsoDate(dateB) : dateB;
  return formatLocalDate(dA) === formatLocalDate(dB);
}

/**
 * Formats timestamps for timeline activity feeds with precise local start-of-day boundaries
 */
export function formatRelativeTime(
  isoString: string,
  lang: 'en' | 'fr' = 'en',
  labels = { today: 'Today', yesterday: 'Yesterday' }
): string {
  const date = parseIsoDate(isoString);
  const now = new Date();

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const timeStr = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
