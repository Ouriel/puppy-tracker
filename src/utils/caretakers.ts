import type { Caretaker } from '../types';

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
