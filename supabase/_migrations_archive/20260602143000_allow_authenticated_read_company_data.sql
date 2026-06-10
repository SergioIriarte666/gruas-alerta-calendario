-- Permite que usuarios autenticados lean branding y datos publicos de la empresa
DROP POLICY IF EXISTS "company_data_select_authenticated" ON public.company_data;

CREATE POLICY "company_data_select_authenticated"
ON public.company_data
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');
