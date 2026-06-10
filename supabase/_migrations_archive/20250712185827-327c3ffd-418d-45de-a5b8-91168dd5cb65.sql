-- Create bucket for quick entry photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quick-entry-photos', 'quick-entry-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload quick entry photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view quick entry photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete quick entry photos" ON storage.objects;

-- Policy for uploading photos (authenticated users)
CREATE POLICY "Authenticated users can upload quick entry photos" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'quick-entry-photos');

-- Policy for viewing photos (public access)
CREATE POLICY "Anyone can view quick entry photos" 
ON storage.objects FOR SELECT 
TO anon, authenticated
USING (bucket_id = 'quick-entry-photos');

-- Policy for deleting photos (authenticated users)
CREATE POLICY "Authenticated users can delete quick entry photos" 
ON storage.objects FOR DELETE 
TO authenticated
USING (bucket_id = 'quick-entry-photos');