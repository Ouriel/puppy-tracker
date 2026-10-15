// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useCaretakers } from '../useCaretakers';
import { clearApiCache } from '../../services/api';
import type { Caretaker } from '../../types';

const badge: Caretaker = { id: 'ct-1', name: 'Sam', role: 'Member', color: '#10B981' };

let root: Root | null = null;
let hook: ReturnType<typeof useCaretakers>;

function HookProbe({ onRender }: { onRender: (state: ReturnType<typeof useCaretakers>) => void }) {
  onRender(useCaretakers(null, [badge]));
  return null;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('puppace_lang_v1', 'fr');
  clearApiCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  root = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () => root!.render(<HookProbe onRender={(state) => { hook = state; }} />));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Backlog item 3: a failed save shows a French message, never the server's English error or the browser's "Load failed"
describe('a failed change shows a translated toast', () => {
  it.each([
    ['no connection (fetch rejected)', () => Promise.reject(new TypeError('Load failed')), "Pas de connexion, rien n'a été enregistré"],
    ['a server error', () => Promise.resolve(new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })), 'Une erreur est survenue — modifications annulées.'],
    ['an unknown refusal', () => Promise.resolve(new Response(JSON.stringify({ error: 'Invalid caretaker payload' }), { status: 400 })), 'Une erreur est survenue — modifications annulées.'],
    ['a taken name', () => Promise.resolve(new Response(JSON.stringify({ error: 'Another member already has this name.', code: 'memberNameTaken' }), { status: 409 })), 'Un autre membre porte déjà ce nom.'],
    ['a taken or foreign email', () => Promise.resolve(new Response(JSON.stringify({ error: 'Another member is already linked to this email.', code: 'memberEmailTaken' }), { status: 409 })), "Cet e-mail est déjà lié, ou n'est pas le vôtre."],
    ['an admin-only change', () => Promise.resolve(new Response(JSON.stringify({ error: 'Only an admin can unlink a member from a login.', code: 'memberAdminOnly' }), { status: 403 })), 'Seul un admin peut faire ce changement.'],
  ])('%s', async (_case, answer, message) => {
    vi.stubGlobal('fetch', vi.fn(answer));
    const danger = vi.spyOn(toast, 'danger');

    await act(async () => hook.updateCaretaker(badge.id, { name: 'Alex' }));

    expect(danger).toHaveBeenCalledWith(message);
    expect(hook.caretakers).toEqual([badge]);
  });
});
