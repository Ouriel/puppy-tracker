// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QuickLogModal } from '../QuickLogModal';
import { getLocalDatetimeString } from '../../utils/date';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom lacks these; the HeroUI / react-aria modal reads them.
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

async function renderModal(props: Partial<ComponentProps<typeof QuickLogModal>>) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<QuickLogModal isOpen onClose={onClose} onSave={onSave} currentUser="Tester" {...props} />);
  });
  return { onSave, onClose };
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

/** Clears the box, then types one key at a time, as on a phone keyboard. */
async function typeKeys(id: string, text: string) {
  await setValue(id, '');
  for (const key of text) await setValue(id, field(id).value + key);
}

/** Clicks Save, so the browser's own form checks run as they would on a phone. */
async function submit() {
  await act(async () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
}

describe('QuickLogModal grams and weight boxes', () => {
  it('a new weight log starts empty and "10,4" typed key by key saves 10.4 kg', async () => {
    const { onSave, onClose } = await renderModal({ initialType: 'weight' });
    expect(field('quicklog-weight-kg').value).toBe('');

    await typeKeys('quicklog-weight-kg', '10,4');
    expect(field('quicklog-weight-kg').value).toBe('10,4');

    await submit();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'weight', weightKg: 10.4 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('an emptied grams box stays empty, and Save is blocked with a message while the form stays open', async () => {
    const { onSave, onClose } = await renderModal({ initialType: 'food', defaultMealPortionGrams: 100 });
    expect(field('quicklog-quantity-grams').value).toBe('100');

    await setValue('quicklog-quantity-grams', '');
    expect(field('quicklog-quantity-grams').value).toBe('');

    await submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(field('quicklog-quantity-grams').getAttribute('aria-invalid')).toBe('true');
    expect(field('quicklog-quantity-grams').getAttribute('aria-describedby')).toBe('quicklog-quantity-grams-error');
    expect(field('quicklog-quantity-grams-error').textContent).toBe('Enter the grams eaten');

    await typeKeys('quicklog-quantity-grams', '35');
    await submit();
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'food', quantityGrams: 35, quantityCups: 0.32 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['weight', 'quicklog-weight-kg', 'abc', 'Check the weight (e.g. 10.4)'],
    ['pee', 'quicklog-timestamp', '', 'Pick a date and time'],
    ['pee', 'quicklog-timestamp', getLocalDatetimeString(new Date(Date.now() + 10 * 60 * 1000)), 'This time is in the future'],
    ['medication', 'quicklog-medication-name', '  ', 'Enter the treatment'],
  ] as const)('%s: #%s set to %j blocks Save with the message under the box', async (initialType, id, value, message) => {
    const { onSave, onClose } = await renderModal({ initialType });
    await setValue(id, value);

    await submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(field(id).getAttribute('aria-invalid')).toBe('true');
    expect(field(id).getAttribute('aria-describedby')).toBe(`${id}-error`);
    expect(field(`${id}-error`).textContent).toBe(message);
  });

  it('never pre-fills 0 g, and focusing the box selects its text', async () => {
    await renderModal({ initialType: 'food', defaultMealPortionGrams: 0 });
    expect(field('quicklog-quantity-grams').value).toBe('');

    await act(async () => root!.unmount());
    document.body.innerHTML = '';
    await renderModal({ initialType: 'food', defaultMealPortionGrams: 65 });
    const grams = field('quicklog-quantity-grams');
    await act(async () => grams.focus());
    expect([grams.selectionStart, grams.selectionEnd]).toEqual([0, 2]);
  });

  it('edit mode shows what is stored: no 80 g or 4.2 kg fallback, even after changing the type', async () => {
    await renderModal({
      activityToEdit: { id: 'act-1', puppyId: 'pup-1', type: 'food', timestamp: '2026-10-13T08:15:00.000Z', loggedBy: 'Tester' },
    });
    expect(field('quicklog-quantity-grams').value).toBe('');

    const weightButton = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((button) => button.textContent === 'Weight')!;
    await act(async () => weightButton.click());
    expect(field('quicklog-weight-kg').value).toBe('');
  });
});

describe('QuickLogModal labels and notes', () => {
  it('a new log shows "Logged by" the signed-in user, read-only', async () => {
    await renderModal({ initialType: 'pee', currentUser: 'Alex' });
    const loggedBy = document.getElementById('quicklog-logged-by')!;
    expect(loggedBy.textContent).toBe('Logged by Alex');
    expect(loggedBy.tagName).not.toBe('INPUT');
  });

  it('an edit shows the original author, not the person editing', async () => {
    await renderModal({
      currentUser: 'Tester',
      activityToEdit: { id: 'act-1', puppyId: 'pup-1', type: 'pee', timestamp: '2026-10-13T08:15:00.000Z', loggedBy: 'Sam' },
    });
    expect(document.getElementById('quicklog-logged-by')!.textContent).toBe('Logged by Sam');
  });

  it('emptying the note of an edit saves null, so the note is deleted', async () => {
    const { onSave } = await renderModal({
      activityToEdit: { id: 'act-1', puppyId: 'pup-1', type: 'pee', timestamp: '2026-10-13T08:15:00.000Z', loggedBy: 'Tester', notes: 'old note' },
    });
    await setValue('quicklog-notes', '');
    await submit();
    expect(onSave.mock.calls[0][0].notes).toBeNull();
  });

  it('the notes placeholder is neutral and the grams label names its unit once', async () => {
    await renderModal({ initialType: 'food' });
    expect(field('quicklog-notes').placeholder).toBe('Optional');
    expect(document.querySelector('label[for="quicklog-quantity-grams"]')!.textContent).toBe('Quantity (g)');
  });
});

describe('QuickLogModal weight box: last weigh-in hint and decimal check (Phase 5c)', () => {
  const lastWeighIn = { id: 'act-w', puppyId: 'pup-1', type: 'weight' as const, timestamp: '2026-09-25T07:00:00.000Z', weightKg: 10.05, loggedBy: 'Tester' };
  const weightBoxText = () => field('quicklog-weight-kg').parentElement!.textContent!;

  afterEach(() => localStorage.clear());

  it('the box starts empty with the last weigh-in as a hint, whatever its date; none before a first weigh-in', async () => {
    await renderModal({ initialType: 'weight', lastWeighIn });
    expect(field('quicklog-weight-kg').value).toBe('');
    expect(weightBoxText()).toContain('Last weigh-in: 10.05 kg on 09/25');

    await act(async () => root!.unmount());
    document.body.innerHTML = '';
    await renderModal({ initialType: 'weight' });
    expect(weightBoxText()).not.toContain('Last weigh-in');
  });

  it.each([
    ['25', 'Check the decimal point: 25 kg?'],
    ['4,9', 'Check the decimal point: 4.9 kg?'],
    ['10,4', null],
    ['20,1', null],
  ])('typing %j after a 10.05 kg weigh-in warns %j, and never blocks Save', async (typed, warning) => {
    const { onSave } = await renderModal({ initialType: 'weight', lastWeighIn });
    await typeKeys('quicklog-weight-kg', typed);

    const status = document.querySelector('[role="status"]');
    expect(status?.textContent ?? null).toBe(warning);
    await submit();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('in French: "Dernière pesée : 10,05 kg le 25/09" and "Vérifie la virgule : 1,005 kg ?"', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    await renderModal({ initialType: 'weight', lastWeighIn });
    await typeKeys('quicklog-weight-kg', '1,005');

    expect(weightBoxText()).toContain('Dernière pesée : 10,05 kg le 25/09');
    expect(document.querySelector('[role="status"]')!.textContent).toBe('Vérifie la virgule : 1,005 kg ?');
  });
});
