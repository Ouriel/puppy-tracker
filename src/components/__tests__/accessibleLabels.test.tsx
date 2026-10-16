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
import { HouseholdView } from '../../views/HouseholdView';
import { PuppiesView } from '../../views/PuppiesView';
import { SettingsView } from '../../views/SettingsView';
import { AuthLockScreen } from '../AuthLockScreen';
import { PrivacyPolicyModal } from '../PrivacyPolicyModal';
import { TermsOfServiceModal } from '../TermsOfServiceModal';
import { CarnetDeSanteView } from '../../views/CarnetDeSanteView';
import { calculatePredictions } from '../../utils/predictions';
import { act as log, PISTACHE } from '../../utils/__tests__/fixtures';

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
vi.setSystemTime(new Date('2026-10-22T12:00:00+02:00'));
const now = new Date();
const pee = log('pee', new Date(now.getTime() - 10 * 60 * 1000).toISOString());
const weighIn = log('weight', new Date(now.getTime() - 60 * 60 * 1000).toISOString(), { weightKg: 9 });
const medication = log('medication', new Date(now.getTime() - 60 * 60 * 1000).toISOString(), { medicationName: 'Test-Med' });

describe('screen readers hear the app language (French)', () => {
  it('navbar: dog picker, language and settings buttons', async () => {
    await render(<Navbar puppies={[PISTACHE]} activePuppy={PISTACHE} onSelectPuppy={vi.fn()} onOpenQuickLog={vi.fn()} onOpenSettings={vi.fn()} />, 'fr');
    expect(ariaLabels()).toEqual(expect.arrayContaining(['Choisir le chien', 'Changer de langue', 'Gestion du foyer']));
  });

  it('dog picker: the name alone in the bar, the age in the list, in French ("6 mois", never "6m")', async () => {
    await render(<Navbar puppies={[PISTACHE]} activePuppy={PISTACHE} onSelectPuppy={vi.fn()} onOpenQuickLog={vi.fn()} onOpenSettings={vi.fn()} />, 'fr');
    const trigger = document.querySelector<HTMLButtonElement>('header button[aria-haspopup="listbox"]')!;
    expect(trigger.textContent).toBe('Pistache');
    await act(async () => trigger.click());
    expect([...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toEqual(['Pistache (6\u00a0mois)']);
  });

  // The 44 px trigger is a flex row: without items-center the name sat 5.5 px above the chevron (measured at 320 px)
  it('dog picker: 44 px tall, the name centred on the chevron', async () => {
    await render(<Navbar puppies={[PISTACHE]} activePuppy={PISTACHE} onSelectPuppy={vi.fn()} onOpenQuickLog={vi.fn()} onOpenSettings={vi.fn()} />, 'fr');
    const trigger = document.querySelector<HTMLButtonElement>('header button[aria-haspopup="listbox"]')!;
    expect(trigger.classList).toContain('h-11');
    expect(trigger.classList).toContain('items-center');
  });

  // HeroUI's close button says "Close" in every language unless the app names it
  it('privacy and terms dialogs: the corner close button reads "Fermer"', async () => {
    await render(<PrivacyPolicyModal isOpen onClose={vi.fn()} />, 'fr');
    expect(document.querySelector('[data-slot="modal-close-trigger"]')!.getAttribute('aria-label')).toBe('Fermer');
    await act(async () => root?.unmount());
    document.body.innerHTML = '';
    await render(<TermsOfServiceModal isOpen onClose={vi.fn()} />, 'fr');
    expect(document.querySelector('[data-slot="modal-close-trigger"]')!.getAttribute('aria-label')).toBe('Fermer');
  });

  it('activity feed: edit and delete buttons', async () => {
    await render(<ActivityTimeline activities={[pee]} caretakers={[]} activePuppy={PISTACHE} onDeleteActivity={vi.fn()} onUpdateActivity={vi.fn()} referenceTime={now} />, 'fr');
    const todayHeader = [...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]')].find((button) => button.textContent!.includes("Aujourd'hui"))!;
    await act(async () => todayHeader.click());
    expect(ariaLabels()).toEqual(expect.arrayContaining(['Modifier pipi 11:50', 'Supprimer pipi 11:50']));
  });

  it('weight history: delete button', async () => {
    await render(<WeightGrowthChart profile={PISTACHE} activities={[weighIn]} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} />, 'fr');
    expect(ariaLabels()).toContain('Supprimer la pesée du 22 oct.');
  });

  it('log form: close button', async () => {
    await render(<QuickLogModal isOpen onClose={vi.fn()} onSave={vi.fn()} currentUser="Tester" />, 'fr');
    expect(ariaLabels()).toContain('Fermer');
  });

  it('medication history: delete button', async () => {
    await render(<MedicationSection activities={[medication]} onDeleteActivity={vi.fn()} />, 'fr');
    expect(ariaLabels()).toContain('Supprimer Test-Med du 22 oct.');
  });

  it('prediction countdowns: spoken in French, the short visual text hidden from screen readers', async () => {
    const predictions = {
      ...calculatePredictions([pee], PISTACHE, now, 'Europe/Paris'),
      nextPeeExpectedAt: new Date(now.getTime() + 90 * 60 * 1000),
      nextPoopExpectedAt: new Date(now.getTime() - 45 * 60 * 1000),
    };
    const container = await render(
      <PredictorWidget predictions={predictions} profile={PISTACHE} activities={[pee]} todayFoodLoggedGrams={0} todayMealsCount={0} onQuickAction={vi.fn()} onOpenQuickLogModal={vi.fn()} referenceTime={now} />,
      'fr'
    );

    // Intl puts a no-break space between a number and its unit
    const spoken = [...container.querySelectorAll('.sr-only')].map((element) => element.textContent!.replace(/\s/g, ' '));
    expect(spoken).toEqual(expect.arrayContaining(['Prévu dans 1 heure 30 minutes', 'En retard de 45 minutes']));
    const hidden = [...container.querySelectorAll('[aria-hidden="true"]')].map((element) => element.textContent);
    expect(hidden).toEqual(expect.arrayContaining(['~1\u00a0h\u00a030', 'En retard ~45\u00a0min']));
    expect(ariaLabels().join(' ')).not.toMatch(/Due in|Overdue by/);
  });
});

// Backlog item 27
describe('choice groups, small text and pulsing chips (French)', () => {
  it('log form: VoiceOver names each choice group by its label (type, place, stool)', async () => {
    await render(<QuickLogModal isOpen initialType="poop" onClose={vi.fn()} onSave={vi.fn()} currentUser="Tester" />, 'fr');
    const groupNames = [...document.querySelectorAll('[role="radiogroup"]')]
      .map((group) => document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent?.trim());
    expect(groupNames).toEqual(["Type d'activité", 'Lieu', 'Consistance des selles']);
  });

  it('activity feed: the accident chip pulses only when motion is allowed, and the empty-feed hint is light enough to read', async () => {
    const accident = log('pee', new Date(now.getTime() - 10 * 60 * 1000).toISOString(), { pottyLocation: 'indoor_accident' });
    await render(<ActivityTimeline activities={[accident]} caretakers={[]} activePuppy={PISTACHE} onDeleteActivity={vi.fn()} referenceTime={now} />, 'fr');
    const accidentChipClasses = document.querySelector('[title="1 accident"]')!.className.split(/\s+/);
    expect(accidentChipClasses).toContain('motion-safe:animate-pulse');
    expect(accidentChipClasses).not.toContain('animate-pulse');

    await act(async () => root!.unmount());
    await render(<ActivityTimeline activities={[]} caretakers={[]} activePuppy={PISTACHE} onDeleteActivity={vi.fn()} referenceTime={now} />, 'fr');
    const hint = [...document.querySelectorAll('p')].find((paragraph) => paragraph.textContent === 'Touche + pour enregistrer une activité.')!;
    expect(hint.classList).toContain('text-slate-400');
  });
});

describe('English plurals: 1 meal, N meals', () => {
  const renderMealCard = (targetMealsPerDay: number) => {
    const profile = { ...PISTACHE, dailyFoodGramGoal: 0, targetMealsPerDay };
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

// App review 2026-10-16, 5.4 to 5.7: every row button says which row, 44 px targets, states, focus and headings
describe('row buttons named after their row, 44 px targets (French)', () => {
  const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const is44 = (element: Element | null) => element !== null && ['min-h-11', 'min-w-11'].every((name) => element.classList.contains(name));

  it('activity feed: "Modifier pipi 11:50" and "Supprimer pipi 11:50", each 44 px', async () => {
    await render(<ActivityTimeline activities={[pee]} caretakers={[]} activePuppy={PISTACHE} onDeleteActivity={vi.fn()} onUpdateActivity={vi.fn()} referenceTime={now} />, 'fr');
    const todayHeader = [...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]')].find((header) => header.textContent!.includes("Aujourd'hui"))!;
    await act(async () => todayHeader.click());
    expect(is44(button('Modifier pipi 11:50'))).toBe(true);
    expect(is44(button('Supprimer pipi 11:50'))).toBe(true);
  });

  it('activity feed: Export and "Tout déplier" are named and 44 px; Export opens no menu role', async () => {
    await render(<ActivityTimeline activities={[pee]} caretakers={[]} activePuppy={PISTACHE} onDeleteActivity={vi.fn()} referenceTime={now} />, 'fr');
    expect(is44(button('Exporter'))).toBe(true);
    expect(button('Exporter')!.hasAttribute('aria-haspopup')).toBe(false);
    expect(is44(button('Tout déplier'))).toBe(true);
  });

  it('activity feed day header: a visible focus ring, and the counts spoken as words, not bare numbers', async () => {
    await render(<ActivityTimeline activities={[pee]} caretakers={[]} activePuppy={PISTACHE} onDeleteActivity={vi.fn()} referenceTime={now} />, 'fr');
    const header = [...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((element) => element.textContent!.includes("Aujourd'hui"))!;
    expect(header.className).toContain('focus-visible:ring-2');
    expect(header.className).not.toContain('focus:outline-none');
    expect(header.querySelector('.sr-only')!.textContent).toBe('1 pipi, 0 caca');
    const pees = header.querySelector(`[title="1 pipi"]`)!;
    expect(pees.getAttribute('aria-hidden')).toBe('true');
  });

  it('weight history: "Supprimer la pesée du 22 oct."', async () => {
    await render(<WeightGrowthChart profile={PISTACHE} activities={[weighIn]} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} onUpdateActivity={vi.fn()} />, 'fr');
    expect(ariaLabels()).toEqual(expect.arrayContaining(['Supprimer la pesée du 22 oct.', 'Modifier la pesée du 22 oct.']));
  });

  it('medication history: "Supprimer Test-Med du 22 oct.", 44 px', async () => {
    await render(<MedicationSection activities={[medication]} onDeleteActivity={vi.fn()} />, 'fr');
    expect(is44(button('Supprimer Test-Med du 22 oct.'))).toBe(true);
  });

  it('log form: the close button and the footer buttons are 44 px', async () => {
    await render(<QuickLogModal isOpen onClose={vi.fn()} onSave={vi.fn()} currentUser="Tester" />, 'fr');
    expect(button('Fermer')!.classList).toContain('min-h-11');
    expect(document.querySelector('button[type="submit"]')!.classList).toContain('min-h-11');
  });

  it('members: "Modifier Marie" / "Supprimer Marie", named colour pickers and boxes, a named close button', async () => {
    const badges = [
      { id: 'c-me', name: 'Sam', role: 'Member' as const, color: '#EC4899', email: 'sam@example.com' },
      { id: 'c-marie', name: 'Marie', role: 'Member' as const, color: '#10B981' },
    ];
    await render(<HouseholdView caretakers={badges} user={{ email: 'sam@example.com', name: 'Sam', role: 'Admin' }} onAddCaretaker={vi.fn()} onUpdateCaretaker={vi.fn()} onDeleteCaretaker={vi.fn()} />, 'fr');
    expect(is44(button('Modifier Marie'))).toBe(true);
    expect(is44(button('Supprimer Marie'))).toBe(true);

    const buttonWithText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent!.includes(text))!;
    await act(async () => buttonWithText('Ajouter un membre').click());
    await act(async () => buttonWithText('Autoriser un e-mail').click());
    const nameBox = document.querySelector<HTMLInputElement>('form input[type="text"]')!;
    expect(document.querySelector(`label[for="${nameBox.id}"]`)!.textContent).toBe('Nom du membre');
    expect(document.querySelector('form input[type="color"]')!.getAttribute('aria-label')).toBe('Couleur du badge');
    const emailBox = document.querySelector<HTMLInputElement>('input[type="email"]')!;
    expect(document.getElementById(emailBox.getAttribute('aria-labelledby')!)!.textContent).toBe('Inviter un membre par e-mail');

    await act(async () => button('Modifier Marie')!.click());
    expect(button('Annuler')).not.toBeNull();
    expect(document.querySelectorAll('input[type="color"][aria-label="Couleur du badge"]')).toHaveLength(2);
  });

  it('dogs: "Modifier Pistache" / "Supprimer Pistache", 44 px; Femelle / Mâle say which is chosen', async () => {
    await render(<PuppiesView puppies={[PISTACHE]} activePuppyId={PISTACHE.id} onSelectPuppy={vi.fn()} onAddPuppy={vi.fn()} onUpdatePuppy={vi.fn()} onDeletePuppy={vi.fn()} deletedPuppies={[]} onRestorePuppy={vi.fn()} />, 'fr');
    expect(is44(button('Supprimer Pistache'))).toBe(true);
    await act(async () => button('Modifier Pistache')!.click());
    const sexButtons = [...document.querySelectorAll<HTMLButtonElement>('button')].filter((element) => /Femelle|Mâle/.test(element.textContent!));
    expect(sexButtons.map((element) => element.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(sexButtons.every((element) => element.classList.contains('min-h-11'))).toBe(true);
  });

  it('settings: the tabs say which one is open, and the back button is 44 px', async () => {
    await render(
      <SettingsView user={{ email: 'sam@example.com', name: 'Sam', role: 'Member' }} puppies={[PISTACHE]} activePuppyId={PISTACHE.id} onSelectPuppy={vi.fn()} onAddPuppy={vi.fn()} onUpdatePuppy={vi.fn()} onDeletePuppy={vi.fn()} deletedPuppies={[]} onRestorePuppy={vi.fn()} caretakers={[]} onAddCaretaker={vi.fn()} onUpdateCaretaker={vi.fn()} onDeleteCaretaker={vi.fn()} onBackToDashboard={vi.fn()} />,
      'fr'
    );
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute('aria-pressed')])).toEqual([['Chiens (1)', 'true'], ['Membres (0)', 'false']]);
    expect(tabs.every((tab) => tab.classList.contains('min-h-11'))).toBe(true);
    expect([...document.querySelectorAll('button')].find((element) => element.textContent === 'Retour au tableau de bord')!.classList).toContain('min-h-11');
  });

  it('sign-in: "À propos" says whether it is open, and the legal links are 44 px', async () => {
    await render(<AuthLockScreen onUnlockWithSSO={vi.fn()} />, 'fr');
    const about = [...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent!.includes('À propos'))!;
    expect(about.getAttribute('aria-expanded')).toBe('false');
    await act(async () => about.click());
    expect(about.getAttribute('aria-expanded')).toBe('true');
    expect([...document.querySelectorAll('a')].every((link) => link.classList.contains('min-h-11'))).toBe(true);
  });

  it('dashboard cards: each title is a heading', async () => {
    await render(
      <PredictorWidget predictions={calculatePredictions([pee], PISTACHE, now, 'Europe/Paris')} profile={PISTACHE} activities={[pee]} todayFoodLoggedGrams={0} todayMealsCount={0} onQuickAction={vi.fn()} onOpenQuickLogModal={vi.fn()} referenceTime={now} />,
      'fr'
    );
    expect([...document.querySelectorAll('h2')].map((heading) => heading.textContent)).toEqual(['Prochain pipi prévu', 'Prochain caca prévu', 'Prochain repas prévu']);
  });
});

// App review 2026-10-16, S7 and owner decision D4: 12 px where the text must be read (values, labels, hints); small badges and chart ticks stay small
describe('readable text is at least 12 px (French)', () => {
  // The font size class that applies: the element's own, else its nearest ancestor's
  const sizeOf = (element: Element | null | undefined): string | undefined => {
    for (let node = element; node; node = node.parentElement) {
      const size = node.className.toString().match(/(?:^|\s)(text-(?:xs|sm|base|\[\d+px\]))(?:\s|$)/)?.[1];
      if (size) return size;
    }
    return undefined;
  };

  it('dashboard cards: the "today / last" lines', async () => {
    await render(
      <PredictorWidget predictions={calculatePredictions([pee], PISTACHE, now, 'Europe/Paris')} profile={PISTACHE} activities={[pee]} todayFoodLoggedGrams={0} todayMealsCount={0} onQuickAction={vi.fn()} onOpenQuickLogModal={vi.fn()} referenceTime={now} />,
      'fr'
    );
    const lastPee = [...document.querySelectorAll('span')].find((span) => span.textContent === 'Dernier pipi\u00a0:')!;
    expect(sizeOf(lastPee.parentElement!.parentElement)).toBe('text-xs');
  });

  it('activity feed rows: the place, grams and who logged it', async () => {
    const meal = log('food', new Date(now.getTime() - 20 * 60 * 1000).toISOString(), { quantityGrams: 80, loggedBy: 'Marie' });
    const outsidePee = log('pee', new Date(now.getTime() - 10 * 60 * 1000).toISOString(), { pottyLocation: 'outside' });
    await render(<ActivityTimeline activities={[outsidePee, meal]} caretakers={[]} activePuppy={PISTACHE} onDeleteActivity={vi.fn()} referenceTime={now} />, 'fr');
    const todayHeader = [...document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]')].find((header) => header.textContent!.includes("Aujourd'hui"))!;
    await act(async () => todayHeader.click());
    const chip = (text: string) => [...document.querySelectorAll('span')].find((span) => span.textContent!.trim() === text);
    expect(sizeOf(chip('80\u00a0g'))).toBe('text-xs');
    expect(sizeOf(chip('Marie'))).toBe('text-xs');
    expect(sizeOf([...document.querySelectorAll('span')].find((span) => span.textContent!.includes('Dehors')))).toBe('text-xs');
  });
});

// Health passport review 2026-10-16, 5.3: TalkBack names every button of the passport, in French
describe('health passport (French)', () => {
  it('every button has a name, and the row buttons name their record', async () => {
    const records = [
      { id: 'hr-dose', householdId: 'hh-1', puppyId: PISTACHE.id, type: 'deworming' as const, name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-09-10', boosterDate: '2026-10-10' },
    ];
    await render(
      <CarnetDeSanteView activePuppy={PISTACHE} activities={[medication]} weightActivities={[weighIn]} healthRecords={records} setHealthRecords={vi.fn()} isDashboardDown={false}
        currentUser="Sam" onAddActivity={vi.fn()} onUpdateActivity={vi.fn()} onOpenQuickLogModal={vi.fn()} onDeleteActivity={vi.fn()} />,
      'fr'
    );
    const unnamed = [...document.querySelectorAll('button')].filter((element) => !(element.getAttribute('aria-label') || element.textContent!.trim()));
    expect(unnamed).toEqual([]);
    expect(ariaLabels()).toEqual(expect.arrayContaining(['Modifier Credelio Plus du 10 sept.', 'Supprimer Credelio Plus du 10 sept.', 'Supprimer Test-Med du 22 oct.']));
  });
});
