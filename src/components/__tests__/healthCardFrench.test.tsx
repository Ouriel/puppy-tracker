// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DogHealthSummary } from '../DogHealthSummary';
import { CarnetDeSanteView } from '../../views/CarnetDeSanteView';
import { PredictorWidget } from '../PredictorWidget';
import { calculatePredictions } from '../../utils/predictions';
import { fr } from '../../i18n/fr';
import { en } from '../../i18n/en';
import type { Activity, HealthRecord, PuppyProfile } from '../../types';

// The French screens of the health card (backlog items 1 and 3), on a made-up dog. Today: 15 Oct 2026, Paris.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };

const record = (overrides: Partial<HealthRecord> & Pick<HealthRecord, 'id' | 'type' | 'name' | 'date'>): HealthRecord =>
  ({ householdId: 'hh-1', puppyId: puppy.id, ...overrides });

const chppiL4 = 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)';
const rage = 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)';

let root: Root | null = null;

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
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

const renderCard = (healthRecords: HealthRecord[]) =>
  render(<DogHealthSummary profile={puppy} activities={[]} weightActivities={[]} healthRecords={healthRecords} onOpenHealthPassport={vi.fn()} />);

describe('dashboard health card, in French (backlog item 1)', () => {
  it('a later Rage shot does not hide the CHPPi + L4 booster due first: that one is shown, named, with its chip', async () => {
    const container = await renderCard([
      record({ id: 'hr-chppi', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2026-10-20' }),
      record({ id: 'hr-rage', type: 'vaccination', name: rage, date: '2026-09-01', boosterDate: '2027-09-01' }),
    ]);

    expect(container.textContent).toContain(chppiL4);
    expect(container.textContent).not.toContain(rage);
    expect(container.textContent).toContain(`${fr.health.given} 1 juil. • ${fr.health.nextDue} 20 oct.`);
    expect(container.textContent).toContain(fr.potty.dueSoon);
  });

  it('a vaccine renewed by a later shot of the same vaccine is not the one shown', async () => {
    const container = await renderCard([
      record({ id: 'hr-chppi-1', type: 'vaccination', name: chppiL4, date: '2026-05-01', boosterDate: '2026-06-01' }),
      record({ id: 'hr-chppi-2', type: 'vaccination', name: chppiL4, date: '2026-06-01', boosterDate: '2027-03-01' }),
    ]);

    expect(container.textContent).toContain(`${fr.health.given} 1 juin`);
    expect(container.textContent).not.toContain(fr.potty.overdue);
  });

  it('an antiparasitic whose date has passed says so', async () => {
    const container = await renderCard([
      record({ id: 'hr-dose', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-10', boosterDate: '2026-10-10' }),
    ]);

    expect(container.textContent).toContain(`${fr.health.given} 10 sept. • ${fr.health.nextDue} 10 oct.`);
    expect(container.textContent).toContain(fr.potty.overdue);
  });

  it('on the due day the dose is due soon, not overdue', async () => {
    const container = await renderCard([
      record({ id: 'hr-dose', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-15', boosterDate: '2026-10-15' }),
    ]);

    expect(container.textContent).toContain(fr.potty.dueSoon);
    expect(container.textContent).not.toContain(fr.potty.overdue);
  });

  it('a record with no next date shows an em dash and no chip, never a made-up date', async () => {
    const container = await renderCard([
      record({ id: 'hr-dose', type: 'deworming', name: 'Milbemax', productName: 'Milbemax', date: '2026-10-01', boosterDate: null }),
    ]);

    expect(container.textContent).toContain(`${fr.health.nextDue} —`);
    expect(container.textContent).not.toMatch(new RegExp(`${fr.potty.overdue}|${fr.potty.dueSoon}|${fr.health.statusUpToDate}`));
  });
});

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

// An overdue Rage shot, an up-to-date CHPPi + L4, a renewed dose and a dose due in 5 days
const passportRecords = [
  record({ id: 'hr-rage', type: 'vaccination', name: rage, date: '2025-10-01', boosterDate: '2026-10-01' }),
  record({ id: 'hr-chppi', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2027-07-01' }),
  record({ id: 'hr-dose-1', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-08-20', boosterDate: '2026-09-20' }),
  record({ id: 'hr-dose-2', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-20', boosterDate: '2026-10-20' }),
];

describe('health passport, in French (backlog item 3)', () => {
  it('every status chip is French: no "Overdue" or "Due Soon"', async () => {
    const container = await renderPassport(passportRecords);
    const chips = [...container.querySelectorAll('.chip')].map((chip) => chip.textContent);

    expect(chips).toEqual(expect.arrayContaining([fr.potty.overdue, `✅ ${fr.health.statusUpToDate}`, `✅ ${fr.health.statusFulfilled}`, fr.potty.dueSoon]));
    expect(container.textContent).not.toMatch(/Overdue|Due Soon/);
  });

  it('dates read the French way, never 2026-09-27', async () => {
    const container = await renderPassport(passportRecords);

    expect(container.textContent).toContain(`${fr.health.injectedOn} 1 juil.`);
    expect(container.textContent).toContain(`${fr.health.booster}: 1 juil. 2027`);
    expect(container.textContent).toContain(`${fr.health.givenOn} 20 sept.`);
    expect(container.textContent).toContain(`${fr.health.nextDeworming}: 20 oct.`);
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('a record whose next date was emptied shows an em dash and no chip (backlog item 1)', async () => {
    const container = await renderPassport([
      record({ id: 'hr-dose', type: 'deworming', name: 'Milbemax', productName: 'Milbemax', date: '2026-10-01', boosterDate: null }),
    ]);

    expect(container.textContent).toContain(`${fr.health.nextDeworming}: —`);
    expect(container.querySelectorAll('.chip')).toHaveLength(0);
  });
});

describe('a new dog with no logs, in French (backlog item 3)', () => {
  it('the prediction cards show an em dash, not "N/A"', async () => {
    const now = new Date();
    const container = await render(
      <PredictorWidget
        predictions={calculatePredictions([], puppy, now, 'Europe/Paris')}
        profile={puppy}
        activities={[]}
        todayFoodLoggedGrams={0}
        todayMealsCount={0}
        nextMealPortionGrams={67}
        onQuickAction={vi.fn()}
        onOpenQuickLogModal={vi.fn()}
        referenceTime={now}
      />
    );

    expect(container.textContent).not.toContain('N/A');
    expect([...container.querySelectorAll('.whitespace-nowrap')].map((countdown) => countdown.textContent)).toContain('—');
  });
});

describe('weight card units (backlog item 3)', () => {
  const weighIn = (id: string, timestamp: string, weightKg: number): Activity => ({ id, puppyId: puppy.id, type: 'weight', timestamp, weightKg, loggedBy: 'Owner' });
  const weighIns = [weighIn('act-w1', '2026-09-01T08:00:00.000Z', 9), weighIn('act-w2', '2026-10-01T08:00:00.000Z', 10)];
  const renderWeightCard = () =>
    render(<DogHealthSummary profile={puppy} activities={[]} weightActivities={weighIns} healthRecords={[]} onOpenHealthPassport={vi.fn()} />);

  it('in French, ages read "sem." and the daily gain "g/j"', async () => {
    const container = await renderWeightCard();

    expect(container.textContent).toContain('(30 sem.)'); // the last weigh-in, at 30 weeks
    expect(container.textContent).toContain(`${fr.dashboard.today} (32 sem.)`);
    // The measured pace, not the model's: 9 kg on 1 Sep, 10 kg on 1 Oct
    expect(container.textContent).toContain('+33 g/j');
    expect(container.textContent).not.toMatch(/\d+w\)/);
  });

  it('in French, weights read "10,4 kg", never "10.4 kg", and the adult range in whole kilos (formatKg)', async () => {
    const container = await render(
      <DogHealthSummary profile={puppy} activities={[]} weightActivities={[weighIns[0], weighIn('act-w3', '2026-10-01T08:00:00.000Z', 10.4)]} healthRecords={[]} onOpenHealthPassport={vi.fn()} />
    );

    expect(container.textContent).toContain(`${fr.health.lastLogged}10,4 kg`);
    expect(container.textContent).toMatch(new RegExp(`${fr.health.estAdult} \\d+–\\d+ kg`));
    expect(container.textContent).toMatch(/~\d+,\d kg/); // today's estimate
    expect(container.textContent).not.toMatch(/\d\.\d/);
  });

  it('a weigh-in that looks like a typo (104 for 10,4) stays out of the card until edited', async () => {
    const container = await render(
      <DogHealthSummary profile={puppy} activities={[]} weightActivities={[...weighIns, weighIn('act-typo', '2026-10-08T08:00:00.000Z', 104)]} healthRecords={[]} onOpenHealthPassport={vi.fn()} />
    );

    expect(container.textContent).toContain(`${fr.health.lastLogged}10 kg`);
    expect(container.textContent).toContain('+33 g/j');
    expect(container.textContent).not.toContain('104');
  });

  it('in English, the daily gain reads "g/day", not the French "g/j"', async () => {
    localStorage.setItem('puppace_lang_v1', 'en');
    const container = await renderWeightCard();

    expect(container.textContent).toContain(`${en.dashboard.today} (32w)`);
    expect(container.textContent).toContain('+33 g/day');
    expect(container.textContent).not.toContain('g/j');
  });

  const renderGrowthCard = () =>
    render(<CarnetDeSanteView activePuppy={puppy} weightActivities={weighIns} healthRecords={[]} setHealthRecords={vi.fn()} isDashboardDown={false} currentUser="Owner" onAddActivity={vi.fn()} onUpdateActivity={vi.fn()} />);

  it('the passport\'s weight card, in French: ages read "mois" and the measured pace "g/j"', async () => {
    const container = await renderGrowthCard();

    expect(container.textContent).toContain('1 oct. · 7 mois'); // the 1 Oct weigh-in, at 30 weeks
    expect(container.querySelector('[data-tile="pace"]')!.textContent).toContain('+33 g/j');
    expect(container.textContent).not.toMatch(/\d+w /);
  });

  it('the passport\'s weight card, in English: the pace reads "g/day", not the French "g/j"', async () => {
    localStorage.setItem('puppace_lang_v1', 'en');
    const container = await renderGrowthCard();

    expect(container.textContent).toContain('Oct 1 · 7 mo');
    expect(container.querySelector('[data-tile="pace"]')!.textContent).toContain('+33 g/day');
    expect(container.textContent).not.toContain('g/j');
  });
});

describe('status chips on the dark cards (accessibility)', () => {
  it('each chip text is light enough to read, and the overdue chip pulses only for viewers who allow motion', async () => {
    const container = await renderPassport(passportRecords);
    const chipClasses = (label: string) => [...container.querySelectorAll('.chip')].find((chip) => chip.textContent === label)!.className.split(/\s+/);

    expect(chipClasses(fr.potty.overdue)).toEqual(expect.arrayContaining(['text-rose-300', 'motion-safe:animate-pulse']));
    expect(chipClasses(fr.potty.overdue)).not.toContain('animate-pulse');
    expect(chipClasses(fr.potty.dueSoon)).toContain('text-amber-300');
    expect(chipClasses(`✅ ${fr.health.statusUpToDate}`)).toContain('text-emerald-300');
    expect(chipClasses(`✅ ${fr.health.statusFulfilled}`)).toContain('text-emerald-300');
  });
});

describe('health card leftovers, in French', () => {
  const setDate = async (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const suggestionButtons = (container: HTMLElement) =>
    [...container.querySelectorAll('button')].map((button) => button.textContent!.trim()).filter((text) => text.startsWith('Suggéré'));

  it('the weight card shows no WALTHAM label or category, and weigh-in dates without the time: "14 oct.", "1 oct."', async () => {
    const weighIns: Activity[] = [
      { id: 'act-w1', puppyId: puppy.id, type: 'weight', timestamp: '2026-10-01T08:00:00.000Z', weightKg: 10, loggedBy: 'Owner' },
      { id: 'act-w2', puppyId: puppy.id, type: 'weight', timestamp: '2026-10-14T16:00:00.000Z', weightKg: 10.4, loggedBy: 'Owner' },
    ];
    const container = await render(
      <CarnetDeSanteView activePuppy={puppy} weightActivities={weighIns} healthRecords={[]} setHealthRecords={vi.fn()} isDashboardDown={false} currentUser="Owner" onAddActivity={vi.fn()} onUpdateActivity={vi.fn()} />
    );
    const rows = [...container.querySelectorAll('tbody tr')].map((row) => row.textContent);

    expect(container.textContent).not.toMatch(/WALTHAM|Catégorie|Cat\. /);
    expect(rows[0]).toMatch(/^14 oct\./);
    expect(rows[1]).toMatch(/^1 oct\./);
    expect(container.textContent).not.toMatch(/Hier 18:00|10:00|Yesterday|Oct 1/);
  });

  it('the edit forms offer "Suggéré : 10 juil. 2027" and "Suggéré : 21 oct.", never an ISO date', async () => {
    const container = await renderPassport([
      record({ id: 'hr-rage', type: 'vaccination', name: rage, date: '2026-07-01', boosterDate: '2027-07-01' }),
      record({ id: 'hr-dose', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-20', boosterDate: '2026-10-20' }),
    ]);
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${fr.health.editVaccineEntry}"]`)!.click());
    await setDate(container.querySelector<HTMLInputElement>('input[type="date"][value="2026-07-01"]')!, '2026-07-10');
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${fr.health.editDewormingEntry}"]`)!.click());
    await setDate(container.querySelector<HTMLInputElement>('input[type="date"][value="2026-09-20"]')!, '2026-09-21');

    expect(suggestionButtons(container)).toEqual(['Suggéré : 10 juil. 2027', 'Suggéré : 21 oct.']);
  });

  it('the dashboard card\'s breed chip is light enough to read on the dark card', async () => {
    const container = await renderCard([]);
    const breedChip = [...container.querySelectorAll('.chip')].find((chip) => chip.textContent === 'Beagle')!;

    expect(breedChip.className.split(/\s+/)).toContain('text-blue-300');
  });
});
