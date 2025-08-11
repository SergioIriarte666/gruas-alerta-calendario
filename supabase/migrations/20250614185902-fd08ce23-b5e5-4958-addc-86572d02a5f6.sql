
-- Limpiamos cualquier política de seguridad anterior en la tabla 'company_data' para evitar conflictos.
DROP POLICY IF EXISTS "Allow admin to manage company data" ON public.company_data;
DROP POLICY IF EXISTS "Allow authenticated write access" ON public.company_data;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.company_data;

-- Nueva política para permitir que cualquier usuario autenticado PUEDA LEER la información de la empresa.
-- Dado que solo hay una fila de datos de empresa, esto es seguro.
CREATE POLICY "Allow authenticated read access"
ON public.company_data FOR SELECT
TO authenticated
USING (true);

-- Nueva política para permitir que cualquier usuario autenticado PUEDA ESCRIBIR (crear, actualizar, eliminar) 
-- en la tabla de información de la empresa. Esto soluciona el error de guardado.
CREATE POLICY "Allow authenticated write access"
ON public.company_data FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
