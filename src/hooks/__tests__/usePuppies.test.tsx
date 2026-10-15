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

function HookProbe({ onRender }: { onRender: (state: ReturnType<typeof usePuppies>) => void }) {
  onRender(usePuppies([rex]));
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
