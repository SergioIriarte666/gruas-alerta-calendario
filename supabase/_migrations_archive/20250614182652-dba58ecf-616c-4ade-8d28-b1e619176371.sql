
-- Paso 1: Asegurar que el bucket 'company-assets' exista y sea público.
-- Esta operación es segura y no fallará si el bucket ya existe.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Paso 2: Limpiar políticas existentes para evitar conflictos.
-- Es seguro ejecutar esto incluso si las políticas no existen.
DROP POLICY IF EXISTS "Public read access for company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files in company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files from company-assets" ON storage.objects;

-- Paso 3: Recrear las políticas con los permisos correctos y necesarios.

-- Política para permitir la lectura pública de los logos.
-- Esencial para que se puedan mostrar en la aplicación.
CREATE POLICY "Public read access for company-assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'company-assets');

-- Política para permitir que usuarios autenticados suban nuevos logos.
CREATE POLICY "Authenticated users can upload to company-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Política para permitir que usuarios autenticados actualicen los logos que subieron.
-- La condición auth.uid() = owner es una medida de seguridad clave.
CREATE POLICY "Authenticated users can update files in company-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner)
WITH CHECK (bucket_id = 'company-assets');

-- Política para permitir que usuarios autenticados eliminen los logos que subieron.
CREATE POLICY "Authenticated users can delete files from company-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);
