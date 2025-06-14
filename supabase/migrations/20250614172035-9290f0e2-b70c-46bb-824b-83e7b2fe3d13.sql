
-- Create a new storage bucket for company assets like logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up policies for the new bucket
-- Allow public read access so logos can be displayed anywhere
CREATE POLICY "Public read access for company-assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'company-assets');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to company-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update files in company-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner)
WITH CHECK (bucket_id = 'company-assets');

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete files from company-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);
