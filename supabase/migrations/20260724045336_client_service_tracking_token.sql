-- Refleja la migración aplicada out-of-band en remoto (2026-07-24 04:53:36,
-- vía MCP/dashboard) para que el historial local cuadre con el remoto.
-- Es funcionalmente idéntica a 20260724040000_client_service_tracking_token.sql
-- (misma función get_client_service_tracking_token); CREATE OR REPLACE la hace
-- idempotente, así que reaplicarla es un no-op. Ver detalle en la 040000.
CREATE OR REPLACE FUNCTION public.get_client_service_tracking_token(
  p_service_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_service_client_id uuid;
BEGIN
  IF NOT public.is_client_user_safe() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_client_id := public.get_user_client_id_safe();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT client_id INTO v_service_client_id
  FROM public.services
  WHERE id = p_service_id;

  IF v_service_client_id IS NULL OR v_service_client_id <> v_client_id THEN
    RAISE EXCEPTION 'Servicio no encontrado' USING ERRCODE = '42501';
  END IF;

  RETURN public.get_or_create_tracking_token(p_service_id, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_service_tracking_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_service_tracking_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_client_service_tracking_token(uuid) TO authenticated;
