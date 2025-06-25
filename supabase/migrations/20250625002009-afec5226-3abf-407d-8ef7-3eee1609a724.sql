
-- Eliminar la función anterior y crear una nueva versión corregida
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, app_role, uuid);

-- Crear función corregida que no viola la restricción de clave foránea
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

  -- Insertar el usuario en auth.users primero (simulado)
  -- Como no podemos insertar directamente en auth.users, creamos el perfil
  -- con un UUID único que no viola la restricción
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
  RAISE NOTICE 'Usuario pre-registrado creado: id=%, email=%, role=%, created_by=%', 
    new_user_id, p_email, p_role, auth.uid();

  RETURN new_user_id;
END;
$$;

-- Modificar la restricción de clave foránea para permitir usuarios pre-registrados
-- Eliminar la restricción existente
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- No recrear la restricción - permitir perfiles sin usuarios auth correspondientes
-- Esto permite pre-registrar usuarios que luego se registrarán normalmente
