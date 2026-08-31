import { pgTable, text, timestamp, date, doublePrecision, integer, index } from 'drizzle-orm/pg-core';

export const householdsTable = pgTable('households', {
  id: text('id').primaryKey(),
  familyPackId: text('family_pack_id').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const puppiesTable = pgTable('puppies', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  name: text('name').notNull(),
  breed: text('breed').notNull(),
  birthDate: date('birth_date', { mode: 'string' }).notNull(),
  weightKg: doublePrecision('weight_kg').notNull(),
  dailyFoodGramGoal: integer('daily_food_gram_goal').notNull().default(200),
  targetMealsPerDay: integer('target_meals_per_day').notNull().default(3),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  gender: text('gender'),
  expectedAdultWeightKg: doublePrecision('expected_adult_weight_kg'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
  index('idx_puppies_household').on(table.householdId),
]);

export const activitiesTable = pgTable('activities', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  puppyId: text('puppy_id').notNull(),
  type: text('type').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull(),
  loggedBy: text('logged_by').notNull(),
  pottyLocation: text('potty_location'),
  stoolConsistency: text('stool_consistency'),
  foodType: text('food_type'),
  quantityGrams: doublePrecision('quantity_grams'),
  quantityCups: doublePrecision('quantity_cups'),
  durationMinutes: integer('duration_minutes'),
  weightKg: doublePrecision('weight_kg'),
  medicationName: text('medication_name'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
  index('idx_activities_tenant_pup_time').on(table.householdId, table.puppyId, table.timestamp.desc()),
]);

export const caretakersTable = pgTable('caretakers', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  color: text('color').notNull(),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
  index('idx_caretakers_household').on(table.householdId),
]);

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
  index('idx_users_household').on(table.householdId),
]);

export const healthRecordsTable = pgTable('health_records', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  puppyId: text('puppy_id').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  boosterDate: date('booster_date', { mode: 'string' }),
  batchNumber: text('batch_number'),
  vetClinic: text('vet_clinic'),
  productName: text('product_name'),
  weightAtTime: doublePrecision('weight_at_time'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
  index('idx_health_records_tenant_pup_date').on(table.householdId, table.puppyId, table.date.desc()),
]);
