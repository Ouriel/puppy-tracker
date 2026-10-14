import { describe, it, expect } from 'vitest';
import type { Caretaker } from '../../types';
import { resolveCaretakerName } from '../caretakers';

describe('household caretakers & identity binding — comprehensive test suite', () => {
  const defaultCaretakers: Caretaker[] = [
    { id: 'c-1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
    { id: 'c-2', name: 'Daria', role: 'Member', color: '#EC4899' },
  ];

  it('resolves Google SSO full name to clean Household Caretaker name', () => {
    expect(resolveCaretakerName('Matthieu Jacquet', defaultCaretakers)).toBe('Matthieu');
    expect(resolveCaretakerName('Daria Risko', defaultCaretakers)).toBe('Daria');
    expect(resolveCaretakerName('daria.risko@gmail.com', defaultCaretakers)).toBe('Daria');
    expect(resolveCaretakerName('Matthieu', defaultCaretakers)).toBe('Matthieu');
  });

  it('maps each production user to the caretaker row the delete guard must hide', () => {
    // Real household FAMILY-COCKER-2026 caretakers and user names (read-only SELECT, 2026-10-14).
    const productionCaretakers: Caretaker[] = [
      { id: 'c-1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
      { id: 'c-2', name: 'Daria', role: 'Member', color: '#EC4899' },
      { id: 'c-3', name: 'Dasha', role: 'Member', color: '#10B981' },
    ];
    expect(resolveCaretakerName('Matthieu Jacquet', productionCaretakers)).toBe('Matthieu');
    expect(resolveCaretakerName('Daria', productionCaretakers)).toBe('Daria');
    // No caretaker matches: no row is hidden.
    expect(resolveCaretakerName('guest.member', productionCaretakers)).toBe('guest.member');
  });
});
