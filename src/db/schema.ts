import { pgTable, text, timestamp, doublePrecision, integer } from 'drizzle-orm/pg-core';

export const puppiesTable = pgTable('puppies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  breed: text('breed').notNull(),
  birthDate: text('birth_date').notNull(),
  weightKg: doublePrecision('weight_kg').notNull(),
  dailyFoodGramGoal: integer('daily_food_gram_goal').notNull().default(200),
  targetMealsPerDay: integer('target_meals_per_day').notNull().default(3),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const activitiesTable = pgTable('activities', {
  id: text('id').primaryKey(),
  puppyId: text('puppy_id').notNull(),
  type: text('type').notNull(),
  timestamp: text('timestamp').notNull(),
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
  createdAt: timestamp('created_at').defaultNow(),
});

export const caretakersTable = pgTable('caretakers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  color: text('color').notNull(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
});
