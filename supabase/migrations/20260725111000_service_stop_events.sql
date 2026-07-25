-- Detenciones declaradas con motivo durante un traslado.
--
-- En un Copiapó→Viña hay paradas legítimas (combustible, comida, descanso,
-- peaje). Hoy el cliente ve el ícono congelado sin contexto y lo lee como
-- problema, y el ETA sigue corriendo como si la ruta fuera continua.
--
-- Nombre a propósito distinto de `service_stops`, que es otra cosa: paradas
-- PLANIFICADAS del recorrido multidestino. Esto son eventos NO planificados.

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_stop_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('combustible','alimentacion','descanso','peaje','otro')),
  note text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  /** 'manual' = el operador pulsó "Rodando"; 'auto_speed' = se cerró solo al detectar movimiento sostenido. */
  ended_by_source text CHECK (ended_by_source IS NULL OR ended_by_source IN ('manual','auto_speed','service_closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_stop_events_window_check CHECK (ended_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.service_stop_events IS
  'Detenciones declaradas por el operador durante un traslado (combustible, alimentación, descanso, peaje, otro). La página pública expone SOLO reason y started_at del evento activo: note y operator_id nunca salen al cliente.';

-- Un solo evento abierto por servicio: dos detenciones simultáneas no
-- significan nada y romperían el "evento activo" de la página del cliente.
CREATE UNIQUE INDEX IF NOT EXISTS service_stop_events_one_open_per_service
  ON public.service_stop_events (service_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS service_stop_events_service_started_idx
  ON public.service_stop_events (service_id, started_at DESC);

CREATE INDEX IF NOT EXISTS service_stop_events_operator_started_idx
  ON public.service_stop_events (operator_id, started_at DESC);

ALTER TABLE public.service_stop_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_stop_events FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.service_stop_events TO authenticated;
GRANT ALL ON TABLE public.service_stop_events TO service_role;

-- La autorización reutiliza public.is_operator_assigned_to_service(_service_id),
-- que ya existe y cubre las dos formas de asignación (services.operator_id y
-- service_resources). No se redefine: cambiarle el nombre del parámetro sería
-- un 42P13 y duplicar la lógica es cómo se desincronizan las policies.

DROP POLICY IF EXISTS "stop_events_select" ON public.service_stop_events;
CREATE POLICY "stop_events_select" ON public.service_stop_events
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    OR (SELECT public.is_operator_assigned_to_service(service_id))
  );

DROP POLICY IF EXISTS "stop_events_insert" ON public.service_stop_events;
CREATE POLICY "stop_events_insert" ON public.service_stop_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    OR (SELECT public.is_operator_assigned_to_service(service_id))
  );

DROP POLICY IF EXISTS "stop_events_update" ON public.service_stop_events;
CREATE POLICY "stop_events_update" ON public.service_stop_events
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    OR (SELECT public.is_operator_assigned_to_service(service_id))
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    OR (SELECT public.is_operator_assigned_to_service(service_id))
  );

-- Un servicio que se cierra no puede dejar una detención abierta colgando: la
-- página del cliente y "Tiempos muertos" la contarían como eterna.
CREATE OR REPLACE FUNCTION public.close_stop_events_on_service_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('completed', 'cancelled', 'failed') THEN
    UPDATE public.service_stop_events
    SET ended_at = now(), ended_by_source = 'service_closed'
    WHERE service_id = NEW.id AND ended_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_stop_events_on_service_close ON public.services;
CREATE TRIGGER trg_close_stop_events_on_service_close
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.close_stop_events_on_service_close();

REVOKE ALL ON FUNCTION public.close_stop_events_on_service_close() FROM PUBLIC, anon, authenticated;

COMMIT;
