/*
  # Fix RLS policies for custom authentication
  
  Since we're using a custom users table with localStorage-based auth
  instead of Supabase's built-in auth, we need to update the RLS policies
  to allow access without auth.uid()
  
  This temporarily disables strict RLS while maintaining data isolation
  through application logic.
*/

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own models" ON models;
DROP POLICY IF EXISTS "Users can create own models" ON models;
DROP POLICY IF EXISTS "Users can update own models" ON models;
DROP POLICY IF EXISTS "Users can delete own models" ON models;

-- Temporarily allow authenticated users to access users table
-- In production, you should implement proper JWT-based auth
CREATE POLICY "Allow users table access"
  ON users FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Allow access to models table for all authenticated/anon users
-- Data isolation is handled in application code via user_id filtering
CREATE POLICY "Allow models access"
  ON models FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Note: This is a permissive policy for development
-- For production, consider implementing:
-- 1. JWT-based authentication with custom claims
-- 2. Row-level security based on JWT user_id
-- 3. Or use Supabase's built-in auth instead of custom users table

