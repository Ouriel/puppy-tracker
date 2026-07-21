-- PostgreSQL / Supabase Schema Definition for PupPace

-- 1. Family Packs / Accounts
CREATE TABLE family_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_code VARCHAR(32) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Accounts
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_pack_id UUID REFERENCES family_packs(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter')),
    avatar_color VARCHAR(20) DEFAULT '#6366F1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Puppies Profile Table
CREATE TABLE puppies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_pack_id UUID REFERENCES family_packs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    breed VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    weight_kg NUMERIC(5,2) NOT NULL,
    avatar_url TEXT,
    target_meals_per_day INT DEFAULT 3,
    daily_food_gram_goal INT DEFAULT 200,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Activity Logs Table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE,
    logged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    logged_by_name VARCHAR(100) NOT NULL,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('pee', 'poop', 'food', 'water', 'nap', 'walk', 'weight', 'medication')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    potty_location VARCHAR(50) CHECK (potty_location IN ('outside', 'indoor_pad', 'indoor_accident')),
    stool_consistency VARCHAR(50) CHECK (stool_consistency IN ('hard', 'normal', 'soft', 'runny')),
    food_type VARCHAR(50),
    quantity_grams INT,
    quantity_cups NUMERIC(4,2),
    water_amount_ml INT,
    duration_minutes INT,
    weight_kg NUMERIC(5,2),
    medication_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_activity_puppy_type ON activity_logs (puppy_id, activity_type, timestamp DESC);
CREATE INDEX idx_puppies_family ON puppies (family_pack_id);
