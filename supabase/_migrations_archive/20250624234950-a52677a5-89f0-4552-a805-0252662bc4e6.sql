
-- Función para que administradores puedan crear nuevos usuarios
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_full_name TEXT,
  p_role app_role,
  p_client_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Verificar que el usuario que ejecuta la función sea admin
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear nuevos usuarios';
  END IF;

  -- Validar email
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'El email es requerido';
  END IF;

  -- Validar que el email no esté en uso
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Este email ya está registrado en el sistema';
  END IF;

  -- Validar nombre completo
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'El nombre completo es requerido';
  END IF;

  -- Validar rol
  IF p_role IS NULL THEN
    RAISE EXCEPTION 'El rol es requerido';
  END IF;

  -- Si el rol es cliente, validar que se proporcione client_id
  IF p_role = 'client' AND p_client_id IS NULL THEN
    RAISE EXCEPTION 'Para usuarios tipo cliente se debe especificar un cliente asociado';
  END IF;

  -- Generar UUID para el nuevo usuario
  new_user_id := gen_random_uuid();

  -- Insertar directamente en profiles (simulando un usuario creado)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    client_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    p_email,
    p_full_name,
    p_role,
    p_client_id,
    true,
    now(),
    now()
  );

  -- Log de la acción
  RAISE NOTICE 'Usuario creado: id=%, email=%, role=%, created_by=%', 
    new_user_id, p_email, p_role, auth.uid();

  RETURN new_user_id;
END;
$$;

-- Función para validar que un email es válido
CREATE OR REPLACE FUNCTION public.validate_email(email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;
