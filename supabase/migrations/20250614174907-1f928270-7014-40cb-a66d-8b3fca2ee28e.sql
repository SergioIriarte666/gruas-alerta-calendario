
-- Asegura que el bucket 'company-assets' exista y sea público.
-- Si ya existe, simplemente confirma que es público.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Elimina las políticas antiguas si existen para evitar conflictos.
-- Esto nos da un borrón y cuenta nueva para configurar los permisos correctamente.
DROP POLICY IF EXISTS "Public read access for company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files from company-assets" ON storage.objects;

-- Política para permitir la lectura pública de los archivos.
-- Esencial para que los logos se puedan mostrar en la aplicación.
CREATE POLICY "Public read access for company-assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'company-assets');

-- Política para permitir que usuarios autenticados suban archivos.
CREATE POLICY "Authenticated users can upload to company-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Política para permitir que usuarios autenticados actualicen sus propios archivos.
CREATE POLICY "Authenticated users can update files in company-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner)
WITH CHECK (bucket_id = 'company-assets');

-- Política para permitir que usuarios autenticados eliminen sus propios archivos.
CREATE POLICY "Authenticated users can delete files from company-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);
