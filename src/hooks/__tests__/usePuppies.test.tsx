// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePuppies } from '../usePuppies';
import { clearApiCache } from '../../services/api';
import type { PuppyProfile } from '../../types';

const rex: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-01-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200 };

let root: Root | null = null;
let hook: ReturnType<typeof usePuppies>;

function HookProbe({ onRender, puppies = [rex] }: { onRender: (state: ReturnType<typeof usePuppies>) => void; puppies?: PuppyProfile[] }) {
  onRender(usePuppies(puppies));
  return null;
}

/** Every request gets this answer, like the server would. */
function answerWith(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  localStorage.clear();
  clearApiCache();
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<HookProbe onRender={(state) => { hook = state; }} />));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function call(action: () => Promise<boolean>) {
  let isSaved: boolean | undefined;
  await act(async () => {
    isSaved = await action();
  });
  return isSaved;
}

// The dog form stays open with what was typed only when these resolve false.
describe('usePuppies: add and update say whether the server saved the dog', () => {
  it('a refused update resolves false and puts the stored dog back', async () => {
    answerWith(400, { error: 'Invalid dog' });

    expect(await call(() => hook.updatePuppy({ ...rex, name: 'Rexy' }))).toBe(false);
    expect(hook.puppies).toEqual([rex]);
  });

  it('a saved update resolves true and keeps what the server stored', async () => {
    answerWith(200, { ...rex, name: 'Rexy' });

    expect(await call(() => hook.updatePuppy({ ...rex, name: 'Rexy' }))).toBe(true);
    expect(hook.puppies.map((puppy) => puppy.name)).toEqual(['Rexy']);
  });

  it('a refused new dog resolves false and adds nothing', async () => {
    answerWith(400, { error: 'Invalid dog' });

    expect(await call(() => hook.addPuppy({ ...rex, id: 'pup-2', name: 'Max' }))).toBe(false);
    expect(hook.puppies).toEqual([rex]);
  });

  it('a saved new dog resolves true', async () => {
    answerWith(201, { ...rex, id: 'pup-2', name: 'Max' });

    expect(await call(() => hook.addPuppy({ ...rex, id: 'pup-2', name: 'Max' }))).toBe(true);
    expect(hook.puppies.map((puppy) => puppy.id)).toEqual(['pup-1', 'pup-2']);
  });
});

// Improvement backlog 17: a refused change undoes only its own dog, never a later change the server saved.
describe('usePuppies: a refused change rolls back only its own dog', () => {
  const max: PuppyProfile = { ...rex, id: 'pup-2', name: 'Max' };
  const luna: PuppyProfile = { ...rex, id: 'pup-3', name: 'Luna' };

  it.each([
    ['an edit', () => hook.updatePuppy({ ...rex, name: 'Rexy' })],
    // The first dog: a refused deletion puts it back in its place, not at the end
    ['a deletion', () => hook.deletePuppy('pup-1')],
  ])('%s refused after a later edit was saved', async (_label, firstChange) => {
    // Each request waits until the test answers it, so answers can come back in any order
    const pendingAnswers: Array<(response: Response) => void> = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => pendingAnswers.push(resolve))));
    await act(async () => root!.render(<HookProbe key="three-dogs" puppies={[rex, max, luna]} onRender={(state) => { hook = state; }} />));

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    await act(async () => { first = firstChange(); });
    await act(async () => { second = hook.updatePuppy({ ...max, name: 'Maxi' }); });

    await act(async () => {
      pendingAnswers[1](new Response(JSON.stringify({ ...max, name: 'Maxi' }), { status: 200 }));
      await second;
    });
    await act(async () => {
      pendingAnswers[0](new Response(JSON.stringify({ error: 'Only the owner can delete dogs' }), { status: 403 }));
      await first;
    });

    expect(hook.puppies).toEqual([rex, { ...max, name: 'Maxi' }, luna]);
  });

  it('a refused deletion adds no second copy when a reload already brought the dog back', async () => {
    const pendingAnswers: Array<(response: Response) => void> = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => pendingAnswers.push(resolve))));
    await act(async () => root!.render(<HookProbe key="three-dogs" puppies={[rex, max, luna]} onRender={(state) => { hook = state; }} />));

    let deletion: Promise<unknown> = Promise.resolve();
    await act(async () => { deletion = hook.deletePuppy('pup-1'); });
    await act(async () => hook.setPuppies([rex, max, luna]));

    await act(async () => {
      pendingAnswers[0](new Response(JSON.stringify({ error: 'Only the owner can delete dogs' }), { status: 403 }));
      await deletion;
    });

    expect(hook.puppies).toEqual([rex, max, luna]);
  });
});

// Backlog item 20: the server only hides a deleted dog; the owner sees it under "Deleted dogs" and restores it
describe('usePuppies: restorable delete', () => {
  const max: PuppyProfile = { ...rex, id: 'pup-2', name: 'Max' };
  const ids = (puppies: PuppyProfile[]) => puppies.map((puppy) => puppy.id);

  it('a deleted dog moves to deletedPuppies, and a restore puts it back in the list', async () => {
    answerWith(200, { success: true, deletedId: 'pup-1' });
    await act(async () => hook.deletePuppy('pup-1'));

    expect(hook.puppies).toEqual([]);
    expect(ids(hook.deletedPuppies)).toEqual(['pup-1']);

    answerWith(200, { ...rex, deletedAt: null });
    await act(async () => hook.restorePuppy('pup-1'));

    expect(ids(hook.puppies)).toEqual(['pup-1']);
    expect(hook.deletedPuppies).toEqual([]);
  });

  it('a refused restore leaves the dog in deletedPuppies and the list as it was', async () => {
    await act(async () => root!.render(<HookProbe key="max-only" puppies={[max]} onRender={(state) => { hook = state; }} />));
    await act(async () => hook.setDeletedPuppies([rex]));
    answerWith(403, { error: 'Only the owner can restore dogs' });

    await act(async () => hook.restorePuppy('pup-1'));

    expect(ids(hook.puppies)).toEqual(['pup-2']);
    expect(ids(hook.deletedPuppies)).toEqual(['pup-1']);
  });
});
