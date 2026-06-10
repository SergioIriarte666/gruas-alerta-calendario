BEGIN;

-- Las políticas RLS de profiles solo permiten ver/editar la propia fila,
-- por lo que el flujo de usuarios pendientes (listar, contar, aprobar,
-- rechazar) debe pasar por RPCs SECURITY DEFINER con verificación de admin,
-- siguiendo el patrón de get_all_users / update_user_role.

-- 1) Listar usuarios pendientes (solo admin)
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.profiles
    WHERE status = 'pending'
    ORDER BY created_at DESC;
END;
$$;

-- 2) Contador de pendientes para el badge del sidebar (solo admin)
CREATE OR REPLACE FUNCTION public.get_pending_users_count()
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  RETURN (SELECT count(*)::integer FROM public.profiles WHERE status = 'pending');
END;
$$;

-- 3) Aprobar usuario pendiente (solo admin)
CREATE OR REPLACE FUNCTION public.approve_pending_user(
  target_user_id uuid,
  new_role app_role DEFAULT 'viewer',
  target_client_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Usuario no encontrado o no está pendiente';
  END IF;

  IF new_role = 'client' AND target_client_id IS NULL THEN
    RAISE EXCEPTION 'Debes asignar un cliente antes de aprobar a un usuario cliente';
  END IF;

  IF target_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients WHERE id = target_client_id
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- Mantiene user_roles en sincronía, igual que update_user_role
  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, new_role, auth.uid())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = now();

  UPDATE public.profiles
  SET
    status = 'approved',
    role = new_role,
    client_id = CASE WHEN new_role = 'client' THEN target_client_id ELSE NULL END,
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;

-- 4) Rechazar usuario pendiente (solo admin)
CREATE OR REPLACE FUNCTION public.reject_pending_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Usuario no encontrado o no está pendiente';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id AND status = 'pending';
  -- El registro en auth.users queda, pero sin profile no puede acceder.
  -- Si se desea eliminarlo de auth también, hacerlo desde el dashboard de Supabase.
END;
$$;

-- 5) Excluir pendientes de get_all_users para que no se mezclen con los
-- usuarios normales. Cuerpo replicado de la definición actual en producción;
-- solo se agrega el WHERE (IS DISTINCT FROM para no ocultar status NULL).
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  role app_role,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  client_id uuid,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.client_id,
    c.name as client_name
  FROM public.profiles p
  LEFT JOIN public.clients c ON p.client_id = c.id
  WHERE p.status IS DISTINCT FROM 'pending'
  ORDER BY p.created_at DESC;
END;
$$;

-- 6) update_user_role debe aprobar implícitamente: si un admin asigna rol
-- desde la lista general, el usuario queda habilitado para entrar.
-- Cuerpo replicado de la definición actual; se agrega status y updated_at.
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Update in user_roles table
  INSERT INTO public.user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, new_role, auth.uid())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = now();

  -- Update profiles for backward compatibility
  UPDATE public.profiles
  SET
    role = new_role,
    status = 'approved',
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;

COMMIT;
