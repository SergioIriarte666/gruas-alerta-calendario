-- RESOLVER ERROR: ELIMINAR FUNCIÓN EXISTENTE ANTES DE RECREAR
-- =======================================================================================

-- Eliminar función conflictiva primero
DROP FUNCTION IF EXISTS public.update_user_role_secure(uuid, app_role);

-- Crear funciones SECURITY DEFINER seguras para evitar recursión infinita
-- =======================================================================================

-- Función segura para verificar si el usuario está autenticado 
CREATE OR REPLACE FUNCTION public.is_authenticated_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- Función segura para obtener el rol del usuario actual sin recursión
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    'viewer'::app_role
  );
$$;

-- Función segura para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_current_user_role_safe() = 'admin';
$$;

-- Función segura para verificar si es operador o admin
CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_current_user_role_safe() IN ('admin', 'operator');
$$;

-- Función segura para verificar si es cliente
CREATE OR REPLACE FUNCTION public.is_client_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_current_user_role_safe() = 'client';
$$;

-- Función segura para obtener el client_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_client_id_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Función de seguridad mejorada para validar role changes (NUEVA)
CREATE OR REPLACE FUNCTION public.update_user_role_secure(
  target_user_id uuid, 
  new_role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_admin_count INTEGER;
  target_current_role app_role;
  requesting_user_role app_role;
BEGIN
  -- Verificar permisos del usuario que hace la petición
  SELECT role INTO requesting_user_role
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF requesting_user_role != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar roles de usuario';
  END IF;

  -- Obtener rol actual del usuario objetivo
  SELECT role INTO target_current_role
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF target_current_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Prevenir que el último admin pierda privilegios
  IF target_current_role = 'admin' AND new_role != 'admin' THEN
    SELECT COUNT(*) INTO current_admin_count
    FROM public.profiles
    WHERE role = 'admin' AND is_active = true;
    
    IF current_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede degradar al último administrador activo del sistema';
    END IF;
  END IF;

  -- Prevenir auto-degradación de admin
  IF auth.uid() = target_user_id AND target_current_role = 'admin' AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Los administradores no pueden degradar su propio rol';
  END IF;

  -- Actualizar el rol
  UPDATE public.profiles 
  SET 
    role = new_role,
    updated_at = now()
  WHERE id = target_user_id;

  RAISE NOTICE 'Role changed successfully: user % from % to % by %', 
    target_user_id, target_current_role, new_role, auth.uid();
END;
$$;