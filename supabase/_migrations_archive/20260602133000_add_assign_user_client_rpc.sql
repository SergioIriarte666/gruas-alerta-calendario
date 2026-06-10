-- Permite asignar o desasignar un cliente a un usuario desde acciones administrativas
CREATE OR REPLACE FUNCTION public.assign_user_client(
  target_user_id uuid,
  target_client_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Only admins can assign clients to users';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF target_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.clients
    WHERE id = target_client_id
  ) THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  UPDATE public.profiles
  SET
    client_id = target_client_id,
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_user_client(uuid, uuid) TO authenticated;
