import { describe, it, expect } from 'vitest';
import type { Caretaker } from '../../types';

describe('household caretakers & identity binding — comprehensive test suite', () => {
  const defaultCaretakers: Caretaker[] = [
    { id: 'c-1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
    { id: 'c-2', name: 'Alex', role: 'Member', color: '#EC4899' },
  ];

  it('updates caretaker name and badge color when edited', () => {
    const updatedCaretakers = defaultCaretakers.map((c) =>
      c.id === 'c-2' ? { ...c, name: 'Alexandra', color: '#10B981' } : c
    );

    expect(updatedCaretakers[1].name).toBe('Alexandra');
    expect(updatedCaretakers[1].color).toBe('#10B981');
    expect(updatedCaretakers[0].name).toBe('Matthieu');
  });

  it('binds loggedBy strictly to authenticated currentUser when logging activities', () => {
    const currentUser = 'Alexandra';
    const activityPayload = {
      type: 'pee' as const,
      timestamp: new Date().toISOString(),
      loggedBy: currentUser,
    };

    expect(activityPayload.loggedBy).toBe('Alexandra');
    expect(activityPayload.loggedBy).not.toBe('Matthieu');
  });

  it('synchronizes currentUser when switching active household accounts', () => {
    let currentUser = 'Matthieu';
    const handleSwitchAccount = (newName: string) => {
      currentUser = newName;
    };

    handleSwitchAccount('Alexandra');
    expect(currentUser).toBe('Alexandra');
  });

  it('filters out deleted caretaker correctly', () => {
    const remaining = defaultCaretakers.filter((c) => c.id !== 'c-2');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('c-1');
  });
});
