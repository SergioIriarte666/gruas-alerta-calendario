
-- Verificar y corregir las políticas RLS para la tabla services
-- Primero eliminamos las políticas existentes que pueden estar causando problemas
DROP POLICY IF EXISTS "Users can view services based on role" ON public.services;
DROP POLICY IF EXISTS "Users can manage services based on role" ON public.services;

-- Crear políticas más simples y funcionales
-- Política para ver servicios: admins ven todo, operadores solo los suyos
CREATE POLICY "View services policy" ON public.services
  FOR SELECT
  USING (
    -- Admins y viewers pueden ver todos los servicios
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    -- Operadores pueden ver servicios asignados a ellos
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );

-- Política para gestionar servicios
CREATE POLICY "Manage services policy" ON public.services
  FOR ALL
  USING (
    -- Solo admins pueden gestionar todos los servicios
    (get_user_role(auth.uid()) = 'admin')
    OR
    -- Operadores pueden actualizar sus propios servicios
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );

-- Verificar que las políticas en operators también estén bien
DROP POLICY IF EXISTS "Users can view operators based on role" ON public.operators;
DROP POLICY IF EXISTS "Users can manage operators based on role" ON public.operators;

CREATE POLICY "View operators policy" ON public.operators
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND user_id = auth.uid())
  );

CREATE POLICY "Manage operators policy" ON public.operators
  FOR ALL
  USING (
    (get_user_role(auth.uid()) = 'admin')
    OR
    (get_user_role(auth.uid()) = 'operator' AND user_id = auth.uid())
  );
