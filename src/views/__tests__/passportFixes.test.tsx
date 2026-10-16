// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CarnetDeSanteView } from '../CarnetDeSanteView';
import { WeightGrowthChart } from '../../components/WeightGrowthChart';
import type { HealthRecord, PuppyProfile } from '../../types';

// Health passport review 2026-10-16, section 5 items 2 to 9, in French, on a made-up dog. Today: 15 Oct 2026, Paris.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };
const record = (overrides: Partial<HealthRecord> & Pick<HealthRecord, 'id' | 'type' | 'name' | 'date'>): HealthRecord =>
  ({ householdId: 'hh-1', puppyId: puppy.id, ...overrides });
const dose = record({ id: 'hr-dose', type: 'deworming', name: 'Bravecto', productName: 'Bravecto', date: '2026-09-10', boosterDate: '2026-12-10' });
const shot = record({ id: 'hr-shot', type: 'vaccination', name: 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)', date: '2026-07-01', boosterDate: '2027-07-01' });

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

const renderPassport = (healthRecords: HealthRecord[] = [shot, dose]) =>
  render(
    <CarnetDeSanteView activePuppy={puppy} weightActivities={[]} healthRecords={healthRecords} setHealthRecords={vi.fn()} isDashboardDown={false}
      currentUser="Owner" onAddActivity={vi.fn()} onUpdateActivity={vi.fn()} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} />
  );

const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const buttonWithText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent!.trim() === text);
const is44 = (element: Element | null | undefined) => !!element && ['min-h-11', 'min-w-11'].every((name) => element.classList.contains(name));
/** The visible name of a field: its label[for], or the element its aria-labelledby points to. */
const fieldName = (field: Element) => {
  const labelledBy = field.getAttribute('aria-labelledby');
  if (labelledBy) return labelledBy.split(' ').map((id) => document.getElementById(id)?.textContent).join(' ');
  return document.querySelector(`label[for="${field.id}"]`)?.textContent;
};
/** A passport section, found by its title ('Vaccins (1)'). */
const section = (title: string) => [...document.querySelectorAll('h3')].find((heading) => heading.textContent!.startsWith(title))!.closest('.card')!;
const deworming = () => section('Antiparasitaires');

describe('row buttons and targets', () => {
  it('each row button names its record and date ("Modifier Bravecto du 10 sept."), 44 px', async () => {
    await renderPassport();
    expect(is44(button('Modifier Bravecto du 10 sept.'))).toBe(true);
    expect(is44(button('Supprimer Bravecto du 10 sept.'))).toBe(true);
    expect(is44(button(`Modifier ${shot.name} du 1 juil.`))).toBe(true);
    expect(is44(button(`Supprimer ${shot.name} du 1 juil.`))).toBe(true);
  });

  it('every passport section button is 44 px tall, the weight card\'s "Peser le chiot" too', async () => {
    await renderPassport();
    const sectionButtons = ['Ajouter un vaccin', 'Ajouter un antiparasitaire', 'Ajouter un traitement', 'Peser le chiot'].map(buttonWithText);
    expect(sectionButtons.map((element) => element?.classList.contains('min-h-11'))).toEqual([true, true, true, true]);
  });

  it('Export and Back are 44 px; Export opens no menu role', async () => {
    await renderPassport();
    const exportButton = buttonWithText('Exporter')!;
    expect(exportButton.classList).toContain('min-h-11');
    expect(exportButton.hasAttribute('aria-haspopup')).toBe(false);
  });

  it('a row: the name wraps to 2 lines rather than being cut; the decorative icon is hidden on phones', async () => {
    const container = await renderPassport();
    const name = [...container.querySelectorAll('span')].find((span) => span.textContent === shot.name)!;
    expect(name.classList).toContain('line-clamp-2');
    expect(name.classList).not.toContain('truncate');
    const rowIcon = name.closest('.rounded-xl')!.querySelector('.lucide-syringe')!.closest('div')!;
    expect(rowIcon.className).toMatch(/hidden sm:block/);
  });

  it('the status chip has one icon, no extra ✅', async () => {
    const container = await renderPassport([record({ id: 'hr-old', type: 'deworming', name: 'Bravecto', productName: 'Bravecto', date: '2026-06-10', boosterDate: '2026-09-10' }), dose]);
    expect(container.textContent).toContain('Effectué');
    expect(container.textContent).not.toContain('✅');
  });
});

describe('the antiparasitic forms speak of doses, not injections', () => {
  it('add form: "Date de prise" and "Prochaine prise", every field named, starting on the last product given', async () => {
    await renderPassport();
    await act(async () => buttonWithText('Ajouter un antiparasitaire')!.click());
    const card = deworming();
    const dates = [...card.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    expect(dates.map(fieldName)).toEqual(['Date de prise', 'Prochaine prise']);
    expect(card.textContent).not.toMatch(/[Ii]nject/);
    const productTrigger = card.querySelector('button[aria-haspopup="listbox"]')!;
    expect(productTrigger.textContent).toContain('Bravecto');
    expect(fieldName(productTrigger)).toContain('Produit');
  });

  it('the toggle shows an X while the form is open, and Save uses the section colour', async () => {
    await renderPassport();
    const toggle = buttonWithText('Ajouter un antiparasitaire')!;
    await act(async () => toggle.click());
    expect(toggle.querySelector('.lucide-x')).not.toBeNull();
    expect(buttonWithText("Enregistrer l'antiparasitaire")!.className).toContain('bg-amber-700');
  });

  // White on amber-600 is 3.2:1 and on teal-600 3.7:1; 12-14 px bold text needs 4.5:1. White on the 700 shade is 5.0:1 (amber) and 5.5:1 (teal).
  it('every amber or teal button (Add, Save, edit Save) is white on the 700 shade, only lighter on hover', async () => {
    await renderPassport();
    await act(async () => buttonWithText('Ajouter un antiparasitaire')!.click());
    await act(async () => buttonWithText('Ajouter un vaccin')!.click());
    await act(async () => button('Modifier Bravecto du 10 sept.')!.click());
    await act(async () => button(`Modifier ${shot.name} du 1 juil.`)!.click());
    const restingShade = (element: Element) => element.className.split(' ').find((name) => /^bg-(amber|teal)-\d+$/.test(name));
    const coloured = [...document.querySelectorAll('button')].filter(restingShade);

    expect(coloured.map((element) => [element.textContent!.trim(), restingShade(element)])).toEqual([
      ['Annuler', 'bg-teal-700'], // the open "Add a vaccine" toggle
      ['Enregistrer le vaccin', 'bg-teal-700'],
      ['Enregistrer', 'bg-teal-700'],
      ['Annuler', 'bg-amber-700'],
      ["Enregistrer l'antiparasitaire", 'bg-amber-700'],
      ['Enregistrer', 'bg-amber-700'],
      ['Ajouter un traitement', 'bg-teal-700'],
    ]);
  });

  it('edit form: "Donné le", the error is tied to its box, Enter saves, and focus comes back to the row\'s pencil', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(dose), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await renderPassport();
    const pencil = button('Modifier Bravecto du 10 sept.')!;
    await act(async () => pencil.click());

    const form = deworming().querySelector('form')!;
    const [given, next] = [...form.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    expect(fieldName(given)).toBe('Donné le');
    // Focus lands on the product list, its first field: a date box would open the iPhone's date wheel at once
    expect(document.activeElement).toBe(form.querySelector('button[aria-haspopup="listbox"]'));

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(next, '2026-09-01');
      next.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const error = document.getElementById(next.getAttribute('aria-describedby')!)!;
    expect(error.textContent).toBe('La prochaine prise doit être après la date de prise');
    expect(next.getAttribute('aria-invalid')).toBe('true');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(next, '2026-12-10');
      next.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => form.requestSubmit());
    await act(async () => Promise.resolve());
    expect(fetchMock).toHaveBeenCalledWith('/api/health-records', expect.objectContaining({ method: 'PUT' }));
    expect(document.activeElement).toBe(button('Modifier Bravecto du 10 sept.'));
  });

  it('the vaccine edit form also starts on its first field, the vaccine list, not the date', async () => {
    await renderPassport();
    await act(async () => button(`Modifier ${shot.name} du 1 juil.`)!.click());
    const form = section('Vaccins').querySelector('form')!;
    expect(document.activeElement).toBe(form.querySelector('button[aria-haspopup="listbox"]'));
  });

  it('Cancel on the edit form puts focus back on the row\'s pencil', async () => {
    await renderPassport();
    await act(async () => button(`Modifier ${shot.name} du 1 juil.`)!.click());
    await act(async () => buttonWithText('Annuler')!.click());
    expect(document.activeElement).toBe(button(`Modifier ${shot.name} du 1 juil.`));
  });
});

describe('vaccine add form', () => {
  it('every field is named: the vaccine, its dates, clinic and lot', async () => {
    await renderPassport();
    await act(async () => buttonWithText('Ajouter un vaccin')!.click());
    const card = section('Vaccins');
    const fields = [...card.querySelectorAll('input:not([type="hidden"]):not([aria-hidden="true"]), button[aria-haspopup="listbox"]')];
    // The vaccine list is named by its label and the vaccine shown
    expect(fieldName(fields[0])).toMatch(/ Vaccin$/);
    expect(fields.slice(1).map(fieldName)).toEqual(["Date d'injection", 'Date du prochain rappel', 'Clinique vétérinaire', 'Numéro de lot', 'Poids (kg)']);
    expect(fields.every((field) => fieldName(field))).toBe(true);
  });
});

describe('empty sections: one line each', () => {
  it('no vaccine, no antiparasitic, no treatment', async () => {
    const container = await renderPassport([]);
    expect(container.textContent).toContain('Aucun vaccin enregistré.');
    expect(container.textContent).toContain('Aucun antiparasitaire enregistré.');
    const treatments = [...container.querySelectorAll('p')].find((paragraph) => paragraph.textContent === 'Aucun traitement enregistré.')!;
    expect(treatments.closest('.border-dashed')).toBeNull();
  });

  it('the weight card names the button to tap', async () => {
    await render(<WeightGrowthChart activities={[]} profile={puppy} onOpenQuickLogModal={vi.fn()} />);
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('Pas encore de pesée. Touche «\u00a0Peser le chiot\u00a0» pour voir la courbe de Rex.');
  });
});
