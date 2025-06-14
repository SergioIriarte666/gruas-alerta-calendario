
-- Asegura que el bucket 'company-assets' para los logos exista y sea público.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Reinicia las políticas de acceso para asegurar que estén correctas.
DROP POLICY IF EXISTS "Public read access for company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files from company-assets" ON storage.objects;

-- Política para permitir que cualquier persona vea los logos. Es necesario para mostrarlos en la app.
CREATE POLICY "Public read access for company-assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'company-assets');

-- Política para permitir que usuarios autenticados suban nuevos logos.
CREATE POLICY "Authenticated users can upload to company-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Política para permitir que los usuarios autenticados actualicen sus propios logos.
CREATE POLICY "Authenticated users can update files in company-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner)
WITH CHECK (bucket_id = 'company-assets');

-- Política para permitir que los usuarios autenticados eliminen sus propios logos.
CREATE POLICY "Authenticated users can delete files from company-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);

