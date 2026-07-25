-- Control unificado de transmisión del portal operador.
--
-- Aporta lo que la UI necesita y hoy no existe:
--   1. PIN por operador para proteger el corte manual mientras un cliente mira.
--   2. Auditoría de cómo y quién terminó una sesión de ubicación.
--   3. Flag de corte manual, para que el auto-encendido por movimiento nunca
--      pase por encima de una decisión explícita del operador.
--   4. Un camino para que el OPERADOR ASIGNADO obtenga el link de seguimiento
--      (hasta ahora get_or_create_tracking_token era solo service_role y
--      create_service_tracking_link solo admin: el operador no tenía ninguno).

BEGIN;

-- ── 1. PIN del operador ─────────────────────────────────────────────────────
/**
 * Tabla aparte, NO una columna en operators: `authenticated` tiene SELECT y
 * UPDATE a nivel de tabla sobre public.operators, así que una columna pin_hash
 * ahí quedaría legible por cualquier usuario autenticado y —peor— escribible
 * directamente, saltándose el control de admin de set_operator_pin.
 *
 * Aquí el acceso es cero para todos los roles de cliente: RLS activo y SIN
 * policies. Solo las funciones SECURITY DEFINER de abajo la tocan.
 */
CREATE TABLE IF NOT EXISTS public.operator_pins (
  operator_id uuid PRIMARY KEY REFERENCES public.operators(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

COMMENT ON TABLE public.operator_pins IS
  'Hash bcrypt del PIN de 4 dígitos por operador. Sin policies a propósito: solo accesible vía set_operator_pin / clear_operator_pin / operator_has_pin / verify_operator_pin (SECURITY DEFINER). Nunca texto plano, nunca expuesto al cliente.';

ALTER TABLE public.operator_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_pins FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operator_pins FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.operator_pins TO service_role;

-- ── 2. Auditoría del cierre de sesión ───────────────────────────────────────
ALTER TABLE public.operator_location_sessions
  ADD COLUMN IF NOT EXISTS ended_by uuid;

COMMENT ON COLUMN public.operator_location_sessions.ended_by IS
  'Usuario que cortó la transmisión manualmente. NULL en cierres automáticos (timeout, schedule_end, service_change).';

-- 'manual' se conserva por compatibilidad con las filas ya escritas; los cortes
-- nuevos usan manual_pin (había link de cliente vigente) o manual_confirm.
ALTER TABLE public.operator_location_sessions
  DROP CONSTRAINT IF EXISTS operator_location_sessions_ended_reason_check;
ALTER TABLE public.operator_location_sessions
  ADD CONSTRAINT operator_location_sessions_ended_reason_check
  CHECK (ended_reason IS NULL OR ended_reason IN (
    'manual', 'manual_pin', 'manual_confirm', 'service_change', 'timeout', 'schedule_end', 'service_closed'
  ));

-- ── 3. Precedencia del corte manual ─────────────────────────────────────────
-- Vive en la sesión (no solo en estado local) para sobrevivir reinstalaciones
-- y cambios de dispositivo: el auto-encendido no debe resucitar por reiniciar.
ALTER TABLE public.operator_location_sessions
  ADD COLUMN IF NOT EXISTS manual_stop boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.operator_location_sessions.manual_stop IS
  'true cuando el operador cortó la transmisión a mano. Inhibe el auto-encendido por movimiento para ese servicio hasta que la reencienda manualmente.';

-- ── 4. PIN: definir / limpiar / consultar / verificar ───────────────────────
CREATE OR REPLACE FUNCTION public.set_operator_pin(p_operator_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo los administradores pueden definir el PIN de un operador' USING ERRCODE = '42501';
  END IF;

  IF p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'El PIN debe ser exactamente 4 dígitos' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = p_operator_id) THEN
    RAISE EXCEPTION 'Operador no encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.operator_pins (operator_id, pin_hash, updated_by)
  VALUES (p_operator_id, extensions.crypt(p_pin, extensions.gen_salt('bf')), auth.uid())
  ON CONFLICT (operator_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_operator_pin(p_operator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo los administradores pueden quitar el PIN de un operador' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.operator_pins WHERE operator_id = p_operator_id;
END;
$$;

-- Solo dice SI hay PIN, nunca el hash: la UI necesita saber si puede pedirlo.
CREATE OR REPLACE FUNCTION public.operator_has_pin(p_operator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.operator_pins p WHERE p.operator_id = p_operator_id);
$$;

/**
 * Verifica el PIN. Devuelve boolean: el llamador decide qué hacer con un fallo.
 * NO bloquea al operador tras N intentos — dejar a una grúa sin poder operar la
 * app en terreno es peor que un PIN mal tecleado tres veces.
 * Solo puede verificar su propio PIN (o un admin).
 */
CREATE OR REPLACE FUNCTION public.verify_operator_pin(p_operator_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_hash text;
  v_owner uuid;
BEGIN
  SELECT o.user_id INTO v_owner
  FROM public.operators o
  WHERE o.id = p_operator_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_owner IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'No puedes verificar el PIN de otro operador' USING ERRCODE = '42501';
  END IF;

  SELECT p.pin_hash INTO v_hash FROM public.operator_pins p WHERE p.operator_id = p_operator_id;

  -- Sin PIN configurado no hay nada que verificar: el llamador cae a la
  -- doble confirmación simple.
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN extensions.crypt(p_pin, v_hash) = v_hash;
END;
$$;

-- ── 5. Link de seguimiento para el operador asignado ────────────────────────
/**
 * El operador comparte el link del cliente desde su propio control de
 * transmisión. Reutiliza get_or_create_tracking_token (token vigente si existe)
 * pero autoriza por ASIGNACIÓN al servicio, no por rol admin.
 *
 * La asignación se resuelve con is_operator_assigned_to_service, que ya cubre
 * las dos formas que conviven en el modelo: services.operator_id y
 * service_resources (ver capture_service_resource_operator_activity).
 */
CREATE OR REPLACE FUNCTION public.get_operator_service_tracking_token(p_service_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_is_assigned boolean;
BEGIN
  -- Reutiliza el helper existente en vez de repetir la consulta de asignación.
  v_is_assigned := public.is_operator_assigned_to_service(p_service_id);

  IF NOT v_is_assigned AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo el operador asignado puede compartir el seguimiento de este servicio'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.get_or_create_tracking_token(p_service_id, auth.uid());
END;
$$;

/** ¿Hay link de cliente vigente? Alimenta la insignia de ojo del control. */
CREATE OR REPLACE FUNCTION public.service_has_active_tracking_link(p_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_tracking_links l
    WHERE l.service_id = p_service_id
      AND l.revoked_at IS NULL
      AND l.expires_at > now()
  );
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.set_operator_pin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_operator_pin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.operator_has_pin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_operator_pin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_operator_service_tracking_token(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.service_has_active_tracking_link(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_operator_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_operator_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.operator_has_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_operator_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operator_service_tracking_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_has_active_tracking_link(uuid) TO authenticated;

COMMIT;
