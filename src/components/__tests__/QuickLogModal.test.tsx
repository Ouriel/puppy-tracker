// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QuickLogModal } from '../QuickLogModal';

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
