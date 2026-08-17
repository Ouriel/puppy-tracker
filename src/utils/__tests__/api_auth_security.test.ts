import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signAppSessionToken, verifyAppSessionToken } from '../../../api/_auth.js';
import { ActivityInputSchema, DogInputSchema, CaretakerInputSchema } from '../schemas';

describe('API Security & Session Token Validation Test Suite', () => {
  const originalEnv = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-key-1234567890-very-secure';
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalEnv;
  });

  it('generates and cryptographically verifies a valid App Session Token', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Husband',
    };

    const token = signAppSessionToken(payload, 30);
    expect(token).toBeDefined();
    expect(token.split('.').length).toBe(3);

    const verified = verifyAppSessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe('user@example.com');
    expect(verified?.householdId).toBe('hh-family-123');
    expect(verified?.role).toBe('Husband');
  });

  it('rejects tampered tokens with invalid signatures', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Member',
    };

    const token = signAppSessionToken(payload, 30);
    const [header, , signature] = token.split('.');

    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, role: 'SuperAdmin' })
    ).toString('base64url');

    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
    const result = verifyAppSessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it('rejects expired tokens', () => {
    const payload = {
      email: 'user@example.com',
      name: 'Test User',
      householdId: 'hh-family-123',
      role: 'Member',
    };

    // Generate token with negative expiration (-1 day)
    const token = signAppSessionToken(payload, -1);
    const result = verifyAppSessionToken(token);
    expect(result).toBeNull();
  });

  it('prevents privilege escalation by spoofing SuperAdmin role in non-admin email token', () => {
    const payload = {
      email: 'hacker@random-domain.com',
      name: 'Attacker',
      householdId: 'hh-123',
      role: 'SuperAdmin',
    };

    const token = signAppSessionToken(payload, 30);
    const verified = verifyAppSessionToken(token);

    expect(verified).not.toBeNull();
    // Non-superadmin email MUST be downgraded to Member
    expect(verified?.role).toBe('Member');
  });

  it('validates Zod payload schemas to prevent multi-tenant data leakage or missing household boundaries', () => {
    // Activity schema requires type, timestamp
    const validActivity = {
      puppyId: 'pup-1',
      type: 'pee',
      timestamp: '2026-08-17T12:00:00.000Z',
      loggedBy: 'Matthieu',
    };
    expect(ActivityInputSchema.safeParse(validActivity).success).toBe(true);

    // Invalid activity type rejected
    const invalidActivity = {
      puppyId: 'pup-1',
      type: 'unknown_action',
      timestamp: '2026-08-17T12:00:00.000Z',
    };
    expect(ActivityInputSchema.safeParse(invalidActivity).success).toBe(false);

    // Puppy schema validates required fields
    const validPuppy = {
      id: 'pup-123',
      name: 'Balma',
      breed: 'English Cocker Spaniel',
      birthDate: '2026-03-27',
      dailyFoodGramGoal: 240,
    };
    expect(DogInputSchema.safeParse(validPuppy).success).toBe(true);

    // Caretaker schema validates name and email
    const validCaretaker = {
      name: 'Matthieu',
      email: 'matthieu@example.com',
      role: 'Husband',
    };
    expect(CaretakerInputSchema.safeParse(validCaretaker).success).toBe(true);
  });
});
