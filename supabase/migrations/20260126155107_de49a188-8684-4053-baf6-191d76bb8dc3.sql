-- Arreglar la recursión infinita en la política de user_roles
-- El problema es que admin_only_role_management consulta user_roles dentro de su propia política

-- Primero, eliminar la política problemática
DROP POLICY IF EXISTS "admin_only_role_management" ON user_roles;

-- Crear una función SECURITY DEFINER que evita la recursión
CREATE OR REPLACE FUNCTION public.is_admin_user(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = check_user_id 
    AND role = 'admin'
  );
$$;

-- Recrear la política usando la función SECURITY DEFINER
-- La función bypasea las políticas RLS evitando la recursión
CREATE POLICY "admin_only_role_management"
ON user_roles
FOR ALL
TO public
USING (
  public.is_admin_user(auth.uid())
)
WITH CHECK (
  public.is_admin_user(auth.uid())
);