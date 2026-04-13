-- ============================================================
-- Terrapin Fuel — PostgreSQL Schema (run this in Neon console)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  avatar_color  TEXT        NOT NULL DEFAULT '#CC0033',
  height_ft     INT,
  height_in     INT         DEFAULT 0,
  weight_lbs    INT,
  age           INT,
  sex           TEXT        CHECK (sex IN ('male', 'female')),
  goal          TEXT        CHECK (goal IN ('bulk', 'maintain', 'cut')),
  activity      TEXT        CHECK (activity IN ('sedentary', 'light', 'moderate', 'active')),
  dietary_prefs TEXT[]      NOT NULL DEFAULT '{}',
  other_prefs   TEXT        DEFAULT '',
  supplements   JSONB       NOT NULL DEFAULT '[]',
  -- Macro targets (food-only, after supplement subtraction)
  target_calories INT,
  target_protein  INT,
  target_carbs    INT,      -- optional, can be NULL
  target_fat      INT,      -- optional, can be NULL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Cached Menus ─────────────────────────────────────────────────────────────
-- Scraped each morning at 4am (or manually via beta button).
-- menu_data is a JSON array of MenuItem objects grouped by meal.
CREATE TABLE IF NOT EXISTS cached_menus (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_num INT         NOT NULL,
  dining_hall  TEXT        NOT NULL,
  date         DATE        NOT NULL,
  menu_data    JSONB       NOT NULL,   -- { breakfast: MenuItem[], lunch: MenuItem[], dinner: MenuItem[] }
  scraped_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_num, date)
);

-- ─── Meal Plans ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plans (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  location_num INT         NOT NULL,
  dining_hall  TEXT        NOT NULL,
  plan_data    JSONB       NOT NULL,   -- AI-generated plan with meals + totals
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  food_name    TEXT        NOT NULL,
  rating       INT         NOT NULL CHECK (rating BETWEEN 1 AND 10),
  notes        TEXT        DEFAULT '',
  date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, food_name, date)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_profile    ON reviews (profile_id);
CREATE INDEX IF NOT EXISTS idx_reviews_food       ON reviews (profile_id, food_name);
CREATE INDEX IF NOT EXISTS idx_meal_plans_profile ON meal_plans (profile_id, date);
CREATE INDEX IF NOT EXISTS idx_cached_menus_loc   ON cached_menus (location_num, date);
