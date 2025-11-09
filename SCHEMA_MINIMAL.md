# VibeCADing Schema (Minimal)

## Tables

### `users`
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL
);
```

### `models`
```sql
CREATE TABLE models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  glb_file_url text
);
```

## That's it!

- User captures photos → Hunyuan generates 3D model → Save URL to database
- Each user can have many models
- Models store the CDN URL, not the actual file
- Super fast saves (~0.1s instead of 30s)

## Setup (Run in Supabase SQL Editor)

```sql
-- Tables
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL
);

CREATE TABLE models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  glb_file_url text
);

-- Indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_models_user_id ON models(user_id);

-- Security (permissive for development)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users table access"
  ON users FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow models access"
  ON models FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);
```

Done! 🎉

