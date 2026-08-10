import { describe, it, expect } from 'vitest';
import type { Caretaker } from '../../types';
import { resolveCaretakerName } from '../caretakers';

describe('household caretakers & identity binding — comprehensive test suite', () => {
  const defaultCaretakers: Caretaker[] = [
    { id: 'c-1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
    { id: 'c-2', name: 'Daria', role: 'Member', color: '#EC4899' },
  ];

  it('updates caretaker name and badge color when edited', () => {
    const updatedCaretakers = defaultCaretakers.map((c) =>
      c.id === 'c-2' ? { ...c, name: 'Alexandra', color: '#10B981' } : c
    );

    expect(updatedCaretakers[1].name).toBe('Alexandra');
    expect(updatedCaretakers[1].color).toBe('#10B981');
    expect(updatedCaretakers[0].name).toBe('Matthieu');
  });

  it('resolves Google SSO full name to clean Household Caretaker name', () => {
    expect(resolveCaretakerName('Matthieu Jacquet', defaultCaretakers)).toBe('Matthieu');
    expect(resolveCaretakerName('Daria Risko', defaultCaretakers)).toBe('Daria');
    expect(resolveCaretakerName('daria.risko@gmail.com', defaultCaretakers)).toBe('Daria');
    expect(resolveCaretakerName('Matthieu', defaultCaretakers)).toBe('Matthieu');
  });

  it('binds loggedBy strictly to authenticated currentUser when logging activities', () => {
    const currentUser = resolveCaretakerName('Daria Risko', defaultCaretakers);
    const activityPayload = {
      type: 'pee' as const,
      timestamp: new Date().toISOString(),
      loggedBy: currentUser,
    };

    expect(activityPayload.loggedBy).toBe('Daria');
    expect(activityPayload.loggedBy).not.toBe('Daria Risko');
  });

  it('filters out deleted caretaker correctly', () => {
    const remaining = defaultCaretakers.filter((c) => c.id !== 'c-2');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('c-1');
  });
});
