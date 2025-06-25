
-- Corregir warnings de Supabase agregando search_path fijo a las funciones

-- Actualizar función validate_email con search_path fijo
CREATE OR REPLACE FUNCTION public.validate_email(email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

-- Actualizar función get_client_id_for_user con search_path fijo
CREATE OR REPLACE FUNCTION public.get_client_id_for_user(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_id_result UUID;
BEGIN
  SELECT client_id INTO client_id_result
  FROM public.profiles
  WHERE id = user_id;

  RETURN client_id_result;
END;
$$;
