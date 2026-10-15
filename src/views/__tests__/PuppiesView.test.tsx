// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, type Mock } from 'vitest';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PuppiesView } from '../PuppiesView';
import { DogInputSchema } from '../../utils/schemas';
import type { PuppyProfile } from '../../types';
import { formatLocalDate } from '../../utils/date';

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
});

/** A standard-breed dog as GET /api/dogs returns it: the columns it never set come back as null. */
const REX: PuppyProfile = {
  id: 'dog-1',
  householdId: 'hh-1',
  name: 'Rex',
  breed: 'Beagle',
  birthDate: '2026-05-01',
  weightKg: 4.5,
  dailyFoodGramGoal: 200,
  targetMealsPerDay: 3,
  avatarUrl: '',
  notes: '',
  gender: null,
  expectedAdultWeightKg: null,
};

async function renderView({
  onAddPuppy = vi.fn().mockResolvedValue(true),
  onUpdatePuppy = vi.fn().mockResolvedValue(true),
  ...props
}: Partial<ComponentProps<typeof PuppiesView>> & { onAddPuppy?: Mock; onUpdatePuppy?: Mock } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <PuppiesView
        puppies={[REX]}
        activePuppyId={REX.id}
        onSelectPuppy={vi.fn()}
        onAddPuppy={onAddPuppy}
        onUpdatePuppy={onUpdatePuppy}
        onDeletePuppy={vi.fn()}
        {...props}
      />
    );
  });
  return { onAddPuppy, onUpdatePuppy };
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement;

async function setValue(id: string, value: string) {
  const input = field(id);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(element: Element) {
  await act(async () => (element as HTMLElement).click());
}

const editButton = () => document.querySelector('button[aria-label="Edit Profile"]')!;
const submit = () => click(document.querySelector('button[type="submit"]')!);

describe('PuppiesView edit form', () => {
  it('editing a dog with no stored adult weight sends a payload the server accepts', async () => {
    const { onUpdatePuppy } = await renderView();
    await click(editButton());
    await submit();

    expect(onUpdatePuppy).toHaveBeenCalledTimes(1);
    const parsed = DogInputSchema.partial().safeParse(onUpdatePuppy.mock.calls[0][0]);
    expect(parsed.error?.issues).toBeUndefined();
  });

  it('unselecting the sex and emptying the notes clears them', async () => {
    const { onUpdatePuppy } = await renderView({ puppies: [{ ...REX, gender: 'female', notes: 'Shy with bikes' }] });
    await click(editButton());
    await click(buttonByText('♀Female'));
    await setValue('dog-notes', '');
    await submit();

    expect(onUpdatePuppy.mock.calls[0][0]).toMatchObject({ gender: null, notes: '' });
  });

  it('"Other" with no breed name saves "Other", not the screen label', async () => {
    const { onUpdatePuppy } = await renderView({ puppies: [{ ...REX, breed: 'Other' }] });
    await click(editButton());
    expect(field('dog-custom-breed').value).toBe('');
    await submit();

    expect(onUpdatePuppy.mock.calls[0][0].breed).toBe('Other');
  });

  it('when the server refuses, the form stays open with what was typed', async () => {
    const { onUpdatePuppy } = await renderView({ onUpdatePuppy: vi.fn().mockResolvedValue(false) });
    await click(editButton());
    await setValue('dog-name', 'Rexy');
    await submit();

    expect(onUpdatePuppy).toHaveBeenCalledTimes(1);
    expect(field('dog-name')?.value).toBe('Rexy');
  });

  it('when the server saves, the form closes', async () => {
    await renderView();
    await click(editButton());
    await submit();

    expect(field('dog-name')).toBeNull();
  });

  it('a second tap on Save while saving sends nothing more', async () => {
    let finishSave!: (isSaved: boolean) => void;
    const { onUpdatePuppy } = await renderView({
      onUpdatePuppy: vi.fn(() => new Promise<boolean>((resolve) => { finishSave = resolve; })),
    });
    await click(editButton());
    await submit();
    await submit();

    expect(onUpdatePuppy).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    await act(async () => finishSave(true));
    expect(field('dog-name')).toBeNull();
  });
});

const buttonByText = (text: string) =>
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)!;

describe('PuppiesView gram goal (optional: "No gram goal" counts meals only)', () => {
  it('a dog with no gram goal shows the choice ticked and keeps it on save', async () => {
    const { onUpdatePuppy } = await renderView({ puppies: [{ ...REX, dailyFoodGramGoal: 0 }] });
    await click(editButton());
    expect(field('dog-no-gram-goal').checked).toBe(true);
    expect(field('dog-food-goal')).toBeNull();

    await submit();
    expect(onUpdatePuppy.mock.calls[0][0].dailyFoodGramGoal).toBe(0);
  });

  it('ticking "No gram goal" saves 0', async () => {
    const { onUpdatePuppy } = await renderView();
    await click(editButton());
    expect(field('dog-food-goal').value).toBe('200');
    await click(field('dog-no-gram-goal'));

    await submit();
    expect(onUpdatePuppy.mock.calls[0][0].dailyFoodGramGoal).toBe(0);
  });

  it.each(['', '5', '2001', '150.5'])('a goal of %j blocks Save with a message', async (goal) => {
    const { onUpdatePuppy } = await renderView();
    await click(editButton());
    await setValue('dog-food-goal', goal);
    await submit();

    expect(onUpdatePuppy).not.toHaveBeenCalled();
    expect(field('dog-food-goal-error').textContent).toBe('Enter 10 to 2000 g, or tick "No gram goal"');
  });

  it('a new dog starts with an empty goal box, not a made-up 200 g', async () => {
    await renderView();
    await click(buttonByText('Add Dog'));
    expect(field('dog-food-goal').value).toBe('');
    expect(field('dog-no-gram-goal').checked).toBe(false);
  });

  it('the dog card shows meals only when there is no gram goal', async () => {
    await renderView({ puppies: [{ ...REX, dailyFoodGramGoal: 0, targetMealsPerDay: 2 }] });
    expect(document.body.textContent).toContain('2 meals');
    expect(document.body.textContent).not.toMatch(/\d+g/);
  });
});

describe('PuppiesView expected adult weight (Other, Mixed or Unknown breed only)', () => {
  it('shows the box for a custom breed name, whatever the name', async () => {
    await renderView({ puppies: [{ ...REX, breed: 'Labradoodle', expectedAdultWeightKg: 25 }] });
    await click(editButton());
    expect(field('dog-adult-weight').value).toBe('25');
  });

  it('emptying the box clears the stored value', async () => {
    const { onUpdatePuppy } = await renderView({ puppies: [{ ...REX, breed: 'Mixed Breed', expectedAdultWeightKg: 20 }] });
    await click(editButton());
    await setValue('dog-adult-weight', '');
    await submit();

    expect(onUpdatePuppy.mock.calls[0][0].expectedAdultWeightKg).toBeNull();
  });

  it('a standard-breed dog keeps the adult weight it already stores', async () => {
    const { onUpdatePuppy } = await renderView({ puppies: [{ ...REX, breed: 'English Cocker Spaniel', expectedAdultWeightKg: 14.5 }] });
    await click(editButton());
    expect(field('dog-adult-weight')).toBeNull();
    await submit();

    expect(onUpdatePuppy.mock.calls[0][0].expectedAdultWeightKg).toBe(14.5);
  });
});

describe('PuppiesView add form', () => {
  it('a second tap on Save while the new dog is being saved adds no second dog', async () => {
    let finishSave!: (isSaved: boolean) => void;
    const { onAddPuppy } = await renderView({
      onAddPuppy: vi.fn(() => new Promise<boolean>((resolve) => { finishSave = resolve; })),
    });
    await click(buttonByText('Add Dog'));
    await setValue('dog-name', 'Max');
    // The breed picker's hidden native select, as browser autofill would use it
    const breedSelect = document.querySelector('select')!;
    await act(async () => {
      breedSelect.value = 'Beagle';
      breedSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await setValue('dog-birth-date', formatLocalDate(new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)));
    await setValue('dog-food-goal', '200');
    await submit();
    await submit();

    expect(onAddPuppy).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    await act(async () => finishSave(true));
    expect(field('dog-name')).toBeNull();
  });

  it('"Add Dog" pressed while a dog is being edited opens a blank form', async () => {
    await renderView();
    await click(editButton());
    expect(field('dog-name').value).toBe('Rex');

    await click(buttonByText('Add Dog'));
    expect(document.querySelectorAll('#dog-name')).toHaveLength(1);
    expect(field('dog-name').value).toBe('');
  });

  it('starts with no breed and no birth date, and Save says what is missing while the form stays open', async () => {
    const { onAddPuppy } = await renderView();
    await click(buttonByText('Add Dog'));
    expect(field('dog-birth-date').value).toBe('');
    expect(document.querySelector('[data-slot="select-trigger"]')!.textContent).toContain('Pick a breed');

    await setValue('dog-name', 'Rex');
    await submit();
    expect(onAddPuppy).not.toHaveBeenCalled();
    expect(field('dog-breed-error').textContent).toBe('Pick a breed, or Other / Mixed');
  });

  it.each([
    [70, '4'],
    [130, '3'],
    [250, '2'],
  ])('a new dog born %i days ago gets %s meals a day from its birth date, still editable', async (ageDays, meals) => {
    await renderView();
    await click(buttonByText('Add Dog'));
    expect(field('dog-meals-per-day').value).toBe('');

    await setValue('dog-birth-date', formatLocalDate(new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)));
    expect(field('dog-meals-per-day').value).toBe(meals);

    await setValue('dog-meals-per-day', '5');
    expect(field('dog-meals-per-day').value).toBe('5');
  });

  it('changing the birth date of a stored dog keeps its meals per day', async () => {
    await renderView();
    await click(editButton());
    await setValue('dog-birth-date', formatLocalDate(new Date(Date.now() - 70 * 24 * 60 * 60 * 1000)));
    expect(field('dog-meals-per-day').value).toBe('3');
  });

  it.each(['', '0', '7'])('meals per day %j blocks Save with a message', async (meals) => {
    const { onUpdatePuppy } = await renderView();
    await click(editButton());
    await setValue('dog-meals-per-day', meals);
    await submit();

    expect(onUpdatePuppy).not.toHaveBeenCalled();
    expect(field('dog-meals-per-day-error').textContent).toBe('Enter 1 to 6 meals');
  });

  it.each([
    ['', 'Enter the birth date'],
    [formatLocalDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), 'The birth date is in the future'],
  ])('birth date %j blocks Save with "%s" under the box', async (birthDate, message) => {
    const { onUpdatePuppy } = await renderView();
    await click(editButton());
    await setValue('dog-birth-date', birthDate);
    await submit();

    expect(onUpdatePuppy).not.toHaveBeenCalled();
    expect(field('dog-birth-date').getAttribute('aria-invalid')).toBe('true');
    expect(field('dog-birth-date').getAttribute('aria-describedby')).toBe('dog-birth-date-error');
    expect(field('dog-birth-date-error').textContent).toBe(message);
  });
});

describe('PuppiesView dog card picture', () => {
  it("a dog without a photo shows its initial, not the cocker mascot; a photo is still shown", async () => {
    await renderView({ puppies: [REX, { ...REX, id: 'dog-2', name: 'Balma', avatarUrl: '/balma.jpg' }] });

    expect(document.querySelector('img[src="/cocker_spaniel_mascot.jpg"]')).toBeNull();
    expect(document.getElementById('dog-avatar-dog-1')!.textContent).toBe('R');
    expect(document.querySelector('img[src="/balma.jpg"]')).not.toBeNull();
  });
});
