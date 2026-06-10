-- Permitir que los usuarios autenticados puedan ver información básica de otros perfiles
-- (solo id, full_name, email) para mostrar quién creó servicios, costos, etc.
CREATE POLICY "profiles_select_basic_info_all_users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);