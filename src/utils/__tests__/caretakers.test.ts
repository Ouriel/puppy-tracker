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
});
