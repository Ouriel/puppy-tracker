import { z } from 'zod';
import type { Activity, Caretaker, PuppyProfile, UserAccount } from '../types';

export const ActivityTypeSchema = z.enum([
  'pee',
  'poop',
  'food',
  'walk',
  'weight',
  'medication',
]);

export const PottyLocationSchema = z.enum(['outside', 'indoor_pad', 'indoor_accident']);

export const StoolConsistencySchema = z.enum(['hard', 'normal', 'soft', 'runny']);

export const FoodTypeSchema = z.enum(['kibble', 'wet', 'raw', 'treats', 'topper']);

export const FamilyRoleSchema = z.enum([
  'Husband',
  'Wife',
  'Partner',
  'Child',
  'Dog Walker',
  'Sitter',
  'Relative',
]);

export const ActivitySchema: z.ZodType<Activity> = z.object({
  id: z.string(),
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
  medicationName: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
});

export const PuppyProfileSchema: z.ZodType<PuppyProfile> = z.object({
  id: z.string(),
  name: z.string().min(1),
  breed: z.string(),
  birthDate: z.string(),
  weightKg: z.number(),
  dailyFoodGramGoal: z.number(),
  targetMealsPerDay: z.number(),
  avatarUrl: z.string().optional(),
  notes: z.string().optional(),
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
