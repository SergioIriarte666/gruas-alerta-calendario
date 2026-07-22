BEGIN;

-- Metadatos autoritativos de la invitacion. El frontend nunca decide el rol
-- efectivo: la Edge Function valida al administrador y esta funcion aplica el
-- cambio de forma atomica.
ALTER TABLE public.user_invitations
  ADD COLUMN IF NOT EXISTS requested_role public.app_role NOT NULL DEFAULT 'viewer'::public.app_role,
  ADD COLUMN IF NOT EXISTS operator_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_invitations_operator_id_fkey'
      AND conrelid = 'public.user_invitations'::regclass
  ) THEN
    ALTER TABLE public.user_invitations
      ADD CONSTRAINT user_invitations_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_invitations_client_id_fkey'
      AND conrelid = 'public.user_invitations'::regclass
  ) THEN
    ALTER TABLE public.user_invitations
      ADD CONSTRAINT user_invitations_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_invitations_invited_by_fkey'
      AND conrelid = 'public.user_invitations'::regclass
  ) THEN
    ALTER TABLE public.user_invitations
      ADD CONSTRAINT user_invitations_invited_by_fkey
      FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_invitations_email_lower
  ON public.user_invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_user_invitations_operator_id
  ON public.user_invitations (operator_id) WHERE operator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_invitations_client_id
  ON public.user_invitations (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_invitations_invited_by
  ON public.user_invitations (invited_by) WHERE invited_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_invitations_active_expiry
  ON public.user_invitations (expires_at)
  WHERE status IN ('pending', 'sent');

-- El trigger anterior aceptaba cualquier invitacion solo por coincidencia de
-- email. La aceptacion pasa a una funcion de servicio que ademas valida rol,
-- operador, vencimiento y usuario Auth.
DROP TRIGGER IF EXISTS on_user_registration_update_invitation ON public.profiles;
REVOKE ALL ON FUNCTION public.handle_user_invitation_acceptance() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finalize_user_invitation(
  target_user_id uuid,
  target_email text,
  target_full_name text,
  requested_role public.app_role,
  target_client_id uuid DEFAULT NULL,
  target_operator_id uuid DEFAULT NULL,
  invitation_creator_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email text := lower(btrim(target_email));
  auth_email text;
  operator_user_id uuid;
  operator_is_active boolean;
  result_status text;
BEGIN
  IF target_user_id IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Usuario y email son obligatorios';
  END IF;

  IF invitation_creator_id IS NULL
     OR NOT public.has_role(invitation_creator_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar invitaciones';
  END IF;

  SELECT lower(btrim(email))
  INTO auth_email
  FROM auth.users
  WHERE id = target_user_id
  FOR UPDATE;

  IF NOT FOUND OR auth_email IS DISTINCT FROM normalized_email THEN
    RAISE EXCEPTION 'La identidad Auth no coincide con la invitacion';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'El perfil del usuario invitado no existe';
  END IF;

  IF requested_role = 'operator'::public.app_role THEN
    IF target_operator_id IS NULL THEN
      RAISE EXCEPTION 'La invitacion de operador requiere una ficha de operador';
    END IF;
    IF target_client_id IS NOT NULL THEN
      RAISE EXCEPTION 'Un operador no puede recibir un cliente asociado';
    END IF;

    SELECT user_id, COALESCE(is_active, false)
    INTO operator_user_id, operator_is_active
    FROM public.operators
    WHERE id = target_operator_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La ficha de operador no existe';
    END IF;
    IF NOT operator_is_active THEN
      RAISE EXCEPTION 'La ficha de operador esta inactiva';
    END IF;
    IF operator_user_id IS NOT NULL AND operator_user_id <> target_user_id THEN
      RAISE EXCEPTION 'La ficha de operador ya esta vinculada a otra cuenta';
    END IF;

    UPDATE public.profiles
    SET
      email = normalized_email,
      full_name = COALESCE(NULLIF(btrim(target_full_name), ''), full_name, normalized_email),
      role = 'operator'::public.app_role,
      status = 'approved',
      is_active = true,
      client_id = NULL,
      updated_at = now()
    WHERE id = target_user_id;

    INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
    VALUES (
      target_user_id,
      'operator'::public.app_role,
      invitation_creator_id,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      role = EXCLUDED.role,
      assigned_by = EXCLUDED.assigned_by,
      assigned_at = EXCLUDED.assigned_at;

    UPDATE public.operators
    SET user_id = target_user_id, updated_at = now()
    WHERE id = target_operator_id;

    result_status := 'auto_approved';
  ELSE
    IF target_operator_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo el rol operator puede vincular una ficha de operador';
    END IF;

    IF requested_role = 'client'::public.app_role THEN
      IF target_client_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.clients
        WHERE id = target_client_id
          AND COALESCE(is_active, false)
      ) THEN
        RAISE EXCEPTION 'La invitacion de cliente requiere un cliente activo';
      END IF;
    ELSIF target_client_id IS NOT NULL THEN
      RAISE EXCEPTION 'El cliente asociado solo corresponde al rol client';
    END IF;

    -- La autoaprobacion se limita deliberadamente a operadores invitados.
    UPDATE public.profiles
    SET
      email = normalized_email,
      full_name = COALESCE(NULLIF(btrim(target_full_name), ''), full_name, normalized_email),
      role = 'viewer'::public.app_role,
      status = 'pending',
      is_active = true,
      client_id = NULL,
      updated_at = now()
    WHERE id = target_user_id;

    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    result_status := 'pending';
  END IF;

  INSERT INTO public.user_invitations (
    user_id,
    email,
    status,
    sent_at,
    accepted_at,
    requested_role,
    operator_id,
    client_id,
    invited_by,
    expires_at,
    created_at,
    updated_at
  )
  VALUES (
    target_user_id,
    normalized_email,
    'sent',
    now(),
    NULL,
    requested_role,
    target_operator_id,
    target_client_id,
    invitation_creator_id,
    now() + interval '7 days',
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    status = 'sent',
    sent_at = EXCLUDED.sent_at,
    accepted_at = NULL,
    requested_role = EXCLUDED.requested_role,
    operator_id = EXCLUDED.operator_id,
    client_id = EXCLUDED.client_id,
    invited_by = EXCLUDED.invited_by,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

  RETURN result_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_operator_invitation(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitation_record record;
  auth_email text;
  operator_user_id uuid;
  operator_is_active boolean;
BEGIN
  SELECT i.id, i.email, i.operator_id, i.status, i.expires_at, i.invited_by
  INTO invitation_record
  FROM public.user_invitations i
  WHERE i.user_id = target_user_id
    AND i.requested_role = 'operator'::public.app_role
    AND i.status IN ('sent', 'accepted')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF invitation_record.status <> 'accepted'
     AND invitation_record.expires_at <= now() THEN
    UPDATE public.user_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = invitation_record.id;
    RETURN false;
  END IF;

  SELECT lower(btrim(email))
  INTO auth_email
  FROM auth.users
  WHERE id = target_user_id
  FOR UPDATE;

  IF NOT FOUND OR auth_email IS DISTINCT FROM lower(btrim(invitation_record.email)) THEN
    RETURN false;
  END IF;

  SELECT user_id, COALESCE(is_active, false)
  INTO operator_user_id, operator_is_active
  FROM public.operators
  WHERE id = invitation_record.operator_id
  FOR UPDATE;

  IF NOT FOUND OR NOT operator_is_active THEN
    RETURN false;
  END IF;
  IF operator_user_id IS NOT NULL AND operator_user_id <> target_user_id THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET
    role = 'operator'::public.app_role,
    status = 'approved',
    is_active = true,
    client_id = NULL,
    updated_at = now()
  WHERE id = target_user_id
    AND status <> 'rejected';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
  VALUES (
    target_user_id,
    'operator'::public.app_role,
    invitation_record.invited_by,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at;

  UPDATE public.operators
  SET user_id = target_user_id, updated_at = now()
  WHERE id = invitation_record.operator_id;

  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
  WHERE id = invitation_record.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_user_invitation(
  uuid, text, text, public.app_role, uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_user_invitation(
  uuid, text, text, public.app_role, uuid, uuid, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.repair_operator_invitation(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_operator_invitation(uuid)
  TO service_role;

REVOKE ALL ON TABLE public.user_invitations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_invitations FROM authenticated;
GRANT SELECT ON TABLE public.user_invitations TO authenticated;
GRANT ALL ON TABLE public.user_invitations TO service_role;

COMMENT ON FUNCTION public.finalize_user_invitation(
  uuid, text, text, public.app_role, uuid, uuid, uuid
) IS 'Registra una invitacion y autoaprueba atomicamente solo a operadores invitados por un administrador.';

COMMENT ON FUNCTION public.repair_operator_invitation(uuid)
IS 'Valida y repara de forma idempotente una invitacion de operador al iniciar sesion.';

COMMIT;
