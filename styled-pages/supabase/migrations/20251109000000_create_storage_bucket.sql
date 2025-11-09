-- Create storage bucket for 3D models
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'models',
  'models',
  true,  -- Public bucket so GLB/STL files can be loaded in Three.js
  104857600,  -- 100MB limit per file
  ARRAY['model/gltf-binary', 'model/stl', 'application/octet-stream', 'model/gltf+json']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policy: Allow public read access (needed for Three.js to load models)
CREATE POLICY "Public read access for models bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'models');

-- Storage policy: Allow public insert (permissive for development)
-- TODO: In production, restrict this to authenticated users only
CREATE POLICY "Public insert for models bucket"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'models');

-- Storage policy: Allow public update (permissive for development)
CREATE POLICY "Public update for models bucket"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'models')
WITH CHECK (bucket_id = 'models');

-- Storage policy: Allow public delete (permissive for development)
CREATE POLICY "Public delete for models bucket"
ON storage.objects
FOR DELETE
USING (bucket_id = 'models');

