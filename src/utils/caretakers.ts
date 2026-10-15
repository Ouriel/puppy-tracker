import type { Caretaker } from '../types/index.js';

/**
 * Resolves a raw Google SSO full name (e.g. "Matthieu Jacquet" or "Daria Risko")
 * or email (e.g. "daria.risko@gmail.com") to the clean, friendly, editable Household Caretaker name
 * (e.g. "Matthieu" or "Daria").
 */
export function resolveCaretakerName(rawNameOrEmail: string, caretakers: Caretaker[]): string {
  if (!rawNameOrEmail || !caretakers || caretakers.length === 0) {
    return rawNameOrEmail ? rawNameOrEmail.split(/\s+/)[0] : '';
  }

  const cleanInput = rawNameOrEmail.trim().toLowerCase();

  // 1. Direct exact name match
  const exact = caretakers.find((c) => c.name.trim().toLowerCase() === cleanInput);
  if (exact) return exact.name;

  // 2. First name match (e.g. "Matthieu Jacquet" -> "Matthieu")
  const firstName = cleanInput.split(/\s+/)[0];
  const firstNameMatch = caretakers.find((c) => c.name.trim().toLowerCase() === firstName);
  if (firstNameMatch) return firstNameMatch.name;

  // 3. Caretaker name starts with clean input or clean input starts with caretaker name
  const prefixMatch = caretakers.find(
    (c) =>
      cleanInput.startsWith(c.name.trim().toLowerCase()) ||
      c.name.trim().toLowerCase().startsWith(cleanInput)
  );
  if (prefixMatch) return prefixMatch.name;

  // 4. Email username match (e.g. "daria.risko@gmail.com" -> "Daria")
  const emailUsername = cleanInput.split('@')[0].split('.')[0];
  const emailMatch = caretakers.find((c) => c.name.trim().toLowerCase() === emailUsername);
  if (emailMatch) return emailMatch.name;

  // Fallback to first word of input (e.g. "Matthieu" from "Matthieu Jacquet")
  return rawNameOrEmail.split(/\s+/)[0];
}

/**
 * The name an activity is logged under: the badge linked to the signed-in user (findLinkedCaretaker), else the
 * account name, else the email prefix. The log modal shows it and the API stores it, so both sides must use this
 * one function.
 */
export function getCurrentCaretakerName(
  user: { email?: string | null; name?: string | null } | null,
  caretakers: Array<{ name: string; email?: string | null }>
): string {
  if (!user) return 'Unknown';
  return findLinkedCaretaker(user, caretakers)?.name ?? (user.name || (user.email ? user.email.split('@')[0] : 'Unknown'));
}

/**
 * The badge linked to a login: the one carrying the user's email, else a badge without an email whose name is
 * exactly the account name (ignoring case). A badge carrying an email belongs to that email only. Never guessed
 * from first names or email prefixes. Logged-by, the active chip and the delete guard all use this one rule.
 */
export function findLinkedCaretaker<T extends { name: string; email?: string | null }>(
  user: { email?: string | null; name?: string | null } | null,
  caretakers: T[]
): T | undefined {
  const userEmail = user?.email?.toLowerCase();
  const userName = user?.name?.toLowerCase();
  return (
    (userEmail ? caretakers.find((item) => item.email?.toLowerCase() === userEmail) : undefined) ??
    (userName ? caretakers.find((item) => !item.email && item.name.toLowerCase() === userName) : undefined)
  );
}

export const BADGE_COLORS = ['#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EF4444', '#14B8A6', '#F97316'];

/** The first badge colour no other badge uses; when all are taken, the palette cycles. */
export function firstFreeBadgeColor(caretakers: Array<{ color: string }>): string {
  const usedColors = new Set(caretakers.map((item) => item.color.toLowerCase()));
  return BADGE_COLORS.find((color) => !usedColors.has(color.toLowerCase())) ?? BADGE_COLORS[caretakers.length % BADGE_COLORS.length];
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** 'jane.doe@example.com' -> 'Jane' */
export function badgeNameFromEmail(email: string): string {
  const localPart = email.trim().toLowerCase().split('@')[0];
  return capitalise(localPart.split(/[._+]/).find(Boolean) ?? localPart);
}

/**
 * The badge an invite creates, linked to the invited email; null when a badge already carries that email.
 * loggedBy is stored as a name, so the name is one no other badge uses: 'Jane', else 'Jane.doe', else 'Jane.doe 2'.
 */
export function buildInviteBadge(email: string, caretakers: Caretaker[]): Caretaker | null {
  const invitedEmail = email.trim().toLowerCase();
  if (caretakers.some((item) => item.email?.toLowerCase() === invitedEmail)) return null;
  const usedNames = new Set(caretakers.map((item) => item.name.trim().toLowerCase()));
  const fullName = capitalise(invitedEmail.split('@')[0]);
  let name = [badgeNameFromEmail(invitedEmail), fullName].find((candidate) => !usedNames.has(candidate.toLowerCase()));
  for (let number = 2; !name; number += 1) {
    if (!usedNames.has(`${fullName} ${number}`.toLowerCase())) name = `${fullName} ${number}`;
  }
  return {
    id: `c-${Date.now()}`,
    name,
    role: 'Member',
    color: firstFreeBadgeColor(caretakers),
    email: invitedEmail,
  };
}
