// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Navbar } from '../Navbar';
import { ActivityTimeline } from '../ActivityTimeline';
import { WeightGrowthChart } from '../WeightGrowthChart';
import { QuickLogModal } from '../QuickLogModal';
import { PredictorWidget } from '../PredictorWidget';
import { MedicationSection } from '../../views/carnet/MedicationSection';
import { calculatePredictions } from '../../utils/predictions';
import { act as log, BALMA } from '../../utils/__tests__/fixtures';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom lacks these; HeroUI / react-aria read them.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
});

afterAll(() => vi.useRealTimers());

/** Renders outside the provider: components read the stored language. */
async function render(element: ReactElement, lang: 'en' | 'fr') {
  localStorage.setItem('puppace_lang_v1', lang);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

const ariaLabels = () => [...document.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label'));

// A fixed noon: the feed starts a day at 04:00, so a real clock between 04:00 and 04:10 would put the pee in yesterday.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-15T12:00:00+02:00'));
const now = new Date();
const pee = log('pee', new Date(now.getTime() - 10 * 60 * 1000).toISOString());
const weighIn = log('weight', new Date(now.getTime() - 60 * 60 * 1000).toISOString(), { weightKg: 9 });
const medication = log('medication', new Date(now.getTime() - 60 * 60 * 1000).toISOString(), { medicationName: 'Test-Med' });

describe('screen readers hear the app language (French)', () => {
  it('navbar: dog picker, language and settings buttons', async () => {
    await render(<Navbar puppies={[BALMA]} activePuppy={BALMA} onSelectPuppy={vi.fn()} onOpenQuickLog={vi.fn()} onOpenSettings={vi.fn()} />, 'fr');
    expect(ariaLabels()).toEqual(expect.arrayContaining(['Choisir le chien', 'Changer de langue', 'Gestion du Foyer']));
  });

  it('activity feed: edit and delete buttons', async () => {
    await render(<ActivityTimeline activities={[pee]} caretakers={[]} activePuppy={BALMA} onDeleteActivity={vi.fn()} onUpdateActivity={vi.fn()} referenceTime={now} />, 'fr');
    const todayHeader = [...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]')].find((button) => button.textContent!.includes("Aujourd'hui"))!;
    await act(async () => todayHeader.click());
    expect(ariaLabels()).toEqual(expect.arrayContaining(["Modifier l'Activité", "Supprimer l'activité"]));
  });

  it('weight history: delete button', async () => {
    await render(<WeightGrowthChart profile={BALMA} activities={[weighIn]} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} />, 'fr');
    expect(ariaLabels()).toContain('Supprimer la pesée');
  });

  it('log form: close button', async () => {
    await render(<QuickLogModal isOpen onClose={vi.fn()} onSave={vi.fn()} currentUser="Tester" />, 'fr');
    expect(ariaLabels()).toContain('Fermer');
  });

  it('medication history: delete button', async () => {
    await render(<MedicationSection activities={[medication]} onDeleteActivity={vi.fn()} />, 'fr');
    expect(ariaLabels()).toContain('Supprimer le Traitement');
  });

  it('prediction countdowns: spoken in French, the short visual text hidden from screen readers', async () => {
    const predictions = {
      ...calculatePredictions([pee], BALMA, now, 'Europe/Paris'),
      nextPeeExpectedAt: new Date(now.getTime() + 90 * 60 * 1000),
      nextPoopExpectedAt: new Date(now.getTime() - 45 * 60 * 1000),
    };
    const container = await render(
      <PredictorWidget predictions={predictions} profile={BALMA} activities={[pee]} todayFoodLoggedGrams={0} todayMealsCount={0} onQuickAction={vi.fn()} onOpenQuickLogModal={vi.fn()} referenceTime={now} />,
      'fr'
    );

    // Intl puts a no-break space between a number and its unit
    const spoken = [...container.querySelectorAll('.sr-only')].map((element) => element.textContent!.replace(/\s/g, ' '));
    expect(spoken).toEqual(expect.arrayContaining(['Prévu dans 1 heure 30 minutes', 'En retard de 45 minutes']));
    const hidden = [...container.querySelectorAll('[aria-hidden="true"]')].map((element) => element.textContent);
    expect(hidden).toEqual(expect.arrayContaining(['~1h 30m', 'En retard ~45m']));
    expect(ariaLabels().join(' ')).not.toMatch(/Due in|Overdue by/);
  });
});

// Backlog item 27
describe('choice groups, small text and pulsing chips (French)', () => {
  it('log form: VoiceOver names each choice group by its label (type, place, stool)', async () => {
    await render(<QuickLogModal isOpen initialType="poop" onClose={vi.fn()} onSave={vi.fn()} currentUser="Tester" />, 'fr');
    const groupNames = [...document.querySelectorAll('[role="radiogroup"]')]
      .map((group) => document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent?.trim());
    expect(groupNames).toEqual(["Type d'Activité", 'Lieu', 'Consistance des Selles']);
  });

  it('activity feed: the accident chip pulses only when motion is allowed, and the empty-feed hint is light enough to read', async () => {
    const accident = log('pee', new Date(now.getTime() - 10 * 60 * 1000).toISOString(), { pottyLocation: 'indoor_accident' });
    await render(<ActivityTimeline activities={[accident]} caretakers={[]} activePuppy={BALMA} onDeleteActivity={vi.fn()} referenceTime={now} />, 'fr');
    const accidentChipClasses = document.querySelector('[title="1 accident"]')!.className.split(/\s+/);
    expect(accidentChipClasses).toContain('motion-safe:animate-pulse');
    expect(accidentChipClasses).not.toContain('animate-pulse');

    await act(async () => root!.unmount());
    await render(<ActivityTimeline activities={[]} caretakers={[]} activePuppy={BALMA} onDeleteActivity={vi.fn()} referenceTime={now} />, 'fr');
    const hint = [...document.querySelectorAll('p')].find((paragraph) => paragraph.textContent === 'Cliquez sur "+ Nouveau Log" pour enregistrer une activité.')!;
    expect(hint.classList).toContain('text-slate-400');
  });
});

describe('English plurals: 1 meal, N meals', () => {
  const renderMealCard = (targetMealsPerDay: number) => {
    const profile = { ...BALMA, dailyFoodGramGoal: 0, targetMealsPerDay };
    return render(
      <PredictorWidget predictions={calculatePredictions([], profile, now, 'Europe/Paris')} profile={profile} activities={[]} todayFoodLoggedGrams={0} todayMealsCount={0} onQuickAction={vi.fn()} onOpenQuickLogModal={vi.fn()} referenceTime={now} />,
      'en'
    );
  };

  it('meal card of a dog on 1 meal a day: "0/1 meal"', async () => {
    const container = await renderMealCard(1);
    expect(container.textContent).toContain('0/1 meal');
    expect(container.textContent).not.toContain('0/1 meals');
  });

  it('meal card of a dog on 3 meals a day: "0/3 meals"', async () => {
    const container = await renderMealCard(3);
    expect(container.textContent).toContain('0/3 meals');
  });
});
