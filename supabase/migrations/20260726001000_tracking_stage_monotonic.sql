-- La línea de tiempo del cliente solo avanza.
--
-- Prueba en terreno del 25/07: a las 21:25 la página mostraba "Trasladando"
-- (etapa 4) y a las 21:41, con la grúa de vuelta dentro del geocerco del origen,
-- RETROCEDIÓ a "Tu grúa llegó al punto de origen" (etapa 3). La etapa se calcula
-- por proximidad en cada refresh, así que cualquier paso por el origen la
-- rebobina. Para el cliente eso se lee como que el servicio se deshizo.
--
-- El progreso máximo alcanzado se persiste aquí y la edge function service-
-- tracking publica max(etapa_calculada, etapa_persistida).

BEGIN;

ALTER TABLE public.service_tracking_links
  ADD COLUMN IF NOT EXISTS max_stage_reached text;

COMMENT ON COLUMN public.service_tracking_links.max_stage_reached IS
  'Etapa máxima de la línea de tiempo ya mostrada al cliente (assigned < en_route < on_site < towing < last_leg < arrived). La etapa publicada nunca retrocede por debajo de este valor: la grúa puede volver a pasar por el origen, el viaje no.';

ALTER TABLE public.service_tracking_links
  DROP CONSTRAINT IF EXISTS service_tracking_links_max_stage_reached_check;
ALTER TABLE public.service_tracking_links
  ADD CONSTRAINT service_tracking_links_max_stage_reached_check
  CHECK (max_stage_reached IS NULL OR max_stage_reached IN (
    'assigned', 'en_route', 'on_site', 'towing', 'last_leg', 'arrived'
  ));

COMMIT;
