import type { HealthRecord } from '../types';
import type { TranslationKeys } from '../i18n/types';
import type { Language } from '../i18n';
import { addDays } from './health';

type DueHealthRecord = HealthRecord & { boosterDate: string };

/** RFC 5545 TEXT: backslash, comma, semicolon and newline escaped. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, (character) => `\\${character}`);
}

const encoder = new TextEncoder();

/** RFC 5545 folding: at most 75 octets per line, the leading space of a continuation included, never inside a character. */
function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let currentOctets = 0;
  for (const character of line) {
    const characterOctets = encoder.encode(character).length;
    if (currentOctets + characterOctets > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      currentOctets = 0;
    }
    current += character;
    currentOctets += characterOctets;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const slugify = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40).replace(/-+$/, '');

/** The event's date, title and description, shared by the .ics and the Google Calendar link. */
function dueDateEvent(record: DueHealthRecord, dogName: string, t: TranslationKeys, lang: Language) {
  const dueDate = record.boosterDate.slice(0, 10);
  const productName = record.productName || record.name;
  const title = t.health.calendarEventTitle.replace('{dog}', () => dogName).replace('{name}', () => productName);
  const givenOn = new Date(`${record.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' });
  const description = [`${t.health.givenOn} ${givenOn}`, record.vetClinic?.trim() && `${t.health.clinic}${t.common.colon} ${record.vetClinic.trim()}`].filter(Boolean).join('\n');
  // All day: the end date is exclusive
  return { dueDate, productName, title, description, start: dueDate.replace(/-/g, ''), end: addDays(dueDate, 1).replace(/-/g, '') };
}

/**
 * One all-day event on a vaccine or deworming's next date, with a reminder the day before at 09:00 and one on the day
 * at 09:00. The UID is the record and the date: added again, most calendars update the event instead of adding a second.
 */
export function buildDueDateIcs(record: DueHealthRecord, dogName: string, t: TranslationKeys, lang: Language): { filename: string; content: string } {
  const { dueDate, productName, title, description, start, end } = dueDateEvent(record, dogName, t, lang);
  const summary = escapeText(title);
  const alarm = (trigger: string) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, `TRIGGER;RELATED=START:${trigger}`, 'END:VALARM'];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PupPace//Health passport//EN',
    'BEGIN:VEVENT',
    `UID:${record.id}-${dueDate}@puppace`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...alarm('-PT15H'),
    ...alarm('PT9H'),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return {
    filename: `${slugify(dogName) || 'dog'}-${slugify(productName) || 'health'}-${dueDate}.ics`,
    content: lines.map(foldLine).join('\r\n') + '\r\n',
  };
}

/**
 * Downloads the event as a text/calendar Blob through an anchor: iOS Safari is reported (not tried on a device) to
 * open its "Add to Calendar" preview (it refuses data:text/calendar links since iOS 26.6). The URL is freed a minute
 * later, not at once: Safari reads the file after this handler returns.
 */
export function downloadDueDateIcs(record: DueHealthRecord, dogName: string, t: TranslationKeys, lang: Language): void {
  const { filename, content } = buildDueDateIcs(record, dogName, t, lang);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The same event as Google Calendar's own "new event" page: on Android, a downloaded .ics often opens nothing (the Google
 * Calendar app does not import files). The link cannot set reminders: the user's default notifications for all-day events apply.
 */
export function buildGoogleCalendarUrl(record: DueHealthRecord, dogName: string, t: TranslationKeys, lang: Language): string {
  const { title, description, start, end } = dueDateEvent(record, dogName, t, lang);
  const query = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${start}/${end}`, details: description });
  return `https://calendar.google.com/calendar/render?${query}`;
}

export const isAndroid = () => /Android/i.test(navigator.userAgent);
