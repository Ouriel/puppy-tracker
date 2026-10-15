import { z } from 'zod';

const PottyLocationSchema = z.enum(['outside', 'indoor_accident']);

// Size limits: one account or a buggy client must not fill the shared database
const idText = z.string().max(64); // a client-supplied id becomes a primary key
const shortText = z.string().max(80); // names, roles, types, product and clinic names
const longText = z.string().max(2000); // notes
// RFC 5321: 254 characters, 64 before the @ (an account or invite badge name can default to that part)
const emailText = (message: string) =>
  z.string().max(254).email(message).refine((email) => email.split('@')[0].length <= 64, message);

export const DashboardQuerySchema = z.object({
  puppyId: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  days: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? 14 : Number(val)),
    z.number().int().min(1).max(90).catch(14)
  ),
});

// ── API Input Mutation Schemas ──

export const ActivityInputSchema = z.object({
  id: idText.optional(),
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
  stoolConsistency: shortText.nullable().optional(),
  foodType: shortText.nullable().optional(),
  // '' and other blanks coerce to 0, which positive() rejects: a 0 g meal is an input mistake.
  quantityGrams: z.coerce.number().positive().nullable().optional(),
  // 0 is kept: gramsToCups rounds a meal under 0.55 g to 0 cups, and the form accepts it
  quantityCups: z.coerce.number().nonnegative().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).nullable().optional(),
  weightKg: z.coerce.number().min(0.3).max(100).nullable().optional(),
  medicationName: shortText.nullable().optional(),
  notes: longText.nullable().optional(),
});

export const DogInputSchema = z.object({
  id: idText.optional(),
  name: shortText.min(1, 'Name is required'),
  // Required on POST (PUT uses .partial()): a DOG_BREEDS entry, or the name typed under 'Other'
  breed: z.string().trim().min(1, 'Breed is required').max(80),
  // Required on POST (PUT uses .partial()). A real day, at most one day ahead of UTC: it is already tomorrow east of it.
  birthDate: z.iso.date().refine((value) => Date.parse(value) <= Date.now() + 24 * 60 * 60 * 1000, 'birthDate is in the future'),
  // No weightKg: a dog's weight is its weight events, no screen sets one. Zod drops it, so an edit sending the stored
  // dog back (weightKg: null for a new dog) or an older app sending one is saved, and the stored value never changes.
  // 0: no gram goal, the dog's meals are only counted
  dailyFoodGramGoal: z
    .number()
    .int()
    .refine((goal) => goal === 0 || (goal >= 10 && goal <= 2000), 'dailyFoodGramGoal is 0 (no gram goal) or 10 to 2000 g')
    .optional(),
  targetMealsPerDay: z.number().int().min(1).max(6).optional(),
  careInstructions: longText.nullable().optional(),
  // No avatarUrl: no form sets it, and a stored picture is a path, not a URL. An edit re-sending it never rewrites it.
  notes: longText.nullable().optional(),
  // null clears a stored value: the API returns null for a dog without one
  gender: z.enum(['female', 'male']).nullable().optional(),
  expectedAdultWeightKg: z.number().positive().max(120).nullable().optional(),
});

export const HealthRecordInputSchema = z.object({
  id: idText.optional(),
  puppyId: z.string().min(1, 'puppyId is required'),
  type: shortText.min(1, 'type is required'),
  name: shortText.min(1, 'Name is required'),
  // Real calendar days: a day like 2026-02-30 would otherwise reach Postgres and fail as a server error
  date: z.iso.date(),
  boosterDate: z.iso.date().nullable().optional(),
  batchNumber: shortText.nullable().optional(),
  vetClinic: shortText.nullable().optional(),
  productName: shortText.nullable().optional(),
  // No weightAtTime: a weigh-in is a weight event. Zod drops it, so an older app still sending one saves the record.
  notes: longText.nullable().optional(),
});

export const CaretakerInputSchema = z.object({
  id: idText.optional(),
  name: shortText.min(1, 'Name is required'),
  role: shortText.min(1, 'Role must not be empty').optional(),
  color: shortText.optional(),
  email: emailText('Invalid email format').nullable().optional().or(z.literal('')),
});

export const UserInputSchema = z.object({
  email: emailText('Valid email is required'),
  name: shortText.optional(),
  role: shortText.optional(),
  status: z.enum(['ACTIVE', 'PENDING_APPROVAL']).optional(),
  householdId: idText.optional(),
  // POST only: the inviter confirmed moving an account that lives in another household
  confirmMove: z.boolean().optional(),
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


