// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, useState, type ComponentProps, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CarnetDeSanteView } from '../CarnetDeSanteView';
import { fr } from '../../i18n/fr';
import type { Activity, Caretaker, HealthRecord, PuppyProfile } from '../../types';

// Health passport review 2026-10-16, phase 4 (for the vet), on a made-up dog, in French. Today: 15 Oct 2026, Paris.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', gender: 'female', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const record = (overrides: Partial<HealthRecord> & Pick<HealthRecord, 'id' | 'type' | 'name' | 'date'>): HealthRecord =>
  ({ householdId: 'hh-1', puppyId: puppy.id, ...overrides });
const chppiL4 = 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)';
const records = [
  record({ id: 'hr-chppi', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2027-07-01' }),
  record({ id: 'hr-dose', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-20', boosterDate: '2026-10-20' }),
];
const medications: Activity[] = [
  { id: 'm-1', puppyId: puppy.id, type: 'medication', timestamp: '2026-10-01T08:00:00.000Z', medicationName: 'Métacam', loggedBy: 'Alice Martin' },
];
const weighIns: Activity[] = [
  { id: 'w-1', puppyId: puppy.id, type: 'weight', timestamp: '2026-10-01T08:00:00.000Z', weightKg: 9.4, loggedBy: 'alice@example.com' },
];
const caretakers: Caretaker[] = [{ id: 'c-1', name: 'Alice', role: 'Member', color: '#EC4899', email: 'alice@example.com' }];

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
  vi.restoreAllMocks();
});

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

const passport = (overrides: Partial<ComponentProps<typeof CarnetDeSanteView>> = {}) => (
  <CarnetDeSanteView activePuppy={puppy} medicationActivities={medications} weightActivities={weighIns} healthRecords={records} setHealthRecords={vi.fn()}
    isDashboardDown={false} caretakers={caretakers} currentUser="Owner" onAddActivity={vi.fn()} onUpdateActivity={vi.fn()} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} {...overrides} />
);
const renderPassport = (overrides: Partial<ComponentProps<typeof CarnetDeSanteView>> = {}) => render(passport(overrides));
/** The passport holding its records, as App does: a saved record is on screen at once. */
function StatefulPassport() {
  const [healthRecords, setHealthRecords] = useState(records);
  return passport({ healthRecords, setHealthRecords });
}

/** A passport section, found by its title ('Vaccins (1)'). */
const section = (title: string) => [...document.querySelectorAll('h3')].find((heading) => heading.textContent!.startsWith(title))!.closest('.card')!;
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
/** The visible name of a field: its label[for], or the element its aria-labelledby points to. */
const fieldName = (field: Element) => {
  const labelledBy = field.getAttribute('aria-labelledby');
  if (labelledBy) return labelledBy.split(' ').map((id) => document.getElementById(id)?.textContent).join(' ');
  return document.querySelector(`label[for="${field.id}"]`)?.textContent;
};
const field = (form: Element, label: string) => [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].find((input) => fieldName(input) === label)!;
async function setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
/** Stubs the health-records API: it answers what it was sent, and keeps every request body. */
function stubHealthRecordsApi() {
  const bodies: Array<{ method: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    bodies.push({ method: init.method!, body });
    return Promise.resolve(new Response(JSON.stringify({ id: 'hr-new', householdId: 'hh-1', ...body }), { status: init.method === 'POST' ? 201 : 200 }));
  }));
  return bodies;
}
async function submit(form: HTMLFormElement) {
  await act(async () => form.requestSubmit());
  await act(async () => Promise.resolve());
}

const buttonWithText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent!.includes(text))!;

describe('Export: the one-page print and the CSV get every treatment and the members (C10)', () => {
  it('the menu says what each export holds', async () => {
    await renderPassport();
    await act(async () => buttonWithText(fr.dashboard.export).click());
    expect(buttonWithText(fr.health.exportHealthPdf).textContent).toContain('Résumé d\'une page pour le véto');
    expect(buttonWithText(fr.health.exportHealthCsv).textContent).toContain('Vaccins, vermifuges, traitements et pesées');
  });

  it('the printed page lists the treatments of the last 90 days', async () => {
    const printWindow = Object.assign(new EventTarget(), { document: { write: vi.fn(), close: vi.fn() }, print: vi.fn() });
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);
    await renderPassport();

    await act(async () => buttonWithText(fr.dashboard.export).click());
    await act(async () => buttonWithText(fr.health.exportHealthPdf).click());

    const html = printWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('Métacam');
    expect(html).toContain('9,4 kg');
  });

  it('the CSV has a row per treatment, and names whoever logged a weigh-in or a treatment by their badge', async () => {
    let csvBlob: Blob | null = null;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => { csvBlob = blob; return 'blob:csv'; }), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderPassport();

    await act(async () => buttonWithText(fr.dashboard.export).click());
    await act(async () => buttonWithText(fr.health.exportHealthCsv).click());

    const text = await (csvBlob as unknown as Blob).text();
    expect(text).toContain('"Traitement","2026-10-01","10:00","Métacam"');
    expect(text).not.toContain('alice@example.com');
    expect(text.match(/"Alice"/g)).toHaveLength(2);
  });
});

describe('the product and lot from the vet\'s sticker (C13)', () => {
  it('the add form has an optional "Produit (vignette)" next to the lot; both are saved, the lot box neither autocorrects nor lowercases', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => buttonWithText(fr.health.addVaccine).click());
    const form = section(fr.health.vaccinations).querySelector('form')!;

    const lot = field(form, fr.health.batchNumber) as HTMLInputElement;
    expect(lot.getAttribute('autocorrect')).toBe('off');
    expect(lot.getAttribute('autocapitalize')).toBe('characters');
    expect(lot.getAttribute('spellcheck')).toBe('false');
    const product = field(form, fr.health.stickerProduct) as HTMLInputElement;
    expect(product.getAttribute('autocorrect')).toBe('off');
    expect(product.maxLength).toBe(80);
    expect(lot.maxLength).toBe(80);
    // Next to each other in the form
    expect(product.closest('.grid')).toBe(lot.closest('.grid'));

    await setValue(product, ' Nobivac DHPPi+L4 ');
    await setValue(lot, 'B456');
    await submit(form);
    expect(bodies).toEqual([{ method: 'POST', body: expect.objectContaining({ name: chppiL4, productName: 'Nobivac DHPPi+L4', batchNumber: 'B456' }) }]);
  });

  it('left empty, no product is saved', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => buttonWithText(fr.health.addVaccine).click());
    await submit(section(fr.health.vaccinations).querySelector('form')!);
    expect(bodies[0].body).not.toHaveProperty('productName');
  });

  it('a row shows "Nobivac DHPPi+L4 · lot B456"; a renewed one\'s grey line too', async () => {
    await renderPassport({ healthRecords: [
      record({ id: 'hr-1', type: 'vaccination', name: chppiL4, date: '2026-06-01', boosterDate: '2026-07-01', productName: 'Nobivac DHPPi+L4', batchNumber: 'A123' }),
      record({ id: 'hr-2', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2027-07-01', productName: 'Nobivac DHPPi+L4', batchNumber: 'B456' }),
    ] });
    const vaccines = section(fr.health.vaccinations);
    expect(vaccines.textContent).toContain('Nobivac DHPPi+L4 · lot B456');
    expect(vaccines.querySelector('button[data-history]')!.textContent).toBe('1 juin · CHPPi + L4 · Nobivac DHPPi+L4 · lot A123');
  });

  it('the edit form shows the product; emptying it clears it', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport({ healthRecords: [record({ id: 'hr-1', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2027-07-01', productName: 'Nobivac DHPPi+L4', batchNumber: 'B456' })] });
    await act(async () => button('Modifier CHPPi + L4 du 1 juil.').click());
    const form = section(fr.health.vaccinations).querySelector('form')!;

    const product = field(form, fr.health.stickerProduct) as HTMLInputElement;
    expect(product.value).toBe('Nobivac DHPPi+L4');
    expect(field(form, fr.health.batchNumber).getAttribute('autocapitalize')).toBe('characters');
    await setValue(product, '');
    await submit(form);
    expect(bodies[0]).toEqual({ method: 'PUT', body: expect.objectContaining({ id: 'hr-1', productName: null, batchNumber: 'B456' }) });
  });
});

/** Opens a form's picker (its first listbox button, or the one named) and picks the option whose text starts with `text`. */
async function pick(form: Element, text: string) {
  await act(async () => form.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  await act(async () => options.find((option) => option.textContent!.startsWith(text))!.click());
}
const dateBoxes = (form: Element) => [...form.querySelectorAll<HTMLInputElement>('input[type="date"]')];

describe('"Autre…" in both pickers: a product the list does not have (C13)', () => {
  it('vaccines: "Autre…" is the last choice; it asks for the name, saved as typed, with the generic 12-month booster', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => buttonWithText(fr.health.addVaccine).click());
    const form = section(fr.health.vaccinations).querySelector('form')!;

    await act(async () => form.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
    expect([...document.querySelectorAll('[role="option"]')].at(-1)!.textContent).toBe('Autre…');
    await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].at(-1)!.click());

    const name = field(form, fr.health.otherVaccineName) as HTMLInputElement;
    expect(name.required).toBe(true);
    expect(name.maxLength).toBe(80);
    await setValue(name, ' Herpès canin ');
    expect(dateBoxes(form)[1].value).toBe('2027-10-15');
    await submit(form);
    expect(bodies).toEqual([{ method: 'POST', body: expect.objectContaining({ name: 'Herpès canin', date: '2026-10-15', boosterDate: '2027-10-15' }) }]);
  });

  it('vaccines: "Autre…" with no name typed saves nothing', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => buttonWithText(fr.health.addVaccine).click());
    const form = section(fr.health.vaccinations).querySelector('form')!;
    await pick(form, 'Autre…');
    await submit(form);
    expect(bodies).toEqual([]);
  });

  it('a vaccine from the list keeps the protocol name as its key', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => buttonWithText(fr.health.addVaccine).click());
    const form = section(fr.health.vaccinations).querySelector('form')!;
    await pick(form, 'Rage');
    await submit(form);
    expect(bodies[0].body.name).toBe('Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)');
  });

  it('antiparasitics: "Autre…" asks for the product, saved as typed, monthly until 6 months then every 3 months', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => buttonWithText(fr.health.addDeworming).click());
    const form = section(fr.health.deworming).querySelector('form')!;
    await pick(form, 'Autre…');

    const product = field(form, fr.health.otherProductName) as HTMLInputElement;
    expect(product.required).toBe(true);
    await setValue(product, 'Milbactor');
    // 7 months old today: every 3 months
    expect(dateBoxes(form)[1].value).toBe('2027-01-15');
    // 4 months old on 1 July: monthly
    await setValue(dateBoxes(form)[0], '2026-07-01');
    expect(dateBoxes(form)[1].value).toBe('2026-08-01');
    await submit(form);
    expect(bodies).toEqual([{ method: 'POST', body: expect.objectContaining({ name: 'Milbactor', productName: 'Milbactor', date: '2026-07-01', boosterDate: '2026-08-01' }) }]);
  });

  it('antiparasitics: after a dose typed under "Autre…", the next one starts on that product, never on a made-up Credelio Plus', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport({ healthRecords: [record({ id: 'hr-typed', type: 'deworming', name: 'Milbactor', productName: 'Milbactor', date: '2026-09-15', boosterDate: '2026-12-15' })] });
    await act(async () => buttonWithText(fr.health.addDeworming).click());
    const form = section(fr.health.deworming).querySelector('form')!;
    // 7 months old today: the generic schedule, every 3 months
    expect(dateBoxes(form)[1].value).toBe('2027-01-15');
    await submit(form);
    expect(bodies).toEqual([{ method: 'POST', body: expect.objectContaining({ name: 'Milbactor', productName: 'Milbactor', boosterDate: '2027-01-15' }) }]);
  });

  it('vaccines: after a shot typed under "Autre…", the next form starts on it, never on CHPPi + L4 (saved unnoticed, it would renew the CHPPi + L4)', async () => {
    const bodies = stubHealthRecordsApi();
    await render(<StatefulPassport />);
    await act(async () => buttonWithText(fr.health.addVaccine).click());
    let form = section(fr.health.vaccinations).querySelector('form')!;
    await pick(form, 'Autre…');
    await setValue(field(form, fr.health.otherVaccineName), 'Lyme Merilym');
    await submit(form);
    expect(form.isConnected).toBe(false);

    await act(async () => buttonWithText(fr.health.addVaccine).click());
    form = section(fr.health.vaccinations).querySelector('form')!;
    expect(form.querySelector('button[aria-haspopup="listbox"]')!.textContent).toBe('Lyme Merilym');
    // A choice of its own: no name box to type again
    expect(field(form, fr.health.otherVaccineName)).toBeUndefined();
    await submit(form);
    expect(bodies.map(({ body }) => body.name)).toEqual(['Lyme Merilym', 'Lyme Merilym']);
  });

  it('an entry saved under a name the list does not have keeps it as a choice, even after "Autre…" was picked', async () => {
    await renderPassport({ healthRecords: [record({ id: 'hr-x', type: 'vaccination', name: 'Herpès canin', date: '2026-07-01', boosterDate: '2027-07-01' })] });
    await act(async () => button('Modifier Herpès canin du 1 juil.').click());
    const form = section(fr.health.vaccinations).querySelector('form')!;
    await pick(form, 'Autre…');
    await act(async () => form.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
    expect([...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toContain('Herpès canin');
  });

  it('the edit forms offer "Autre…" too', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => button('Modifier CHPPi + L4 du 1 juil.').click());
    const vaccineForm = section(fr.health.vaccinations).querySelector('form')!;
    await pick(vaccineForm, 'Autre…');
    await setValue(field(vaccineForm, fr.health.otherVaccineName), 'Nobivac DHP');
    await submit(vaccineForm);
    expect(bodies.at(-1)).toEqual({ method: 'PUT', body: expect.objectContaining({ id: 'hr-chppi', name: 'Nobivac DHP' }) });

    await act(async () => button('Modifier Credelio Plus du 20 sept.').click());
    const dewormingForm = section(fr.health.deworming).querySelector('form')!;
    await pick(dewormingForm, 'Autre…');
    await setValue(field(dewormingForm, fr.health.otherProductName), 'Milbactor');
    await submit(dewormingForm);
    expect(bodies.at(-1)).toEqual({ method: 'PUT', body: expect.objectContaining({ id: 'hr-dose', name: 'Milbactor', productName: 'Milbactor' }) });
  });
});

describe('a notes box on each vaccine and antiparasitic, for what the vet said (C12)', () => {
  it.each([
    [fr.health.addVaccine, fr.health.vaccinations],
    [fr.health.addDeworming, fr.health.deworming],
  ])('"%s": the notes are saved, trimmed; left empty, none', async (addButton, title) => {
    const bodies = stubHealthRecordsApi();
    await renderPassport();
    await act(async () => buttonWithText(addButton).click());
    const form = section(title).querySelector('form')!;

    const notes = field(form, fr.potty.notes) as HTMLTextAreaElement;
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes.maxLength).toBe(2000);
    await setValue(notes, '  Souffle léger, recontrôler à 6 mois ');
    await submit(form);
    expect(bodies[0].body.notes).toBe('Souffle léger, recontrôler à 6 mois');

    await act(async () => buttonWithText(addButton).click());
    await submit(section(title).querySelector('form')!);
    expect(bodies[1].body).not.toHaveProperty('notes');
  });

  it('an entry shows its notes; its edit form holds them, and emptying them clears them', async () => {
    const bodies = stubHealthRecordsApi();
    await renderPassport({ healthRecords: [
      record({ id: 'hr-chppi', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2027-07-01', notes: 'Petite boule au point d\'injection' }),
      record({ id: 'hr-dose', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-20', boosterDate: '2026-10-20', notes: 'Donné avec du fromage' }),
    ] });
    expect(section(fr.health.vaccinations).textContent).toContain('Petite boule au point d\'injection');
    expect(section(fr.health.deworming).textContent).toContain('Donné avec du fromage');

    await act(async () => button('Modifier CHPPi + L4 du 1 juil.').click());
    const vaccineForm = section(fr.health.vaccinations).querySelector('form')!;
    expect((field(vaccineForm, fr.potty.notes) as HTMLTextAreaElement).value).toBe('Petite boule au point d\'injection');
    await setValue(field(vaccineForm, fr.potty.notes), '');
    await submit(vaccineForm);
    expect(bodies.at(-1)).toEqual({ method: 'PUT', body: expect.objectContaining({ id: 'hr-chppi', notes: null }) });

    await act(async () => button('Modifier Credelio Plus du 20 sept.').click());
    const dewormingForm = section(fr.health.deworming).querySelector('form')!;
    expect((field(dewormingForm, fr.potty.notes) as HTMLTextAreaElement).value).toBe('Donné avec du fromage');
    await setValue(field(dewormingForm, fr.potty.notes), 'Vomi 1 h après');
    await submit(dewormingForm);
    expect(bodies.at(-1)).toEqual({ method: 'PUT', body: expect.objectContaining({ id: 'hr-dose', notes: 'Vomi 1 h après' }) });

    await act(async () => button('Modifier Credelio Plus du 20 sept.').click());
    await setValue(field(section(fr.health.deworming).querySelector('form')!, fr.potty.notes), '');
    await submit(section(fr.health.deworming).querySelector('form')!);
    expect(bodies.at(-1)).toEqual({ method: 'PUT', body: expect.objectContaining({ id: 'hr-dose', notes: null }) });
  });
});
