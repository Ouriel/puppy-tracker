// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { HouseholdView } from '../../views/HouseholdView';
import type { Caretaker } from '../../types';

// App review 2026-10-16, S5: French labels by default, a calm tone for harmless questions, and a badge delete that asks first.

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

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  localStorage.clear();
});

async function render(element: ReactElement, lang: 'en' | 'fr') {
  localStorage.setItem('puppace_lang_v1', lang);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
}

const dialogButtons = () => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].map((button) => button.textContent!.trim());

describe('ConfirmationModal', () => {
  it('a delete question in French reads "Annuler" / "Supprimer", never "Cancel" / "Delete"', async () => {
    await render(<ConfirmationModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Supprimer l'activité" message="Sûr ?" />, 'fr');
    expect(dialogButtons()).toEqual(['Annuler', 'Supprimer']);
    expect(document.body.textContent).not.toMatch(/Cancel|Delete/);
  });

  it('in English: "Cancel" / "Delete"', async () => {
    await render(<ConfirmationModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Delete" message="Sure?" />, 'en');
    expect(dialogButtons()).toEqual(['Cancel', 'Delete']);
  });

  it('a harmless question (tone "primary"): indigo, no warning triangle', async () => {
    await render(<ConfirmationModal isOpen tone="primary" onClose={vi.fn()} onConfirm={vi.fn()} title="Ajouter" message="L'ajouter ?" confirmLabel="Ajouter" />, 'fr');
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((button) => button.textContent === 'Ajouter')!;
    expect(confirm.className).toContain('bg-indigo-600');
    expect(confirm.className).not.toMatch(/red/);
    expect(document.querySelector('[role="dialog"] .lucide-triangle-alert')).toBeNull();
  });

  it('a delete (default tone "danger") keeps the red button and the warning triangle', async () => {
    await render(<ConfirmationModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Supprimer" message="Sûr ?" />, 'fr');
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((button) => button.textContent === 'Supprimer')!;
    expect(confirm.className).toMatch(/red/);
    expect(document.querySelector('[role="dialog"] .lucide-triangle-alert')).not.toBeNull();
  });
});

describe('Members tab: deleting a badge asks first (owner decision D13)', () => {
  const badges: Caretaker[] = [
    { id: 'c-me', name: 'Sam', role: 'Member', color: '#EC4899', email: 'sam@example.com' },
    { id: 'c-marie', name: 'Marie', role: 'Member', color: '#10B981' },
  ];

  it('the trash opens a question naming the badge; only "Supprimer" deletes it', async () => {
    const onDeleteCaretaker = vi.fn();
    await render(
      <HouseholdView caretakers={badges} user={{ email: 'sam@example.com', name: 'Sam', role: 'Member' }} onAddCaretaker={vi.fn()} onUpdateCaretaker={vi.fn()} onDeleteCaretaker={onDeleteCaretaker} />,
      'fr'
    );
    const trash = document.querySelector<HTMLButtonElement>('button:has(.lucide-trash-2)')!;
    await act(async () => trash.click());

    expect(onDeleteCaretaker).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Marie');
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((button) => button.textContent === 'Supprimer')!;
    await act(async () => confirm.click());
    expect(onDeleteCaretaker).toHaveBeenCalledWith('c-marie');
  });
});
