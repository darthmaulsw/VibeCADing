# Apply Database Migrations

You need to apply two migrations to fix model saving:

## Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of each migration file (in order):
   - First: `supabase/migrations/20251108211000_fix_rls_for_custom_auth.sql`
   - Second: `supabase/migrations/20251109000000_create_storage_bucket.sql`
5. Click **Run** for each one

## Option 2: Using Supabase CLI (If installed)

```bash
cd /home/samanthabrown/VibeCADing/styled-pages

# Apply all pending migrations
supabase db push
```

## Option 3: Manual SQL (Copy/Paste)

### Step 1: Fix RLS Policies

Run this in Supabase SQL Editor:

```sql
-- Drop existing policies that use auth.uid() (which doesn't work with custom auth)
DROP POLICY IF EXISTS "Users can insert their own models" ON public.models;
DROP POLICY IF EXISTS "Users can view their own models" ON public.models;
DROP POLICY IF EXISTS "Users can update their own models" ON public.models;
DROP POLICY IF EXISTS "Users can delete their own models" ON public.models;

DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;

-- Create new policies that work with custom auth via app.user_id
CREATE POLICY "Users can view their own models"
  ON public.models FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "Users can insert their own models"
  ON public.models FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "Users can update their own models"
  ON public.models FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "Users can delete their own models"
  ON public.models FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  USING (id::text = current_setting('app.user_id', true));

CREATE POLICY "Users can insert their own data"
  ON public.users FOR INSERT
  WITH CHECK (id::text = current_setting('app.user_id', true));

CREATE POLICY "Users can update their own data"
  ON public.users FOR UPDATE
  USING (id::text = current_setting('app.user_id', true))
  WITH CHECK (id::text = current_setting('app.user_id', true));
```

### Step 2: Create Storage Bucket

Run this in Supabase SQL Editor:

```sql
-- Create storage bucket for 3D models
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'models',
  'models',
  true,
  104857600,
  ARRAY['model/gltf-binary', 'model/stl', 'application/octet-stream', 'model/gltf+json']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policies
CREATE POLICY "Public read access for models bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'models');

CREATE POLICY "Public insert for models bucket"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'models');

CREATE POLICY "Public update for models bucket"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'models')
WITH CHECK (bucket_id = 'models');

CREATE POLICY "Public delete for models bucket"
ON storage.objects
FOR DELETE
USING (bucket_id = 'models');
```

## Verify Storage Bucket

After running the migrations, verify the bucket exists:

1. Go to **Storage** in Supabase Dashboard
2. You should see a bucket named **models**
3. Click on it - should be empty initially

## Test Model Saving

1. Generate a new 3D model using PhotoCapture
2. Check browser console for success message: `✅ Model saved to library`
3. Check Supabase Storage → models bucket → your files should appear
4. Check Supabase Table Editor → models table → new row should appear

## Troubleshooting

### Still getting "Bucket not found"?
- Make sure you're connected to the right Supabase project
- Check `styled-pages/src/lib/supabase.ts` - verify URL and anon key match your dashboard

### Files uploading but not appearing in database?
- Check RLS policies are applied correctly
- Verify `localStorage.getItem('3d_system_user_id')` returns a valid UUID
- Check browser console for errors

### Permission denied errors?
- The storage policies are currently permissive (public) for development
- In production, you'll want to restrict based on authenticated users

