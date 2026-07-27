-- Dos motivos de detención nuevos: ruta cortada y falla mecánica.
--
-- El 26/07 el viaje Copiapó → Viña tuvo los dos: panne de la grúa y corte total
-- de la Ruta 5 por el sistema frontal (socavones entre el km 499 y el 657). Con
-- el catálogo anterior ambos caían en 'otro', que al cliente no le dice nada
-- justo en los dos escenarios más serios que puede vivir un traslado por la
-- Ruta 5 — y son, además, los únicos en que la espera puede ser de horas.
--
-- A diferencia de combustible/alimentación/peaje, estos dos NO llevan umbral de
-- alerta por duración (ver STOP_REASON_ALERT_MINUTES): su duración es
-- impredecible por naturaleza y una alerta que salta siempre no es una alerta.
-- El cierre automático por velocidad sostenida (auto_speed) sí aplica igual:
-- cuando la grúa vuelve a rodar, la detención se cierra sola.

BEGIN;

ALTER TABLE public.service_stop_events
  DROP CONSTRAINT IF EXISTS service_stop_events_reason_check;

ALTER TABLE public.service_stop_events
  ADD CONSTRAINT service_stop_events_reason_check
  CHECK (reason IN (
    'combustible',
    'alimentacion',
    'descanso',
    'peaje',
    'ruta_cortada',
    'falla_mecanica',
    'otro'
  ));

COMMENT ON COLUMN public.service_stop_events.reason IS
  'Motivo declarado de la detención. ruta_cortada y falla_mecanica se agregaron el 26/07/2026 tras vivir ambos en el mismo viaje: sin motivo propio quedaban como "otro" y el cliente no podía distinguir una parada de combustible de una carretera cortada.';

COMMIT;
