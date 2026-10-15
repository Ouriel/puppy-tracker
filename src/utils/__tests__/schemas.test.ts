import { describe, it, expect } from 'vitest';
import {
  ActivityInputSchema,
  DogInputSchema,
  HealthRecordInputSchema,
  CaretakerInputSchema,
  UserInputSchema,
  DeleteSchema,
  DashboardQuerySchema,
} from '../schemas';
import type { ZodType } from 'zod';
import { buildQuickActionActivity, buildQuickLogActivity, validateQuickLogForm } from '../activityPayloads';
import { buildDogPayload, dogFormFromProfile, NEW_DOG_FORM } from '../dogForm';
import { buildInviteBadge } from '../caretakers';
import { getHealthProtocols } from '../health';

describe('Zod Schemas Validation', () => {
  it('should validate activity input mutation schema with string numbers', () => {
    const inputActivity = {
      puppyId: 'pup-1',
      type: 'food' as const,
      quantityGrams: '85',
      foodType: 'kibble',
    };

    const parsed = ActivityInputSchema.safeParse(inputActivity);
    expect(parsed.success).toBe(true);
  });

  it('should validate dog and health record input schemas', () => {
    const inputDog = {
      name: 'Balma',
      breed: 'English Cocker Spaniel',
      birthDate: '2026-05-01',
      weightKg: '7.8',
      dailyFoodGramGoal: 240,
    };
    expect(DogInputSchema.safeParse(inputDog).success).toBe(true);

    const inputHealth = {
      puppyId: 'pup-1',
      type: 'deworming' as const,
      name: 'Credelio Plus',
      date: '2026-08-01',
      weightAtTime: '7.8',
    };
    expect(HealthRecordInputSchema.safeParse(inputHealth).success).toBe(true);

    const inputCaretaker = {
      name: 'Matthieu',
      role: 'Husband',
      email: 'matthieu@example.com',
    };
    expect(CaretakerInputSchema.safeParse(inputCaretaker).success).toBe(true);
  });

  it('rejects activity inputs with an unknown type and health record inputs without puppyId or date', () => {
    expect(ActivityInputSchema.safeParse({ puppyId: 'pup-1', type: 'unknown_action', timestamp: '2026-08-17T12:00:00.000Z' }).success).toBe(false);
    expect(HealthRecordInputSchema.safeParse({ type: 'invalid_type', name: 'Test' }).success).toBe(false);
  });

  it('validates DogInputSchema accepts gender and expectedAdultWeightKg', () => {
    const validProfile = {
      id: 'pup-test-1',
      name: 'Balma',
      breed: 'English Cocker Spaniel',
      birthDate: '2026-03-27',
      weightKg: 7.8,
      dailyFoodGramGoal: 240,
      targetMealsPerDay: 3,
      gender: 'female' as const,
      expectedAdultWeightKg: 13.5,
    };

    const parsed = DogInputSchema.safeParse(validProfile);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gender).toBe('female');
      expect(parsed.data.expectedAdultWeightKg).toBe(13.5);
    }
  });

  it('validates DogInputSchema preserves backward compatibility when gender is omitted', () => {
    const legacyProfile = {
      id: 'pup-test-2',
      name: 'Cookie',
      breed: 'Labrador Retriever',
      birthDate: '2026-01-10',
      weightKg: 15,
      dailyFoodGramGoal: 300,
      targetMealsPerDay: 2,
    };

    const parsed = DogInputSchema.safeParse(legacyProfile);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gender).toBeUndefined();
      expect(parsed.data.expectedAdultWeightKg).toBeUndefined();
    }
  });

  it('rejects invalid gender in DogInputSchema', () => {
    const invalidProfile = {
      id: 'pup-test-3',
      name: 'Rover',
      breed: 'Boxer',
      birthDate: '2026-02-01',
      weightKg: 10,
      dailyFoodGramGoal: 250,
      targetMealsPerDay: 3,
      gender: 'invalid_gender',
    };

    const parsed = DogInputSchema.safeParse(invalidProfile);
    expect(parsed.success).toBe(false);
  });

  it('should validate DeleteSchema with valid id and reject empty id', () => {
    expect(DeleteSchema.safeParse({ id: 'act-123' }).success).toBe(true);
    expect(DeleteSchema.safeParse({ id: '' }).success).toBe(false);
    expect(DeleteSchema.safeParse({}).success).toBe(false);
  });

  it('should validate DashboardQuerySchema parsing and sanitization', () => {
    const parsed = DashboardQuerySchema.safeParse({
      puppyId: 'pup-balma',
      days: 30,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.puppyId).toBe('pup-balma');
      expect(parsed.data.days).toBe(30);
    }

    const defaultParsed = DashboardQuerySchema.safeParse({});
    expect(defaultParsed.success).toBe(true);
    if (defaultParsed.success) {
      expect(defaultParsed.data.days).toBe(14);
      expect(defaultParsed.data.puppyId).toBeUndefined();
    }

    // String days coercion and puppyId trimming
    const customResult = DashboardQuerySchema.safeParse({
      puppyId: '  pup-alpha  ',
      days: '30',
    });
    expect(customResult.success).toBe(true);
    if (customResult.success) {
      expect(customResult.data.puppyId).toBe('pup-alpha');
      expect(customResult.data.days).toBe(30);
    }

    // Empty or whitespace-only puppyId transforms to undefined
    const whitespaceResult = DashboardQuerySchema.safeParse({
      puppyId: '   ',
      days: '7',
    });
    expect(whitespaceResult.success).toBe(true);
    if (whitespaceResult.success) {
      expect(whitespaceResult.data.puppyId).toBeUndefined();
      expect(whitespaceResult.data.days).toBe(7);
    }

    // Invalid or out-of-range days (1..90) fall back safely to default 14
    for (const days of ['invalid_number', '365', '0']) {
      expect(DashboardQuerySchema.parse({ days }).days).toBe(14);
    }
  });

  it('should validate UserInputSchema', () => {
    const validUser = {
      email: 'matthieu@example.com',
      name: 'Matthieu',
      role: 'SuperAdmin',
      status: 'ACTIVE' as const,
    };
    expect(UserInputSchema.safeParse(validUser).success).toBe(true);

    const invalidEmail = {
      email: 'not-an-email',
    };
    expect(UserInputSchema.safeParse(invalidEmail).success).toBe(false);
  });

  describe('ActivityInputSchema hardening', () => {
    const base = { puppyId: 'pup-1', type: 'pee' as const, timestamp: '2026-08-17T12:00:00.000Z' };

    it('rejects a timestamp that does not parse as a date', () => {
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: 'not-a-date' }).success).toBe(false);
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: '' }).success).toBe(false);
      expect(ActivityInputSchema.safeParse(base).success).toBe(true);
    });

    it('coerces quantityGrams to a positive number and rejects empty, zero or negative values', () => {
      const food = { ...base, type: 'food' as const };
      expect(ActivityInputSchema.parse({ ...food, quantityGrams: '85' }).quantityGrams).toBe(85);
      // '' coerces to 0: a 0 g meal is an input mistake, so it is rejected rather than stored.
      for (const quantityGrams of ['', 0, -5, 'abc']) {
        expect(ActivityInputSchema.safeParse({ ...food, quantityGrams }).success).toBe(false);
      }
      expect(ActivityInputSchema.parse({ ...food, quantityGrams: null }).quantityGrams).toBeNull();
    });

    // 14: the form stops 5 min ahead by the phone's clock; the server only refuses what no clock skew explains
    it('rejects a timestamp more than 24 h in the future, on POST and PUT; a phone clock hours ahead still saves', () => {
      const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: inHours(23) }).success).toBe(true);
      expect(ActivityInputSchema.safeParse({ ...base, timestamp: inHours(25) }).success).toBe(false);
      expect(ActivityInputSchema.partial().safeParse({ id: 'act-1', timestamp: inHours(23) }).success).toBe(true);
      expect(ActivityInputSchema.partial().safeParse({ id: 'act-1', timestamp: inHours(25) }).success).toBe(false);
    });

    it('accepts a weight from 0.3 to 100 kg (number, numeric string or null), on POST and PUT', () => {
      const weight = { ...base, type: 'weight' as const };
      for (const weightKg of [0.3, 12.34, 100, '7.4', null]) {
        expect(ActivityInputSchema.safeParse({ ...weight, weightKg }).success, String(weightKg)).toBe(true);
      }
      expect(ActivityInputSchema.parse({ ...weight, weightKg: '7.4' }).weightKg).toBe(7.4);
      for (const weightKg of [0.2, 100.1, 0, -4, '', 'abc']) {
        expect(ActivityInputSchema.safeParse({ ...weight, weightKg }).success, String(weightKg)).toBe(false);
        expect(ActivityInputSchema.partial().safeParse({ id: 'act-1', weightKg }).success, String(weightKg)).toBe(false);
      }
    });

    it('only accepts known potty locations, or null', () => {
      expect(ActivityInputSchema.safeParse({ ...base, pottyLocation: 'indoor_pad' }).success).toBe(false);
      expect(ActivityInputSchema.safeParse({ ...base, pottyLocation: 'indoor_accident' }).success).toBe(true);
      expect(ActivityInputSchema.safeParse({ ...base, pottyLocation: null }).success).toBe(true);
    });
  });

  describe('ActivityInputSchema accepts what the client really sends', () => {
    // The wire payload: useActivities.addActivity adds the id, services/api.ts JSON-encodes it.
    const toWire = (activity: object) => JSON.parse(JSON.stringify({ ...activity, id: `act-${crypto.randomUUID()}` }));
    const actionTime = new Date('2026-10-13T08:15:00.000Z');

    it.each([
      ['pee', 'outside'],
      ['pee', 'indoor_accident'],
      ['poop', 'outside'],
    ] as const)('one-tap quick action: %s %s', (type, pottyLocation) => {
      const payload = buildQuickActionActivity({ puppyId: 'pup-1', type, pottyLocation, loggedBy: 'Daria', actionTime });
      const parsed = ActivityInputSchema.safeParse(toWire(payload));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    const form = {
      puppyId: 'pup-1',
      localTimestamp: '2026-10-13T10:15',
      loggedBy: 'Matthieu Jacquet',
      notes: '  ',
      pottyLocation: 'outside' as const,
      stoolConsistency: 'normal' as const,
      // The grams and weight boxes hold the raw text typed.
      quantityGrams: '80',
      weightKg: '7,4',
      medicationName: 'Credelio Plus',
    };

    it.each(['pee', 'poop', 'food', 'weight', 'medication'] as const)('QuickLogModal form, new log and edit: %s', (type) => {
      const payload = buildQuickLogActivity({ ...form, type });
      const created = ActivityInputSchema.safeParse(toWire(payload));
      expect(created.success, JSON.stringify(created.error?.issues)).toBe(true);
      // Edit: ActivityTimeline sends { id, ...activityData } through PUT.
      const edited = ActivityInputSchema.partial().safeParse({ id: 'act-1760000000000', ...JSON.parse(JSON.stringify(payload)) });
      expect(edited.success, JSON.stringify(edited.error?.issues)).toBe(true);
    });

    // A 0 g meal is rejected: the builder keeps the 0 (no silent meal without grams), the server refuses it,
    // and the form blocks it before it closes.
    it('a 0 g or emptied grams box never becomes a meal without grams', () => {
      const payload = buildQuickLogActivity({ ...form, type: 'food', quantityGrams: '0' });
      expect(payload.quantityGrams).toBe(0);
      expect(ActivityInputSchema.safeParse(toWire(payload)).success).toBe(false);
      for (const quantityGrams of ['0', '']) {
        expect(validateQuickLogForm({ ...form, type: 'food', quantityGrams })).toEqual({ field: 'quantityGrams', messageKey: 'gramsRequired' });
      }
    });

    // One row per distinct production shape (read-only SELECT, 2026-10-14), as GET /api/activities returns it.
    const productionRowShapes = [
      { type: 'food', pottyLocation: null, stoolConsistency: null, foodType: 'kibble', quantityGrams: 20, quantityCups: 0.18, weightKg: null },
      { type: 'food', pottyLocation: null, stoolConsistency: null, foodType: null, quantityGrams: 10, quantityCups: 0.09, weightKg: null },
      { type: 'pee', pottyLocation: 'indoor_accident', stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'pee', pottyLocation: 'outside', stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'poop', pottyLocation: 'outside', stoolConsistency: 'hard', foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'poop', pottyLocation: 'outside', stoolConsistency: 'normal', foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'poop', pottyLocation: 'outside', stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: null },
      { type: 'weight', pottyLocation: null, stoolConsistency: null, foodType: null, quantityGrams: null, quantityCups: null, weightKg: 4.075 },
    ];

    it.each(productionRowShapes)('a production row re-sent as-is on PUT: $type $pottyLocation $stoolConsistency $foodType', (row) => {
      const resent = {
        ...row,
        id: 'act-1754000000000',
        householdId: 'hh-1',
        puppyId: 'pup-1',
        timestamp: '2026-08-11T12:00:00.000Z',
        loggedBy: 'guest.member',
        durationMinutes: null,
        medicationName: null,
        notes: null,
      };
      const parsed = ActivityInputSchema.partial().safeParse(resent);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });
  });

  // Improvement backlog 18: one active account or a buggy client must not store megabytes, NaN or a server error.
  describe('size, number and date limits', () => {
    const activity = { puppyId: 'pup-1', type: 'food' as const };
    const dog = { name: 'Rex', breed: 'Beagle', birthDate: '2026-05-01' };
    const record = { puppyId: 'pup-1', type: 'vaccination', name: 'Rage', date: '2026-08-01' };
    const user = { email: 'someone@example.com' };
    const accepts = (schema: ZodType, input: object) => schema.safeParse(input).success;

    it('notes and other free text: at most 2000 characters', () => {
      const cases: Array<[ZodType, object, string]> = [
        [ActivityInputSchema, activity, 'notes'],
        [DogInputSchema, dog, 'notes'],
        [DogInputSchema, dog, 'careInstructions'],
        [HealthRecordInputSchema, record, 'notes'],
      ];
      for (const [schema, base, field] of cases) {
        expect(accepts(schema, { ...base, [field]: 'a'.repeat(2000) }), field).toBe(true);
        expect(accepts(schema, { ...base, [field]: 'a'.repeat(2001) }), field).toBe(false);
      }
    });

    it('names and other short texts: at most 80 characters', () => {
      const cases: Array<[ZodType, object, string]> = [
        [ActivityInputSchema, activity, 'foodType'],
        [ActivityInputSchema, activity, 'stoolConsistency'],
        [ActivityInputSchema, activity, 'medicationName'],
        [DogInputSchema, dog, 'name'],
        ...['type', 'name', 'batchNumber', 'vetClinic', 'productName'].map((field): [ZodType, object, string] => [HealthRecordInputSchema, record, field]),
        ...['name', 'role', 'color'].map((field): [ZodType, object, string] => [CaretakerInputSchema, { name: 'Daria' }, field]),
        [UserInputSchema, user, 'name'],
        [UserInputSchema, user, 'role'],
      ];
      for (const [schema, base, field] of cases) {
        expect(accepts(schema, { ...base, [field]: 'a'.repeat(80) }), field).toBe(true);
        expect(accepts(schema, { ...base, [field]: 'a'.repeat(81) }), field).toBe(false);
      }
    });

    it('a client-supplied id (it becomes a primary key): at most 64 characters, the app ids fit', () => {
      const cases: Array<[ZodType, object, string]> = [
        [ActivityInputSchema, { ...activity, id: `act-${crypto.randomUUID()}` }, 'id'],
        [DogInputSchema, { ...dog, id: `pup-${Date.now()}` }, 'id'],
        [HealthRecordInputSchema, { ...record, id: `hr-${Date.now()}` }, 'id'],
        [CaretakerInputSchema, { name: 'Daria', id: `c-${Date.now()}` }, 'id'],
        [UserInputSchema, { ...user, householdId: `house-${Date.now()}-${crypto.randomUUID().slice(0, 8)}` }, 'householdId'],
      ];
      for (const [schema, base, field] of cases) {
        expect(accepts(schema, base), field).toBe(true);
        expect(accepts(schema, { ...base, [field]: 'a'.repeat(64) }), field).toBe(true);
        expect(accepts(schema, { ...base, [field]: 'a'.repeat(65) }), field).toBe(false);
      }
    });

    it('an email: at most 254 characters, 64 before the @ (RFC 5321; an account or invite badge name can default to that part)', () => {
      const address = (localLength: number, length: number) => `${'a'.repeat(localLength)}@${'b'.repeat(length - localLength - 5)}.com`;
      const cases: Array<[ZodType, object]> = [
        [CaretakerInputSchema, { name: 'Daria' }],
        [UserInputSchema, {}],
      ];
      for (const [schema, base] of cases) {
        expect(accepts(schema, { ...base, email: address(64, 254) })).toBe(true);
        expect(accepts(schema, { ...base, email: address(64, 255) })).toBe(false);
        expect(accepts(schema, { ...base, email: address(65, 80) })).toBe(false);
      }
    });

    it('a dog picture is not an input: a stored dog re-sent on edit still saves and its picture is never rewritten', () => {
      for (const avatarUrl of ['/dog_photo.jpg', '', null, 'javascript:alert(1)']) {
        const parsed = DogInputSchema.partial().safeParse({ id: 'dog-1', ...dog, avatarUrl });
        expect(parsed.success, String(avatarUrl)).toBe(true);
        expect(parsed.data, String(avatarUrl)).not.toHaveProperty('avatarUrl');
      }
    });

    it('cups: a number of 0 or more (a numeric string is read), never text', () => {
      expect(ActivityInputSchema.parse({ ...activity, quantityCups: '0.18' }).quantityCups).toBe(0.18);
      // gramsToCups rounds a meal under 0.55 g to 0 cups, and the form accepts it
      for (const quantityCups of [0.09, 0, null]) expect(accepts(ActivityInputSchema, { ...activity, quantityCups }), String(quantityCups)).toBe(true);
      for (const quantityCups of ['abc', -0.5, '1e999']) expect(accepts(ActivityInputSchema, { ...activity, quantityCups }), String(quantityCups)).toBe(false);
    });

    it('walk duration: a whole number of minutes from 1 to 1440, or null', () => {
      const walk = { ...activity, type: 'walk' as const };
      expect(ActivityInputSchema.parse({ ...walk, durationMinutes: '45' }).durationMinutes).toBe(45);
      for (const durationMinutes of [1, 1440, null]) expect(accepts(ActivityInputSchema, { ...walk, durationMinutes }), String(durationMinutes)).toBe(true);
      for (const durationMinutes of [0, 1441, 12.5, '', 'abc']) expect(accepts(ActivityInputSchema, { ...walk, durationMinutes }), String(durationMinutes)).toBe(false);
    });

    it('a dog weight and a health record weight are numbers (a numeric string is read), never text', () => {
      expect(DogInputSchema.parse({ ...dog, weightKg: '7.8' }).weightKg).toBe(7.8);
      for (const weightKg of ['abc', 0, -3, null]) expect(accepts(DogInputSchema, { ...dog, weightKg }), String(weightKg)).toBe(false);
      expect(HealthRecordInputSchema.parse({ ...record, weightAtTime: '7.8' }).weightAtTime).toBe(7.8);
      expect(HealthRecordInputSchema.parse({ ...record, weightAtTime: null }).weightAtTime).toBeNull();
      expect(accepts(HealthRecordInputSchema, { ...record, weightAtTime: 'abc' })).toBe(false);
    });

    it('a health record date and next date are real calendar days (YYYY-MM-DD)', () => {
      for (const date of ['2026-02-30', '2026-13-01', 'yesterday', '2026-08-01T00:00:00.000Z']) {
        expect(accepts(HealthRecordInputSchema, { ...record, date }), date).toBe(false);
        expect(accepts(HealthRecordInputSchema, { ...record, boosterDate: date }), date).toBe(false);
        expect(accepts(HealthRecordInputSchema.partial(), { id: 'hr-1', boosterDate: date }), date).toBe(false);
      }
      expect(accepts(HealthRecordInputSchema, { ...record, boosterDate: '2027-08-01' })).toBe(true);
      expect(accepts(HealthRecordInputSchema, { ...record, boosterDate: null })).toBe(true);
    });

    it("the app's own dog, health record, badge and invite payloads still pass", () => {
      const storedDog = {
        id: 'dog-1', householdId: 'hh-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-05-01', weightKg: 4.5,
        dailyFoodGramGoal: 200, targetMealsPerDay: 3, avatarUrl: '/dog_photo.jpg', notes: '', gender: null,
        expectedAdultWeightKg: null, createdAt: '2026-05-02T08:00:00.000Z', updatedAt: '2026-05-02T08:00:00.000Z',
      };
      // PuppiesView: an edit sends the stored dog with the form's fields, a new dog its own id
      const editForm = { ...dogFormFromProfile(storedDog), notes: 'Loves carrots' };
      expect(accepts(DogInputSchema.partial(), { ...storedDog, ...buildDogPayload(editForm, storedDog) })).toBe(true);
      const newDogForm = { ...NEW_DOG_FORM, name: 'Max', breed: 'Beagle', birthDate: '2026-05-01', dailyFoodGramGoal: '200', targetMealsPerDay: '3' };
      expect(accepts(DogInputSchema, { id: `pup-${Date.now()}`, ...buildDogPayload(newDogForm) })).toBe(true);

      // VaccineSection and DewormingSection, with every protocol name
      const { vaccines, antiparasitics } = getHealthProtocols();
      for (const { name } of vaccines) {
        expect(accepts(HealthRecordInputSchema, { puppyId: 'pup-1', type: 'vaccination', name, date: '2026-08-01', boosterDate: '2027-08-01', vetClinic: 'Clinique du Parc', batchNumber: 'A123-45' }), name).toBe(true);
        expect(accepts(HealthRecordInputSchema.partial(), { id: 'hr-1', puppyId: 'pup-1', type: 'vaccination', name, date: '2026-08-01', boosterDate: null, vetClinic: null, batchNumber: null }), name).toBe(true);
      }
      for (const { name } of antiparasitics) {
        expect(accepts(HealthRecordInputSchema, { puppyId: 'pup-1', type: 'deworming', name, productName: name, date: '2026-08-01', boosterDate: '2026-09-01' }), name).toBe(true);
      }

      // HouseholdView's new badge, an invite badge (the longest email local part is 64 characters)
      expect(accepts(CaretakerInputSchema, { id: `c-${Date.now()}`, name: 'Daria', role: 'Member', color: 'bg-amber-500' })).toBe(true);
      const inviteBadge = buildInviteBadge(`${'a'.repeat(64)}@example.com`, [{ name: 'A', color: '#EC4899' }])!;
      expect(accepts(CaretakerInputSchema, inviteBadge)).toBe(true);
    });
  });
});
