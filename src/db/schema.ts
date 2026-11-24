import { pgTable, text, timestamp, date, doublePrecision, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';

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
  // Legacy: no screen or estimate uses it (a dog's weight is its weight events); null for a new dog (migrations/0002)
  weightKg: doublePrecision('weight_kg'),
  dailyFoodGramGoal: integer('daily_food_gram_goal').notNull().default(200),
  targetMealsPerDay: integer('target_meals_per_day').notNull().default(3),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  gender: text('gender'),
  expectedAdultWeightKg: doublePrecision('expected_adult_weight_kg'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  // Set when the owner or the household's Admin deletes the dog: every read skips it, its logs and records stay, and they can restore it
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
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
  index('idx_health_records_household_date').on(table.householdId, table.date.desc()),
  index('idx_health_records_tenant_pup_date').on(table.householdId, table.puppyId, table.date.desc()),
]);

// An invite into a household, waiting for the invitee's yes (api/invites.ts): it never creates or moves an account by itself
export const invitesTable = pgTable('invites', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  householdId: text('household_id').notNull(),
  role: text('role').notNull().default('Member'),
  invitedBy: text('invited_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_invites_email_household').on(table.email, table.householdId),
]);

// Requests sent from the privacy policy's form (/privacy); the owner answers them by email and marks them handled
export const privacyRequestsTable = pgTable('privacy_requests', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  kind: text('kind').notNull(),
  message: text('message'),
  lang: text('lang').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  handledAt: timestamp('handled_at', { withTimezone: true, mode: 'date' }),
});
