// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DogHealthSummary } from '../DogHealthSummary';
import { CarnetDeSanteView } from '../../views/CarnetDeSanteView';
import { fr } from '../../i18n/fr';
import type { HealthRecord, PuppyProfile } from '../../types';

// "Add to calendar" next to each next date (backlog item 16), on a made-up dog. Today: 15 Oct 2026, Paris.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };

const record = (overrides: Partial<HealthRecord> & Pick<HealthRecord, 'id' | 'type' | 'name' | 'date'>): HealthRecord =>
  ({ householdId: 'hh-1', puppyId: puppy.id, ...overrides });

const chppiL4 = 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)';
// The first dose is renewed by the second; the September Milbemax is renewed by the Credelio; the August one has no next date
const renewedDose = record({ id: 'hr-chppi-1', type: 'vaccination', name: chppiL4, date: '2026-05-01', boosterDate: '2026-06-01' });
const dueDose = record({ id: 'hr-chppi-2', type: 'vaccination', name: chppiL4, date: '2026-06-01', boosterDate: '2026-10-20', vetClinic: 'Clinique des Lilas' });
const noNextDate = record({ id: 'hr-milbemax', type: 'deworming', name: 'Milbemax', productName: 'Milbemax', date: '2026-08-01', boosterDate: null });
const renewedDeworming = record({ id: 'hr-milbemax-2', type: 'deworming', name: 'Milbemax', productName: 'Milbemax', date: '2026-09-01', boosterDate: '2026-10-01' });
const dueDeworming = record({ id: 'hr-credelio', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-10-01', boosterDate: '2026-11-01' });
const overdueDeworming = record({ id: 'hr-nexgard', type: 'deworming', name: 'Nexgard Spectra', productName: 'Nexgard Spectra', date: '2026-09-01', boosterDate: '2026-10-01' });

let root: Root | null = null;
let blobs: Blob[] = [];
let downloads: string[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  localStorage.setItem('puppace_lang_v1', 'fr');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
  blobs = [];
  downloads = [];
  globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:calendar';
  });
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

const calendarButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>(`button[aria-label="${fr.health.addToCalendar}"]`));

describe('health passport', () => {
  const renderPassport = (healthRecords: HealthRecord[]) =>
    render(
      <CarnetDeSanteView
        activePuppy={puppy}
        weightActivities={[]}
        healthRecords={healthRecords}
        setHealthRecords={vi.fn()}
        isDashboardDown={false}
        currentUser="Owner"
        onAddActivity={vi.fn()}
        onUpdateActivity={vi.fn()}
      />
    );

  it('one button per next date still due: none for a renewed dose or an entry with no next date', async () => {
    const container = await renderPassport([renewedDose, dueDose, noNextDate, dueDeworming]);

    expect(calendarButtons(container)).toHaveLength(2);
  });

  it('the booster\'s button downloads a text/calendar file for that booster, in French', async () => {
    const container = await renderPassport([renewedDose, dueDose]);

    await act(async () => calendarButtons(container)[0].click());

    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe('text/calendar;charset=utf-8');
    const content = await blobs[0].text();
    expect(content).toContain('DTSTART;VALUE=DATE:20261020');
    expect(content.replace(/\r\n /g, '')).toContain(`SUMMARY:Rex : ${chppiL4} à faire`);
    expect(downloads).toEqual(['rex-chppi-dappi-l4-eurican-nobivac-versican-2026-10-20.ics']);
  });

  it('no button on an overdue entry: an event in the past would never remind anyone', async () => {
    const container = await renderPassport([overdueDeworming, dueDose]);

    expect(calendarButtons(container)).toHaveLength(1);
  });

  it('the deworming\'s button downloads the deworming\'s next date: none for a renewed deworming or one with no next date', async () => {
    const container = await renderPassport([noNextDate, renewedDeworming, dueDeworming]);

    expect(calendarButtons(container)).toHaveLength(1);
    await act(async () => calendarButtons(container)[0].click());

    expect(await blobs[0].text()).toContain('SUMMARY:Rex : Credelio Plus à faire');
    expect(downloads).toEqual(['rex-credelio-plus-2026-11-01.ics']);
  });
});

describe('dashboard health card', () => {
  const renderCard = (healthRecords: HealthRecord[]) =>
    render(<DogHealthSummary profile={puppy} activities={[]} weightActivities={[]} healthRecords={healthRecords} onOpenHealthPassport={vi.fn()} />);

  it('a button on the vaccine and the deworming lines when each shows a next date', async () => {
    const container = await renderCard([renewedDose, dueDose, noNextDate, dueDeworming]);

    expect(calendarButtons(container)).toHaveLength(2);
    await act(async () => calendarButtons(container)[0].click());
    await act(async () => calendarButtons(container)[1].click());
    expect(downloads).toEqual(['rex-chppi-dappi-l4-eurican-nobivac-versican-2026-10-20.ics', 'rex-credelio-plus-2026-11-01.ics']);
  });

  it('no button when the line shows no next date', async () => {
    const container = await renderCard([noNextDate]);

    expect(container.textContent).toContain('Milbemax');
    expect(calendarButtons(container)).toHaveLength(0);
  });
});
