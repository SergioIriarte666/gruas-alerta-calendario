
-- Crear tabla para trackear invitaciones de usuarios
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired')),
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS en la tabla
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Política para que solo admins puedan ver invitaciones
CREATE POLICY "Admins can manage user invitations" ON public.user_invitations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Función para actualizar el estado de invitación cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_user_invitation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Actualizar invitación a 'accepted' cuando un usuario se registra con email que tenía invitación pendiente
  UPDATE public.user_invitations 
  SET status = 'accepted', 
      accepted_at = now(),
      updated_at = now()
  WHERE email = NEW.email 
    AND status IN ('pending', 'sent');
  
  RETURN NEW;
END;
$$;

-- Trigger para actualizar invitaciones cuando se registra un usuario
CREATE TRIGGER on_user_registration_update_invitation
  AFTER INSERT ON public.profiles
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_user_invitation_acceptance();

-- Actualizar la función admin_create_user para crear registro en user_invitations
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

  -- Insertar el usuario pre-registrado
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

  -- Crear registro de invitación
  INSERT INTO public.user_invitations (
    user_id,
    email,
    status,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    p_email,
    'pending',
    now(),
    now()
  );

  -- Log de la acción
  RAISE NOTICE 'Usuario pre-registrado creado con invitación: id=%, email=%, role=%, created_by=%', 
    new_user_id, p_email, p_role, auth.uid();

  RETURN new_user_id;
END;
$$;
