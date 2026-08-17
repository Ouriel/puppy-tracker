import { z } from 'zod';
import type { Activity, Caretaker, PuppyProfile, UserAccount, HealthRecord } from '../types';

export const ActivityTypeSchema = z.enum([
  'pee',
  'poop',
  'food',
  'weight',
  'medication',
]);

export const PottyLocationSchema = z.enum(['outside', 'indoor_accident']);

export const StoolConsistencySchema = z.enum(['hard', 'normal', 'diarrhea', 'soft', 'runny']);

export const FoodTypeSchema = z.enum(['kibble', 'wet', 'raw', 'treats', 'topper']);

export const FamilyRoleSchema = z.enum([
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
  notes: z.string().optional(),
});

export const PuppyProfileSchema: z.ZodType<PuppyProfile> = z.object({
  id: z.string(),
  householdId: z.string().optional(),
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

// ── API Input Mutation Schemas ──

export const ActivityInputSchema = z.object({
  id: z.string().optional(),
  puppyId: z.string().min(1, 'puppyId is required'),
  type: z.enum(['pee', 'poop', 'food', 'walk', 'weight', 'medication']),
  timestamp: z.string().optional(),
  loggedBy: z.string().optional(),
  pottyLocation: z.string().nullable().optional(),
  stoolConsistency: z.string().nullable().optional(),
  foodType: z.string().nullable().optional(),
  quantityGrams: z.number().or(z.string()).nullable().optional(),
  quantityCups: z.number().or(z.string()).nullable().optional(),
  durationMinutes: z.number().or(z.string()).nullable().optional(),
  weightKg: z.number().or(z.string()).nullable().optional(),
  medicationName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const DogInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  breed: z.string().optional(),
  birthDate: z.string().nullable().optional(),
  weightKg: z.number().or(z.string()).nullable().optional(),
  dailyFoodGramGoal: z.number().or(z.string()).nullable().optional(),
  targetMealsPerDay: z.number().or(z.string()).nullable().optional(),
  careInstructions: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const HealthRecordInputSchema = z.object({
  id: z.string().optional(),
  puppyId: z.string().min(1, 'puppyId is required'),
  type: z.enum(['vaccination', 'deworming']),
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
  color: z.string().optional(),
  role: z.string().optional(),
  email: z.string().email().optional(),
});

