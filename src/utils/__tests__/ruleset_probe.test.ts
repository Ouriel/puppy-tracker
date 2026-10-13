import { describe, it, expect } from 'vitest';

// Deliberately red: proves the main ruleset blocks a failing PR even with auto-merge armed. Never merge.
describe('ruleset probe', () => {
  it('fails on purpose', () => {
    expect(1 + 1).toBe(3);
  });
});
