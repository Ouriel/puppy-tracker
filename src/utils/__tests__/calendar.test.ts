// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HealthRecord } from '../../types';
import { buildDueDateIcs, buildGoogleCalendarUrl, downloadDueDateIcs, isAndroid } from '../calendar';
import { en } from '../../i18n/en';
import { fr } from '../../i18n/fr';

// A made-up dog and records. Today: 15 Oct 2026, Paris.

const credelio: HealthRecord & { boosterDate: string } = {
  id: 'hr-credelio',
  householdId: 'hh-1',
  puppyId: 'pup-1',
  type: 'deworming',
  name: 'Credelio Plus',
  productName: 'Credelio Plus',
  date: '2026-09-20',
  boosterDate: '2026-10-20',
};

const chppiL4 = 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)';
const vaccine: HealthRecord & { boosterDate: string } = {
  id: 'hr-chppi',
  householdId: 'hh-1',
  puppyId: 'pup-1',
  type: 'vaccination',
  name: chppiL4,
  date: '2026-07-01',
  boosterDate: '2027-07-01',
  vetClinic: 'Clinique des Lilas',
};

const octets = (line: string) => new TextEncoder().encode(line).length;
const unfold = (content: string) => content.replace(/\r\n /g, '');
const property = (content: string, name: string) =>
  unfold(content).split('\r\n').find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('buildDueDateIcs: one all-day event on the next date', () => {
  it('is a VCALENDAR 2.0 with a PRODID and one VEVENT, every line ending in CRLF', () => {
    const { content } = buildDueDateIcs(credelio, 'Rex', en, 'en');

    expect(content.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true);
    expect(content.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(content.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('starts on the next date and ends the day after (DTEND is exclusive), across a year end too', () => {
    const { content } = buildDueDateIcs(credelio, 'Rex', en, 'en');
    expect(property(content, 'DTSTART')).toBe('DTSTART;VALUE=DATE:20261020');
    expect(property(content, 'DTEND')).toBe('DTEND;VALUE=DATE:20261021');

    const newYearsEve = buildDueDateIcs({ ...credelio, boosterDate: '2026-12-31' }, 'Rex', en, 'en').content;
    expect(property(newYearsEve, 'DTSTART')).toBe('DTSTART;VALUE=DATE:20261231');
    expect(property(newYearsEve, 'DTEND')).toBe('DTEND;VALUE=DATE:20270101');
  });

  it('stamps DTSTAMP in UTC', () => {
    const { content } = buildDueDateIcs(credelio, 'Rex', en, 'en');
    expect(property(content, 'DTSTAMP')).toBe('DTSTAMP:20261015T080000Z');
  });

  it('keeps one UID per record and date: added again later, it is the same event; a new date is a new one', () => {
    const first = property(buildDueDateIcs(credelio, 'Rex', en, 'en').content, 'UID');
    vi.setSystemTime(new Date('2026-10-18T21:00:00+02:00'));
    const again = property(buildDueDateIcs(credelio, 'Rex', fr, 'fr').content, 'UID');
    const moved = property(buildDueDateIcs({ ...credelio, boosterDate: '2026-10-25' }, 'Rex', en, 'en').content, 'UID');

    expect(first).toBe('UID:hr-credelio-2026-10-20@puppace');
    expect(again).toBe(first);
    expect(moved).not.toBe(first);
  });

  it('names the dog and the product, in English', () => {
    const { content } = buildDueDateIcs(credelio, 'Rex', en, 'en');
    expect(property(content, 'SUMMARY')).toBe('SUMMARY:Rex: Credelio Plus due');
    expect(property(content, 'DESCRIPTION')).toBe('DESCRIPTION:Given on September 20\\, 2026');
  });

  it('in French: the title, the given date and the clinic', () => {
    const { content } = buildDueDateIcs(vaccine, 'Rex', fr, 'fr');
    expect(property(content, 'SUMMARY')).toBe(`SUMMARY:Rex : ${chppiL4} à faire`);
    expect(property(content, 'DESCRIPTION')).toBe('DESCRIPTION:Donné le 1 juillet 2026\\nClinique: Clinique des Lilas');
  });

  it('escapes backslashes, commas, semicolons and newlines (RFC 5545 TEXT)', () => {
    const { content } = buildDueDateIcs({ ...vaccine, name: 'Rage; L4', vetClinic: 'Vet A, B\\C\nRue 2' }, 'Rex, Jr', en, 'en');

    expect(property(content, 'SUMMARY')).toBe('SUMMARY:Rex\\, Jr: Rage\\; L4 due');
    expect(property(content, 'DESCRIPTION')).toBe('DESCRIPTION:Given on July 1\\, 2026\\nClinic: Vet A\\, B\\\\C\\nRue 2');
  });

  it('reminds the day before at 09:00 and on the day at 09:00', () => {
    const { content } = buildDueDateIcs(credelio, 'Rex', en, 'en');
    const alarms = content.split('BEGIN:VALARM').slice(1);

    expect(alarms).toHaveLength(2);
    expect(alarms[0]).toContain('TRIGGER;RELATED=START:-PT15H\r\n');
    expect(alarms[1]).toContain('TRIGGER;RELATED=START:PT9H\r\n');
    for (const alarm of alarms) {
      expect(alarm).toContain('ACTION:DISPLAY\r\n');
      expect(alarm).toContain('DESCRIPTION:Rex: Credelio Plus due\r\n');
    }
  });

  it('folds lines longer than 75 octets, never inside a character, and unfolds back to the same text', () => {
    const longName = `${'é'.repeat(30)} ${'🐶'.repeat(20)} ${chppiL4}`;
    const { content } = buildDueDateIcs({ ...vaccine, name: longName }, 'Rex', fr, 'fr');
    const lines = content.split('\r\n');

    expect(lines.some((line) => line.startsWith(' '))).toBe(true);
    for (const line of lines) expect(octets(line)).toBeLessThanOrEqual(75);
    // A split 🐶 (two UTF-16 units, four octets) would come out as a replacement character
    for (const line of lines) expect(new TextDecoder().decode(new TextEncoder().encode(line))).not.toContain('�');
    expect(property(content, 'SUMMARY')).toBe(`SUMMARY:Rex : ${longName} à faire`);
  });

  it('names the file <dog>-<product>-<date>.ics with safe characters only', () => {
    expect(buildDueDateIcs(credelio, 'Rex', en, 'en').filename).toBe('rex-credelio-plus-2026-10-20.ics');
    expect(buildDueDateIcs(vaccine, 'Éclair', fr, 'fr').filename).toBe('eclair-chppi-dappi-l4-eurican-nobivac-versican-2027-07-01.ics');
  });
});

describe('downloadDueDateIcs', () => {
  it('downloads a text/calendar Blob through an anchor, and frees it only once the phone had time to read it', async () => {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:calendar';
    });
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    const clicked: Array<{ href: string; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });

    downloadDueDateIcs(credelio, 'Rex', en, 'en');

    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe('text/calendar;charset=utf-8');
    expect(await blobs[0].text()).toContain('SUMMARY:Rex: Credelio Plus due');
    expect(clicked).toEqual([{ href: 'blob:calendar', download: 'rex-credelio-plus-2026-10-20.ics' }]);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:calendar');
  });
});

describe('buildGoogleCalendarUrl: the same event as a Google Calendar template link (Android)', () => {
  const params = (url: string) => new URL(url).searchParams;

  it('opens Google Calendar\'s event template with the .ics title and description, all day on the next date', () => {
    const url = buildGoogleCalendarUrl(credelio, 'Rex', en, 'en');

    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(params(url).get('action')).toBe('TEMPLATE');
    expect(params(url).get('text')).toBe('Rex: Credelio Plus due');
    expect(params(url).get('dates')).toBe('20261020/20261021');
    expect(params(url).get('details')).toBe('Given on September 20, 2026');
  });

  it('ends the day after (exclusive), across a month end and a year end', () => {
    expect(params(buildGoogleCalendarUrl({ ...credelio, boosterDate: '2026-10-31' }, 'Rex', en, 'en')).get('dates')).toBe('20261031/20261101');
    expect(params(buildGoogleCalendarUrl({ ...credelio, boosterDate: '2026-12-31' }, 'Rex', en, 'en')).get('dates')).toBe('20261231/20270101');
  });

  it('in French: the title, the given date and the clinic, URL-encoded', () => {
    const url = buildGoogleCalendarUrl(vaccine, 'Rex', fr, 'fr');

    expect(params(url).get('text')).toBe(`Rex : ${chppiL4} à faire`);
    expect(params(url).get('details')).toBe('Donné le 1 juillet 2026\nClinique: Clinique des Lilas');
    expect(url).not.toMatch(/[\s àé]/);
    expect(url).toContain('%C3%A0+faire');
    expect(url).toContain('%0A');
  });

  it('keeps &, #, + and = inside their parameter, and sends Google nothing else (no notes, batch, ids)', () => {
    const record = { ...vaccine, name: 'Rage #2 + L4', vetClinic: 'Vet A&B=1', notes: 'Rappel chez le véto', batchNumber: 'LOT-123' };
    const url = buildGoogleCalendarUrl(record, 'Rex & Co', en, 'en');

    expect(params(url).get('text')).toBe('Rex & Co: Rage #2 + L4 due');
    expect(params(url).get('details')).toBe('Given on July 1, 2026\nClinic: Vet A&B=1');
    expect(params(url).get('dates')).toBe('20270701/20270702');
    expect([...params(url).keys()]).toEqual(['action', 'text', 'dates', 'details']);
    expect(decodeURIComponent(url)).not.toMatch(/Rappel|LOT-123|hr-chppi|hh-1|pup-1/);
  });
});

describe('isAndroid', () => {
  it('is true for an Android phone, false for an iPhone and a desktop', () => {
    const userAgent = vi.spyOn(navigator, 'userAgent', 'get');

    userAgent.mockReturnValue('Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36');
    expect(isAndroid()).toBe(true);
    userAgent.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1');
    expect(isAndroid()).toBe(false);
    userAgent.mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36');
    expect(isAndroid()).toBe(false);
  });
});
