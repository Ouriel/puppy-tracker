-- 0000_baseline: the database schema as of 2026-10-15 (src/db/schema.ts on that day).
-- Already applied: documents the schema as of 2026-10-15; never run on an existing database.
-- Use it only to build an empty database; every later change is a numbered file after this one.
-- Checked against production on 2026-10-15 with read-only queries on information_schema.columns,
-- pg_indexes and pg_constraint: same 6 tables, same columns in the same order (types, NOT NULL,
-- defaults), same 14 indexes (6 primary keys, 2 unique, 6 below). No foreign keys.
-- Not covered: the neon_auth schema, which Neon Auth manages (the app does not use it).
-- Rollback: none (it creates the schema; drop the tables of a scratch database by hand).
-- Applied to preview: already there (the preview branch is a copy of production)
-- Applied to production: already there (built before this file)

CREATE TABLE IF NOT EXISTS households (
  id text PRIMARY KEY,
  family_pack_id text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT households_family_pack_id_unique UNIQUE (family_pack_id)
);

CREATE TABLE IF NOT EXISTS puppies (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  name text NOT NULL,
  breed text NOT NULL,
  birth_date date NOT NULL,
  weight_kg double precision NOT NULL,
  daily_food_gram_goal integer NOT NULL DEFAULT 200,
  target_meals_per_day integer NOT NULL DEFAULT 3,
  avatar_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  gender text,
  expected_adult_weight_kg double precision
);

CREATE TABLE IF NOT EXISTS activities (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  puppy_id text NOT NULL,
  type text NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  logged_by text NOT NULL,
  potty_location text,
  stool_consistency text,
  food_type text,
  quantity_grams double precision,
  quantity_cups double precision,
  duration_minutes integer,
  weight_kg double precision,
  medication_name text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caretakers (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  color text NOT NULL,
  email text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS health_records (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  puppy_id text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  date date NOT NULL,
  booster_date date,
  batch_number text,
  vet_clinic text,
  product_name text,
  weight_at_time double precision,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_puppies_household ON puppies (household_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_pup_time ON activities (household_id, puppy_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_caretakers_household ON caretakers (household_id);
CREATE INDEX IF NOT EXISTS idx_users_household ON users (household_id);
CREATE INDEX IF NOT EXISTS idx_health_records_household_date ON health_records (household_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_health_records_tenant_pup_date ON health_records (household_id, puppy_id, date DESC);
