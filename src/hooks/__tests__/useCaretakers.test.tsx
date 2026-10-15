// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCaretakers } from '../useCaretakers';
import { clearApiCache } from '../../services/api';
import type { Caretaker } from '../../types';

const alice: Caretaker = { id: 'c-1', name: 'Alice', role: 'Member', color: 'bg-amber-500' };
const bob: Caretaker = { id: 'c-2', name: 'Bob', role: 'Member', color: 'bg-sky-500' };
const eve: Caretaker = { id: 'c-3', name: 'Eve', role: 'Member', color: 'bg-rose-500' };

let root: Root | null = null;
let hook: ReturnType<typeof useCaretakers>;
// Each request waits until the test answers it, so answers can come back in any order
let pendingAnswers: Array<(response: Response) => void> = [];

function HookProbe({ onRender }: { onRender: (state: ReturnType<typeof useCaretakers>) => void }) {
  onRender(useCaretakers(null, [alice, bob, eve]));
  return null;
}

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  localStorage.clear();
  clearApiCache();
  pendingAnswers = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => pendingAnswers.push(resolve))));
  root = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () => root!.render(<HookProbe onRender={(state) => { hook = state; }} />));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

// Improvement backlog 17: a refused change undoes only its own badge, never a later change the server saved.
describe('useCaretakers: a refused change rolls back only its own badge', () => {
  it.each([
    ['a new badge', () => hook.addCaretaker({ id: 'c-4', name: 'Bob', role: 'Member', color: 'bg-lime-500' })],
    ['a rename', () => hook.updateCaretaker('c-1', { name: 'Bob' })],
    // The first badge: a refused removal puts it back in its place, not at the end
    ['a removal', () => hook.deleteCaretaker('c-1')],
  ])('%s refused after a later rename was saved', async (_label, firstChange) => {
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    await act(async () => { first = firstChange(); });
    await act(async () => { second = hook.updateCaretaker('c-2', { name: 'Sam' }); });

    await act(async () => {
      pendingAnswers[1](answer(200, { ...bob, name: 'Sam' }));
      await second;
    });
    await act(async () => {
      pendingAnswers[0](answer(409, { error: 'Another member already has this name.' }));
      await first;
    });

    expect(hook.caretakers).toEqual([alice, { ...bob, name: 'Sam' }, eve]);
  });

  it('a refused removal adds no second copy when a reload already brought the badge back', async () => {
    let removal: Promise<void> = Promise.resolve();
    await act(async () => { removal = hook.deleteCaretaker('c-1'); });
    await act(async () => hook.setCaretakers([alice, bob, eve]));

    await act(async () => {
      pendingAnswers[0](answer(403, { error: 'Only an admin can remove a badge' }));
      await removal;
    });

    expect(hook.caretakers).toEqual([alice, bob, eve]);
  });
});
