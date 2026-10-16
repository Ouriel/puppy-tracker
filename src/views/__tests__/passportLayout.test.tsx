// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ComponentProps, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CarnetDeSanteView } from '../CarnetDeSanteView';
import { DogHealthSummary } from '../../components/DogHealthSummary';
import { fr } from '../../i18n/fr';
import type { Activity, HealthRecord, PuppyProfile } from '../../types';

// Health passport review 2026-10-16, phase 3 (page order), on a made-up dog, in French. Today: 15 Oct 2026, Paris.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', gender: 'female', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const record = (overrides: Partial<HealthRecord> & Pick<HealthRecord, 'id' | 'type' | 'name' | 'date'>): HealthRecord =>
  ({ householdId: 'hh-1', puppyId: puppy.id, ...overrides });

const chppiL4 = 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)';
const rage = 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)';
// An overdue Rage shot, an up-to-date CHPPi + L4 renewing an older one, a renewed dose and a dose due in 5 days
const records = [
  record({ id: 'hr-rage', type: 'vaccination', name: rage, date: '2025-10-01', boosterDate: '2026-10-01' }),
  record({ id: 'hr-chppi-1', type: 'vaccination', name: chppiL4, date: '2026-06-01', boosterDate: '2026-07-05', batchNumber: 'B123' }),
  record({ id: 'hr-chppi-2', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2027-07-01' }),
  record({ id: 'hr-dose-1', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-08-20', boosterDate: '2026-09-20' }),
  record({ id: 'hr-dose-2', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-20', boosterDate: '2026-10-20' }),
];

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  localStorage.setItem('puppace_lang_v1', 'fr');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

const renderPassport = (props: Partial<ComponentProps<typeof CarnetDeSanteView>> = {}) =>
  render(
    <CarnetDeSanteView activePuppy={puppy} weightActivities={[]} healthRecords={records} setHealthRecords={vi.fn()} isDashboardDown={false}
      currentUser="Owner" onAddActivity={vi.fn()} onUpdateActivity={vi.fn()} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} {...props} />
  );

const heading = (text: string) => [...document.querySelectorAll('h2, h3')].find((element) => element.textContent!.startsWith(text));
/** The "À faire" block: one text per line (name, date, status). */
const dueLines = () => [...heading('À faire')!.closest('section')!.querySelectorAll('li')].map((line) => line.textContent);
const isBefore = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('"À faire" comes first: every open next date, overdue first (C6), short names (C8)', () => {
  const expectedLines = [
    `Rage1 oct.${fr.potty.overdue}`,
    `Credelio Plus20 oct.${fr.potty.dueSoon}`,
    `CHPPi + L41 juil. 2027${fr.health.statusUpToDate}`,
  ];

  it('the passport opens on it, before the weight card and the sections', async () => {
    await renderPassport();

    expect(dueLines()).toEqual(expectedLines);
    expect(isBefore(heading('À faire')!, heading(fr.weightChart.title)!)).toBe(true);
    expect(isBefore(heading(fr.weightChart.title)!, heading(fr.health.vaccinations)!)).toBe(true);
  });

  it('the dashboard card shows the same lines, so the two never disagree', async () => {
    await render(<DogHealthSummary profile={puppy} activities={[]} weightActivities={[]} healthRecords={records} onOpenHealthPassport={vi.fn()} />);

    expect(dueLines()).toEqual(expectedLines);
  });

  it('nothing due: one line', async () => {
    await renderPassport({ healthRecords: [] });

    expect(dueLines()).toEqual([]);
    expect(heading('À faire')!.closest('section')!.querySelectorAll('p')).toHaveLength(1);
    expect(heading('À faire')!.closest('section')!.textContent).toContain(fr.health.nothingDue);
  });
});

describe('identity strip: one line under the heading, instead of the tall header card', () => {
  it('"Carnet de santé", then name · sex · breed · age today', async () => {
    await renderPassport();
    const title = heading(fr.nav.carnetDeSante)!;

    expect(title.textContent).toBe('Carnet de santé');
    expect(title.nextElementSibling!.textContent).toBe('Rex · Femelle · Beagle · 7 mois');
  });

  it('in English; under 16 weeks the age is in weeks; an unknown sex is left out', async () => {
    localStorage.setItem('puppace_lang_v1', 'en');
    await renderPassport({ activePuppy: { ...puppy, gender: undefined, birthDate: '2026-08-01' } });

    expect(heading('Health Book')!.nextElementSibling!.textContent).toBe('Rex · Beagle · 10 wk');
  });

  it('the age is in weeks up to 15 weeks, in months from 16 weeks', async () => {
    // Born 1 July: 15 weeks old on 15 Oct (105 days)
    await renderPassport({ activePuppy: { ...puppy, birthDate: '2026-07-01' } });
    expect(heading(fr.nav.carnetDeSante)!.nextElementSibling!.textContent).toBe('Rex · Femelle · Beagle · 15\u00a0sem.');
    await act(async () => root!.unmount());

    // Born 24 June: 16 weeks old on 15 Oct (113 days)
    await renderPassport({ activePuppy: { ...puppy, birthDate: '2026-06-24' } });
    expect(heading(fr.nav.carnetDeSante)!.nextElementSibling!.textContent).toBe('Rex · Femelle · Beagle · 3\u00a0mois');
  });
});

/** A passport section, found by its title ('Vaccins (3)'). */
const section = (title: string) => heading(title)!.closest('.card')!;
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const buttonWithText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent!.trim() === text)!;
/** The grey lines of a section's renewed history, newest first. */
const historyLines = (title: string) => [...section(title).querySelectorAll<HTMLButtonElement>('button[data-history]')].map((line) => line.textContent);

describe('Vaccins and Antiparasitaires: open records in full, renewed ones as one grey line (C7, C8)', () => {
  it('an open record keeps its full row, with its short name; a renewed one is one grey line, after them, with no next date, status or calendar button', async () => {
    await renderPassport();
    const vaccines = section(fr.health.vaccinations);

    expect(historyLines(fr.health.vaccinations)).toEqual(['1 juin · CHPPi + L4 · lot B123']);
    expect(vaccines.textContent).not.toContain('5 juil.'); // the renewed shot's own next date
    expect(vaccines.querySelectorAll('.chip')).toHaveLength(2); // Rage (overdue) and the July CHPPi + L4
    expect(vaccines.querySelectorAll(`button[aria-label^="${fr.health.addToCalendar}"]`)).toHaveLength(1); // the July CHPPi + L4
    const line = vaccines.querySelector('button[data-history]')!;
    expect(line.className).toContain('text-slate-400');
    expect(isBefore(button('Modifier Rage du 1 oct. 2025'), line)).toBe(true);
    expect(isBefore(button('Modifier CHPPi + L4 du 1 juil.'), line)).toBe(true);
    expect(vaccines.textContent).not.toContain('Eurican');
  });

  it('a tap on a grey line opens its edit form, with the full brand list and a Delete that asks first', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true, deletedId: 'hr-chppi-1' }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await renderPassport();

    await act(async () => button('Modifier CHPPi + L4 du 1 juin').click());
    const form = section(fr.health.vaccinations).querySelector('form')!;
    expect(form.querySelector('button[aria-haspopup="listbox"]')!.textContent).toContain('Eurican');

    await act(async () => form.querySelector<HTMLButtonElement>('button[aria-label="Supprimer CHPPi + L4 du 1 juin"]')!.click());
    expect(document.body.textContent).toContain(fr.health.deleteVaccineConfirm);
    await act(async () => buttonWithText(fr.common.delete).click());
    expect(fetchMock).toHaveBeenCalledWith('/api/health-records?id=hr-chppi-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('the latest 3 renewed doses, then "Historique (4)", which opens the rest', async () => {
    const monthlyDose = (month: number) => record({
      id: `hr-dose-m${month}`, type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: `2026-0${month}-20`, boosterDate: `2026-${String(month + 1).padStart(2, '0')}-20`,
    });
    await renderPassport({ healthRecords: [5, 6, 7, 8, 9].map(monthlyDose) });

    expect(historyLines(fr.health.deworming)).toEqual(['20 août · Credelio Plus', '20 juil. · Credelio Plus', '20 juin · Credelio Plus']);
    const toggle = buttonWithText('Historique (4)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await act(async () => toggle.click());

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(historyLines(fr.health.deworming)).toHaveLength(4);
    expect(historyLines(fr.health.deworming).at(-1)).toBe('20 mai · Credelio Plus');
  });

  it('the same for vaccines: the latest 3 renewed shots, then "Historique (4)", which opens the rest', async () => {
    const monthlyShot = (month: number) => record({
      id: `hr-shot-m${month}`, type: 'vaccination', name: chppiL4, date: `2026-0${month}-01`, boosterDate: `2026-${String(month + 1).padStart(2, '0')}-01`,
    });
    await renderPassport({ healthRecords: [5, 6, 7, 8, 9].map(monthlyShot) });

    expect(historyLines(fr.health.vaccinations)).toEqual(['1 août · CHPPi + L4', '1 juil. · CHPPi + L4', '1 juin · CHPPi + L4']);
    const toggle = buttonWithText('Historique (4)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await act(async () => toggle.click());

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(historyLines(fr.health.vaccinations)).toHaveLength(4);
    expect(historyLines(fr.health.vaccinations).at(-1)).toBe('1 mai · CHPPi + L4');
  });

  it('a renewed dose: its grey line opens its edit form, whose Delete asks first (the only way to delete it)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true, deletedId: 'hr-dose-1' }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await renderPassport();

    await act(async () => button('Modifier Credelio Plus du 20 août').click());
    const form = section(fr.health.deworming).querySelector('form')!;
    await act(async () => form.querySelector<HTMLButtonElement>('button[aria-label="Supprimer Credelio Plus du 20 août"]')!.click());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(fr.health.deleteDewormingConfirm);

    await act(async () => buttonWithText(fr.common.delete).click());
    expect(fetchMock).toHaveBeenCalledWith('/api/health-records?id=hr-dose-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('the protocol drawer stays closed, at the end of each section', async () => {
    await renderPassport();

    for (const title of [fr.health.vaccinations, fr.health.deworming]) {
      const drawer = section(title).querySelector('details')!;
      expect(drawer.open).toBe(false);
      expect(isBefore(section(title).querySelector('button[data-history]')!, drawer)).toBe(true);
    }
  });
});

describe('Traitements: every medication, each with an edit pencil (C9)', () => {
  const medication: Activity = { id: 'act-med', puppyId: puppy.id, type: 'medication', timestamp: '2026-06-01T08:00:00.000Z', medicationName: 'Old-Med', loggedBy: 'Sam' };

  it('the pencil opens the log form on that medication; Save sends the edit', async () => {
    const onUpdateActivity = vi.fn(() => Promise.resolve(true));
    await renderPassport({ medicationActivities: [medication], onUpdateActivity });
    expect(heading(fr.health.medicationHistory)!.textContent).toBe(`${fr.health.medicationHistory} (1)`);

    await act(async () => {
      button('Modifier Old-Med du 1 juin').click();
      await import('../../components/QuickLogModal');
    });
    const nameBox = document.getElementById('quicklog-medication-name') as HTMLInputElement;
    expect(nameBox.value).toBe('Old-Med');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameBox, 'New-Med');
      nameBox.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => nameBox.form!.requestSubmit());

    expect(onUpdateActivity).toHaveBeenCalledWith(expect.objectContaining({ id: 'act-med', type: 'medication', medicationName: 'New-Med' }));
  });
});

describe('loading: skeleton rows until the first answer', () => {
  it('the passport shows skeletons, never "(0)", "no weigh-in yet", "nothing due" or a made-up weight', async () => {
    await renderPassport({ healthRecordsState: 'loading', healthRecords: [] });
    const text = document.body.textContent!;

    expect(text).not.toMatch(/\(0\)/);
    expect(text).not.toContain('Pas encore de pesée');
    expect(text).not.toContain(fr.health.nothingDue);
    expect(text).not.toMatch(/\d ?kg/);
    expect(document.querySelector('[aria-busy="true"]')!.textContent).toBe(fr.common.loading);
    // The heading and identity line come from the profile kept on the phone
    expect(heading(fr.nav.carnetDeSante)!.nextElementSibling!.textContent).toBe('Rex · Femelle · Beagle · 7 mois');
  });

  it('the dashboard card\'s "À faire" too: never "nothing due" before the records came', async () => {
    await render(<DogHealthSummary profile={puppy} activities={[]} weightActivities={[]} healthRecords={[]} healthRecordsState="loading" onOpenHealthPassport={vi.fn()} />);
    const toDo = heading('À faire')!.closest('section')!;

    expect(toDo.textContent).not.toContain(fr.health.nothingDue);
    expect(toDo.getAttribute('aria-busy')).toBe('true');
  });
});
