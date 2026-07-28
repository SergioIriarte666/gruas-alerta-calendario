-- Relevo de operador con servicio en vuelo.
--
-- El relevo es el patrón real del negocio, no la excepción: un operador hace el
-- primer tramo y otro lo termina, a veces con transbordo de la carga en ruta.
-- Hasta ahora el traspaso era invisible: el servicio cambiaba de operador y el
-- entrante quedaba habilitado de inmediato, sin que existiera constancia del
-- estado en que recibió la carga. Si algo aparecía dañado al entregar, no había
-- forma de ubicar el daño en un tramo o en el otro.
--
-- Esta migración abre un traspaso PENDIENTE cuando se reasigna un servicio que
-- ya está rodando, y exige que el operador entrante deje 2-4 fotos del estado de
-- la carga antes de poder operar. Las fotos van al bucket inspection-photos bajo
-- el prefijo del servicio con nombre handoff-<timestamp>-<n>, así que caen en el
-- mismo expediente que el resto de la evidencia.
--
-- "En vuelo" se decide por HECHOS, no por el estado nominal: hay traspaso que
-- registrar si el servicio ya transmitió alguna vez (existe sesión de ubicación)
-- y todavía no está cerrado. Una reasignación administrativa sobre un servicio
-- que nunca salió no es un relevo: es corregir el papeleo, y no debe frenar a
-- nadie en terreno.

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_operator_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  outgoing_operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  incoming_operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  photo_paths text[] NOT NULL DEFAULT '{}',
  notes text,
  CONSTRAINT service_operator_handoffs_photos_on_confirm
    CHECK (confirmed_at IS NULL OR array_length(photo_paths, 1) BETWEEN 2 AND 4)
);

COMMENT ON TABLE public.service_operator_handoffs IS
  'Traspaso de un servicio en vuelo entre operadores. Pendiente hasta que el entrante confirma con 2-4 fotos del estado de la carga.';

-- Un solo traspaso pendiente por servicio: si se reasigna dos veces seguidas
-- antes de que nadie confirme, manda el último.
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_handoff_one_pending
  ON public.service_operator_handoffs (service_id)
  WHERE confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_handoff_service
  ON public.service_operator_handoffs (service_id, requested_at DESC);

ALTER TABLE public.service_operator_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS handoff_select_own_or_admin ON public.service_operator_handoffs;
CREATE POLICY handoff_select_own_or_admin ON public.service_operator_handoffs
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.operators o
      WHERE o.user_id = (SELECT auth.uid())
        AND o.id IN (incoming_operator_id, outgoing_operator_id)
    )
  );

-- Nadie escribe a mano: el alta la abre el trigger y el cierre lo hace la RPC.
DROP POLICY IF EXISTS handoff_no_direct_write ON public.service_operator_handoffs;
CREATE POLICY handoff_no_direct_write ON public.service_operator_handoffs
  FOR INSERT TO authenticated WITH CHECK (false);

GRANT SELECT ON public.service_operator_handoffs TO authenticated;

CREATE OR REPLACE FUNCTION public.open_service_operator_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_in_flight boolean;
BEGIN
  IF NEW.operator_id IS NOT DISTINCT FROM OLD.operator_id
     OR OLD.operator_id IS NULL
     OR NEW.operator_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('completed', 'invoiced', 'cancelled', 'failed') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.operator_location_sessions s
    WHERE s.service_id = NEW.id
  ) INTO v_in_flight;

  IF NOT v_in_flight THEN
    RETURN NEW;
  END IF;

  -- El pendiente anterior (si lo hubiera) se cierra por descarte: manda la
  -- última reasignación, y el índice parcial garantiza que solo quede uno.
  DELETE FROM public.service_operator_handoffs
  WHERE service_id = NEW.id AND confirmed_at IS NULL;

  INSERT INTO public.service_operator_handoffs (service_id, outgoing_operator_id, incoming_operator_id)
  VALUES (NEW.id, OLD.operator_id, NEW.operator_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS open_service_operator_handoff_trigger ON public.services;
CREATE TRIGGER open_service_operator_handoff_trigger
  AFTER UPDATE OF operator_id ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.open_service_operator_handoff();

-- Confirmación del entrante. Doble llave id + folio, como el cierre de servicio
-- y la evidencia de inspección: el folio que el operador tiene en pantalla debe
-- coincidir con el del id que viaja, o la escritura no ocurre. Protege contra
-- confirmar el traspaso del servicio equivocado desde una pantalla desfasada.
CREATE OR REPLACE FUNCTION public.confirm_service_handoff(
  p_service_id uuid,
  p_folio text,
  p_photo_paths text[],
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_operator_id uuid;
  v_handoff_id uuid;
  v_service_folio text;
  v_photo_count int := COALESCE(array_length(p_photo_paths, 1), 0);
BEGIN
  SELECT id INTO v_operator_id
  FROM public.operators
  WHERE user_id = auth.uid();

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Solo un operador puede confirmar la recepción del servicio' USING ERRCODE = '42501';
  END IF;

  SELECT folio INTO v_service_folio FROM public.services WHERE id = p_service_id;

  IF v_service_folio IS NULL THEN
    RAISE EXCEPTION 'Servicio no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_service_folio IS DISTINCT FROM p_folio THEN
    RAISE EXCEPTION 'El folio no corresponde al servicio (% en pantalla, % en la base). Recarga la pantalla.', p_folio, v_service_folio
      USING ERRCODE = '22023';
  END IF;

  IF v_photo_count < 2 OR v_photo_count > 4 THEN
    RAISE EXCEPTION 'Debes adjuntar entre 2 y 4 fotos del estado de la carga (recibidas: %)', v_photo_count
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_handoff_id
  FROM public.service_operator_handoffs
  WHERE service_id = p_service_id
    AND confirmed_at IS NULL
    AND incoming_operator_id = v_operator_id
  FOR UPDATE;

  IF v_handoff_id IS NULL THEN
    RAISE EXCEPTION 'No hay un traspaso pendiente de este servicio a tu nombre' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.service_operator_handoffs
  SET confirmed_at = now(),
      confirmed_by = auth.uid(),
      photo_paths = p_photo_paths,
      notes = NULLIF(btrim(COALESCE(p_notes, '')), '')
  WHERE id = v_handoff_id;

  RETURN v_handoff_id;
END;
$$;

COMMENT ON FUNCTION public.confirm_service_handoff(uuid, text, text[], text) IS
  'El operador entrante confirma la recepción de un servicio en vuelo con 2-4 fotos. Doble llave id+folio.';

REVOKE ALL ON FUNCTION public.confirm_service_handoff(uuid, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_service_handoff(uuid, text, text[], text) TO authenticated;

COMMIT;
