import { z } from 'zod';
import type { Activity, Caretaker, PuppyProfile, UserAccount, HealthRecord, DashboardPayload } from '../types/index.js';

const ActivityTypeSchema = z.enum([
  'pee',
  'poop',
  'food',
  'weight',
  'medication',
]);

const PottyLocationSchema = z.enum(['outside', 'indoor_accident']);

const StoolConsistencySchema = z.enum(['hard', 'normal', 'diarrhea', 'soft', 'runny']);

const FoodTypeSchema = z.enum(['kibble', 'wet', 'raw', 'treats', 'topper']);

const FamilyRoleSchema = z.enum([
  'Husband',
  'Wife',
  'Partner',
  'Child',
  'Dog Walker',
  'Sitter',
  'Relative',
  'Member',
]);

export const ActivitySchema: z.ZodType<Activity> = z.object({
  id: z.string(),
  householdId: z.string().optional(),
  puppyId: z.string(),
  type: ActivityTypeSchema,
  timestamp: z.string(),
  loggedBy: z.string(),
  pottyLocation: PottyLocationSchema.optional(),
  stoolConsistency: StoolConsistencySchema.optional(),
  foodType: FoodTypeSchema.optional(),
  quantityGrams: z.number().optional(),
  quantityCups: z.number().optional(),
  durationMinutes: z.number().optional(),
  weightKg: z.number().optional(),
  medicationName: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export const PuppyProfileSchema: z.ZodType<PuppyProfile> = z.object({
  id: z.string(),
  householdId: z.string().optional(),
  name: z.string().min(1),
  breed: z.string(),
  birthDate: z.string(),
  weightKg: z.number().optional(),
  dailyFoodGramGoal: z.number(),
  targetMealsPerDay: z.number(),
  avatarUrl: z.string().optional(),
  notes: z.string().optional(),
  gender: z.enum(['male', 'female']).nullable().optional(),
  expectedAdultWeightKg: z.number().positive().nullable().optional(),
});

export const CaretakerSchema: z.ZodType<Caretaker> = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: FamilyRoleSchema,
  color: z.string(),
  email: z.string().optional(),
});

export const UserAccountSchema: z.ZodType<UserAccount> = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: FamilyRoleSchema,
  avatarColor: z.string(),
  familyPackId: z.string(),
});

export const HealthRecordSchema: z.ZodType<HealthRecord> = z.object({
  id: z.string(),
  householdId: z.string(),
  puppyId: z.string(),
  type: z.enum(['vaccination', 'deworming']),
  name: z.string().min(1),
  date: z.string(),
  boosterDate: z.string().optional(),
  batchNumber: z.string().optional(),
  vetClinic: z.string().optional(),
  productName: z.string().optional(),
  weightAtTime: z.number().optional(),
  notes: z.string().optional(),
});

export const DashboardPayloadSchema: z.ZodType<DashboardPayload> = z.object({
  puppies: z.array(PuppyProfileSchema),
  caretakers: z.array(CaretakerSchema),
  activities: z.array(ActivitySchema),
  healthRecords: z.array(HealthRecordSchema).optional(),
});

export const DashboardQuerySchema = z.object({
  puppyId: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  days: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? 14 : Number(val)),
    z.number().int().min(1).max(90).catch(14)
  ),
});

// ── API Input Mutation Schemas ──

export const ActivityInputSchema = z.object({
  id: z.string().optional(),
  puppyId: z.string().min(1, 'puppyId is required'),
  type: z.enum(['pee', 'poop', 'food', 'walk', 'weight', 'medication']),
  timestamp: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'timestamp must be a valid date')
    // The form stops 5 min ahead by the phone's clock; a phone whose clock is hours off must still save
    .refine((value) => Date.parse(value) <= Date.now() + 24 * 60 * 60 * 1000, 'timestamp is more than 24 h in the future')
    .optional(),
  loggedBy: z.string().optional(),
  pottyLocation: PottyLocationSchema.nullable().optional(),
  stoolConsistency: z.string().nullable().optional(),
  foodType: z.string().nullable().optional(),
  // '' and other blanks coerce to 0, which positive() rejects: a 0 g meal is an input mistake.
  quantityGrams: z.coerce.number().positive().nullable().optional(),
  quantityCups: z.number().or(z.string()).nullable().optional(),
  durationMinutes: z.number().or(z.string()).nullable().optional(),
  weightKg: z.coerce.number().min(0.3).max(100).nullable().optional(),
  medicationName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const DogInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  // Required on POST (PUT uses .partial()): a DOG_BREEDS entry, or the name typed under 'Other'
  breed: z.string().trim().min(1, 'Breed is required').max(80),
  // Required on POST (PUT uses .partial()). A real day, at most one day ahead of UTC: it is already tomorrow east of it.
  birthDate: z.iso.date().refine((value) => Date.parse(value) <= Date.now() + 24 * 60 * 60 * 1000, 'birthDate is in the future'),
  weightKg: z.number().or(z.string()).optional(),
  // 0: no gram goal, the dog's meals are only counted
  dailyFoodGramGoal: z
    .number()
    .int()
    .refine((goal) => goal === 0 || (goal >= 10 && goal <= 2000), 'dailyFoodGramGoal is 0 (no gram goal) or 10 to 2000 g')
    .optional(),
  targetMealsPerDay: z.number().int().min(1).max(6).optional(),
  careInstructions: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // null clears a stored value: the API returns null for a dog without one
  gender: z.enum(['female', 'male']).nullable().optional(),
  expectedAdultWeightKg: z.number().positive().max(120).nullable().optional(),
});

export const HealthRecordInputSchema = z.object({
  id: z.string().optional(),
  puppyId: z.string().min(1, 'puppyId is required'),
  type: z.string().min(1, 'type is required'),
  name: z.string().min(1, 'Name is required'),
  date: z.string().min(1, 'Date is required'),
  boosterDate: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  vetClinic: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  weightAtTime: z.number().or(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const CaretakerInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role must not be empty').optional(),
  color: z.string().optional(),
  email: z.string().email('Invalid email format').nullable().optional().or(z.literal('')),
});

export const UserInputSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(['ACTIVE', 'PENDING_APPROVAL']).optional(),
  householdId: z.string().optional(),
});

export const DeleteSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

// DELETE handlers accept the id from the query string first, then from the body
// (@vercel/node parses an empty JSON body as {}). Takes the request so the lazy
// req.body getter (throws on malformed JSON) is only read when the query has no id.
export function parseDeleteId(request: { query: Record<string, unknown>; body?: unknown }) {
  const rawId =
    (typeof request.query.id === 'string' && request.query.id) ||
    (request.body && typeof request.body === 'object' && (request.body as { id?: unknown }).id);
  return DeleteSchema.safeParse({ id: rawId });
}


