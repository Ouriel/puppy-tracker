-- PostgreSQL Schema for PupPace SaaS Platform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'PENDING_APPROVAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE household_role AS ENUM ('Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Co-Admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM ('pee', 'poop', 'food', 'water', 'nap', 'walk', 'weight', 'medication');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE potty_location AS ENUM ('outside', 'indoor_pad', 'indoor_accident');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE stool_consistency AS ENUM ('hard', 'normal', 'soft', 'runny');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE food_type AS ENUM ('kibble', 'wet', 'raw', 'treats', 'topper');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE vaccine_type AS ENUM ('Rage', 'DHPP', 'Leptospirose', 'Toux_de_Chenil');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    status user_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Households Table
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Household Members Junction Table
CREATE TABLE IF NOT EXISTS household_members (
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role household_role NOT NULL DEFAULT 'Co-Admin',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (household_id, user_id)
);

-- 4. Dogs Table
CREATE TABLE IF NOT EXISTS dogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    breed VARCHAR(100) NOT NULL DEFAULT 'Cocker Spaniel',
    birth_date DATE NOT NULL,
    weight_kg NUMERIC(4, 2) NOT NULL DEFAULT 5.0,
    daily_food_gram_goal NUMERIC(5, 1) NOT NULL DEFAULT 180.0,
    target_meals_per_day INT NOT NULL DEFAULT 3,
    avatar_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Activities Table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type activity_type NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    potty_location potty_location,
    stool_consistency stool_consistency,
    food_type food_type,
    quantity_grams NUMERIC(5, 1),
    water_amount_ml NUMERIC(5, 1),
    duration_minutes INT,
    weight_kg NUMERIC(4, 2),
    medication_name VARCHAR(255),
    notes TEXT
);

-- 6. Vaccinations Table (French Veterinary Protocol)
CREATE TABLE IF NOT EXISTS vaccinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
    vaccine_type vaccine_type NOT NULL,
    administered_date DATE NOT NULL,
    next_due_date DATE NOT NULL,
    vet_clinic_name VARCHAR(255),
    batch_number VARCHAR(100),
    notes TEXT
);

-- 7. Deworming Table (Vermifuge Protocol)
CREATE TABLE IF NOT EXISTS deworming (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL DEFAULT 'Milbemax',
    administered_date DATE NOT NULL,
    next_due_date DATE NOT NULL,
    weight_at_time_kg NUMERIC(4, 2),
    notes TEXT
);

-- Seed Super Admin Account (matthieu.jacquet@gmail.com)
INSERT INTO users (email, password_hash, full_name, status, is_super_admin)
VALUES (
    'matthieu.jacquet@gmail.com',
    '$2b$10$Ep31F6oH9S7oB/uD4L44/.R1zGZf8yF/E3eN3dZ2d1uYgY8o9x0vG',
    'Matthieu Jacquet',
    'ACTIVE',
    TRUE
) ON CONFLICT (email) DO UPDATE SET is_super_admin = TRUE, status = 'ACTIVE';
