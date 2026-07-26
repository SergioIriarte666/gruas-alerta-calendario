-- Doble llave para cerrar un servicio: id + folio, validados en el servidor.
--
-- 25/07 21:29:56, el defecto más grave de la noche: el flujo de entrega, que en
-- pantalla decía TEST-TRACK-01, completó el servicio REAL 3262047-1
-- (inspection_completed → completed), le escribió un PDF de entrega falso, pisó
-- RUT y nombre del receptor, disparó el correo al cliente y revocó su link.
--
-- El requisito del dueño del sistema es explícito: la confirmación humana NO
-- cuenta como prevención. Este archivo hace el error IMPOSIBLE de ejecutar, no
-- improbable de cometer:
--
--   1. La UI manda el id que carga por dentro Y el folio que muestra en
--      pantalla. Si divergen —que es exactamente lo que pasó— el servidor
--      rechaza con folio_mismatch y no toca nada.
--   2. No queda otra vía: un trigger BEFORE UPDATE rechaza cualquier cierre que
--      no venga de estas funciones. Sin eso la RPC sería opcional y un flujo con
--      bug la saltaría, que es justo lo que ocurrió.
--
-- Exención explícita y auditada: el rol admin (2 cuentas de escritorio) sigue
-- pudiendo cambiar estados desde el TMS —cierres, facturación, anulaciones,
-- herramientas de reparación—, y los trabajos server-side sin usuario (crons,
-- edge functions con service_role) también. El vector cerrado aquí es el de la
-- app del operador, que es donde ocurrió y donde la pantalla puede mentir.

BEGIN;

-- ── 1. Validación compartida: existe, autorizado, folio calza ───────────────
/**
 * Devuelve el estado actual del servicio si el llamador puede operarlo Y el
 * folio confirmado coincide. El orden de las validaciones importa: primero
 * autorización y recién después el folio, para no confirmar por diferencia de
 * mensajes el folio de un servicio ajeno.
 */
CREATE OR REPLACE FUNCTION public.assert_service_identity(
  p_service_id uuid,
  p_folio_confirmation text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_folio  text;
  v_status text;
BEGIN
  IF p_service_id IS NULL THEN
    RAISE EXCEPTION 'Falta el servicio' USING ERRCODE = '22023';
  END IF;

  SELECT s.folio, s.status::text INTO v_folio, v_status
  FROM public.services s
  WHERE s.id = p_service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_operator_assigned_to_service(p_service_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'No estás asignado a este servicio' USING ERRCODE = '42501';
  END IF;

  IF p_folio_confirmation IS NULL
     OR btrim(p_folio_confirmation) IS DISTINCT FROM btrim(v_folio) THEN
    RAISE EXCEPTION 'folio_mismatch: la pantalla dice % y el servicio es %. No se modificó nada.',
      COALESCE(btrim(p_folio_confirmation), '(sin folio)'), v_folio
      USING ERRCODE = '22023';
  END IF;

  RETURN v_status;
END;
$$;

-- ── 2. Cierre del servicio ─────────────────────────────────────────────────
/**
 * Único camino para llevar un servicio a 'completed' desde la app del operador.
 * Idempotente: si ya está cerrado no falla ni vuelve a disparar los triggers de
 * cierre (correo, revocación de link, métricas) — un reintento en terreno tras
 * un WebView zombi tiene que poder repetirse sin consecuencias.
 */
CREATE OR REPLACE FUNCTION public.complete_service(
  p_service_id uuid,
  p_folio_confirmation text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  v_status := public.assert_service_identity(p_service_id, p_folio_confirmation);

  IF v_status = 'completed' THEN
    RETURN 'already_completed';
  END IF;

  IF v_status NOT IN ('in_progress', 'inspection_completed') THEN
    RAISE EXCEPTION 'invalid_transition: no se puede completar un servicio en estado %', v_status
      USING ERRCODE = '22023';
  END IF;

  -- La bandera lleva el ID VALIDADO, no un simple "on": aunque algo más quisiera
  -- cerrar otro servicio dentro de la misma transacción, el trigger lo rechaza.
  PERFORM set_config('app.via_complete_service', p_service_id::text, true);

  UPDATE public.services
  SET status = 'completed'
  WHERE id = p_service_id;

  PERFORM set_config('app.via_complete_service', '', true);

  RETURN 'completed';
END;
$$;

-- ── 3. Avances no terminales del operador (misma doble llave) ──────────────
/**
 * 'Iniciar Servicio' (→ in_progress) y el cierre de la inspección inicial
 * (→ inspection_completed). No son destructivos como el cierre, pero escribirlos
 * en el servicio equivocado ensucia igual la operación: piden el mismo folio.
 */
CREATE OR REPLACE FUNCTION public.advance_operator_service_status(
  p_service_id uuid,
  p_folio_confirmation text,
  p_target_status text,
  p_start_time text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_target_status NOT IN ('in_progress', 'inspection_completed') THEN
    RAISE EXCEPTION 'Estado no permitido por esta función: %', p_target_status
      USING ERRCODE = '22023';
  END IF;

  v_status := public.assert_service_identity(p_service_id, p_folio_confirmation);

  IF v_status = p_target_status THEN
    RETURN 'unchanged';
  END IF;

  IF p_target_status = 'in_progress' AND v_status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_transition: no se puede iniciar un servicio en estado %', v_status
      USING ERRCODE = '22023';
  END IF;

  IF p_target_status = 'inspection_completed' AND v_status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'invalid_transition: no se puede pasar a entrega desde %', v_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.services
  SET status = p_target_status::public.service_status,
      start_time = CASE
        WHEN p_start_time IS NULL OR btrim(p_start_time) = '' THEN start_time
        ELSE p_start_time::time
      END
  WHERE id = p_service_id;

  RETURN p_target_status;
END;
$$;

-- ── 4. No existe otra vía ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_service_close_double_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('completed', 'cancelled')
     -- Trabajos server-side sin usuario autenticado (crons, service_role).
     AND auth.uid() IS NOT NULL
     -- Escritorio: rol admin, exención explícita y auditada.
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     -- Vía legítima: complete_service dejó el id validado en la bandera.
     AND COALESCE(current_setting('app.via_complete_service', true), '') IS DISTINCT FROM NEW.id::text
  THEN
    RAISE EXCEPTION 'Un servicio solo puede cerrarse con complete_service(id, folio): el cierre directo está bloqueado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_service_close_double_key ON public.services;
CREATE TRIGGER trg_enforce_service_close_double_key
  BEFORE UPDATE OF status ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_service_close_double_key();

-- ── Grants ─────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.assert_service_identity(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_service(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.advance_operator_service_status(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_service_close_double_key() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assert_service_identity(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_service(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_operator_service_status(uuid, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.complete_service(uuid, text) IS
  'Único camino para completar un servicio desde la app del operador: exige el folio que la UI muestra en pantalla además del id que carga por dentro. Idempotente.';
COMMENT ON FUNCTION public.enforce_service_close_double_key() IS
  'Bloquea cualquier cierre de servicio que no venga de complete_service. Exentos: rol admin (escritorio) y trabajos server-side sin usuario.';

COMMIT;
