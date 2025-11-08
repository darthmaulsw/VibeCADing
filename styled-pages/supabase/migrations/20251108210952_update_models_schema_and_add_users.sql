/*
  # Update models schema and add users table

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - Unique user identifier
      - `username` (text, unique) - User's username
      - `password` (text) - Hashed password
      - `created_at` (timestamptz) - Account creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Changes to existing tables
    - `models` table updates:
      - Make user_id NOT NULL
      - Add foreign key constraint to users
      - Drop old columns (description, stl_data, thumbnail_url, metadata)
      - Add new columns (scad_code, glb_file_url, stl_file_url)

  3. Security
    - Enable RLS on users table
    - Add RLS policies for users
    - Update RLS policies for models to use auth.uid()

  4. Indexes
    - Index on users.username for login lookups
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Update models table - add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'scad_code'
  ) THEN
    ALTER TABLE models ADD COLUMN scad_code text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'glb_file_url'
  ) THEN
    ALTER TABLE models ADD COLUMN glb_file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'stl_file_url'
  ) THEN
    ALTER TABLE models ADD COLUMN stl_file_url text;
  END IF;
END $$;

-- Make user_id NOT NULL if it isn't already
DO $$
BEGIN
  ALTER TABLE models ALTER COLUMN user_id SET NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'models_user_id_fkey'
  ) THEN
    ALTER TABLE models ADD CONSTRAINT models_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index on user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_models_user_id ON models(user_id);

-- Update RLS policies for models
DROP POLICY IF EXISTS "Users can view own models" ON models;
DROP POLICY IF EXISTS "Users can create own models" ON models;
DROP POLICY IF EXISTS "Users can update own models" ON models;
DROP POLICY IF EXISTS "Users can delete own models" ON models;

CREATE POLICY "Users can view own models"
  ON models FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own models"
  ON models FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own models"
  ON models FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own models"
  ON models FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
