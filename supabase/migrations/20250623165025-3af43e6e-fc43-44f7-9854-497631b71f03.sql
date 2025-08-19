
-- Eliminar la función existente primero
DROP FUNCTION IF EXISTS public.get_all_users();

-- Crear la función actualizada con información del cliente asociado
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
SET search_path TO 'public'
AS $function$
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
  ORDER BY p.created_at DESC;
END;
$function$
