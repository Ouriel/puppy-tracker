import { describe, it, expect } from 'vitest';
import type { Caretaker } from '../../types';
import { resolveCaretakerName, badgeNameFromEmail, firstFreeBadgeColor, buildInviteBadge, findLinkedCaretaker, getCurrentCaretakerName, BADGE_COLORS } from '../caretakers';

describe('household caretakers & identity binding — comprehensive test suite', () => {
  const defaultCaretakers: Caretaker[] = [
    { id: 'c-1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
    { id: 'c-2', name: 'Daria', role: 'Member', color: '#EC4899' },
  ];

  it('resolves Google SSO full name to clean Household Caretaker name', () => {
    expect(resolveCaretakerName('Matthieu Jacquet', defaultCaretakers)).toBe('Matthieu');
    expect(resolveCaretakerName('Daria Doe', defaultCaretakers)).toBe('Daria');
    expect(resolveCaretakerName('daria@example.com', defaultCaretakers)).toBe('Daria');
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

describe('invite badges (19, 42)', () => {
  const badges: Caretaker[] = [
    { id: 'c-1', name: 'Matthieu', role: 'Member', color: '#EC4899' },
    { id: 'c-2', name: 'Daria', role: 'Member', color: '#10b981', email: 'daria@example.com' },
  ];

  it('names the badge with the capitalised first part of the email', () => {
    expect(badgeNameFromEmail('jane.doe@example.com')).toBe('Jane');
    expect(badgeNameFromEmail('janedoe@example.com')).toBe('Janedoe');
    expect(badgeNameFromEmail('bob_smith+puppy@example.com')).toBe('Bob');
  });

  it('never gives an empty name when the email starts with a separator (the server requires a name)', () => {
    expect(badgeNameFromEmail('_bob@example.com')).toBe('Bob');
    expect(badgeNameFromEmail('.x@example.com')).toBe('X');
  });

  it('gives a new badge the first colour no other badge uses (case-insensitive)', () => {
    expect(firstFreeBadgeColor([])).toBe(BADGE_COLORS[0]);
    expect(firstFreeBadgeColor(badges)).toBe(BADGE_COLORS[2]);
    // Every colour taken: cycle instead of failing
    const allTaken = BADGE_COLORS.map((color, index) => ({ id: `c-${index}`, name: `N${index}`, role: 'Member' as const, color }));
    expect(BADGE_COLORS).toContain(firstFreeBadgeColor(allTaken));
  });

  it('builds the invited badge with the email, the name from the email and the first free colour', () => {
    expect(buildInviteBadge('jane.doe@example.com', badges)).toMatchObject({
      name: 'Jane',
      email: 'jane.doe@example.com',
      color: BADGE_COLORS[2],
      role: 'Member',
    });
  });

  it('builds no second badge for an email a badge already carries', () => {
    expect(buildInviteBadge('DARIA@example.com', badges)).toBeNull();
  });

  // loggedBy is stored as a name: two badges with one name would merge two people's logs.
  it('gives the badge a name no other badge uses, ignoring case', () => {
    expect(buildInviteBadge('daria.work@example.com', badges)?.name).toBe('Daria.work');
    const crowded = [...badges, { id: 'c-3', name: 'daria.WORK', role: 'Member' as const, color: '#F59E0B' }];
    expect(buildInviteBadge('daria.work@example.com', crowded)?.name).toBe('Daria.work 2');
    expect(buildInviteBadge('matthieu@other.example', badges)?.name).toBe('Matthieu 2');
  });
});

describe('findLinkedCaretaker: the badge linked to a login (22)', () => {
  const owner = { email: 'owner@example.com', name: 'Owner Fullname' };

  it('links by email, whatever the names', () => {
    const badges = [
      { id: 'c-1', name: 'Owner Fullname', email: null },
      { id: 'c-2', name: 'Me', email: 'OWNER@example.com' },
    ];
    expect(findLinkedCaretaker(owner, badges)?.id).toBe('c-2');
  });

  it('never links by name to a badge that carries an email', () => {
    const badges = [
      { id: 'c-1', name: 'Owner Fullname', email: 'someone.else@example.com' },
      { id: 'c-2', name: 'Daria', email: 'daria@example.com' },
    ];
    expect(findLinkedCaretaker(owner, badges)).toBeUndefined();
  });

  it('is the logged-by rule: the chip and getCurrentCaretakerName always pick the same badge', () => {
    const badges = [
      { id: 'c-1', name: 'Owner', email: 'owner@example.com' },
      { id: 'c-2', name: 'Guest', email: null },
    ];
    // A badge linked to another email is never taken by name.
    expect(findLinkedCaretaker({ email: 'other@example.com', name: 'owner' }, badges)).toBeUndefined();
    expect(getCurrentCaretakerName({ email: 'other@example.com', name: 'owner' }, badges)).toBe('owner');
    // An unlinked badge still matches the exact account name.
    expect(findLinkedCaretaker({ email: 'guest@example.com', name: 'Guest' }, badges)?.id).toBe('c-2');
    expect(getCurrentCaretakerName({ email: 'guest@example.com', name: 'Guest' }, badges)).toBe('Guest');
  });

  it('falls back to the exact name (ignoring case) only for badges without an email', () => {
    const badges = [
      { id: 'c-1', name: 'Owner', email: null },
      { id: 'c-2', name: 'owner fullname', email: null },
    ];
    expect(findLinkedCaretaker(owner, badges)?.id).toBe('c-2');
    expect(findLinkedCaretaker({ email: 'x@example.com', name: 'Owner Fullname Junior' }, badges)).toBeUndefined();
  });
});
