-- Fix 8 (ronda 2, 26/07/2026): el ETA de la pagina /track apuntaba SIEMPRE al
-- ORIGEN del servicio, aunque la linea de tiempo ya estuviera en "Trasladando".
--
-- Evidencia (servicio real SRV-6858, 26/07 09:14): con el vehiculo ya cargado y
-- la etapa correctamente en "towing", el cliente leyo "TU GRUA LLEGA EN 2 min ·
-- 0.7 km" — la distancia al pin de ORIGEN (Control Porteria Mantos de Oro) que
-- la grua acababa de dejar atras, cuando la entrega real en Copiapo estaba a
-- ~1,5 h. El objetivo del ETA nunca cambiaba al avanzar la etapa.
--
-- Esta migracion aporta las dos piezas de datos que faltaban:
--
-- 1. services.destination_lat/lng: el destino solo existia como TEXTO libre
--    (services.destination), asi que no habia adonde rutear. Se resuelve una
--    sola vez (catalogo saved_locations primero, geocoding despues) desde la
--    edge function service-tracking y se cachea aqui: el mismo patron
--    catalog-first de resolveOriginFromCatalog, que gana ante nombres
--    coloquiales homonimos ("Mantos de Oro") antes de gastar una llamada.
--
-- 2. service_tracking_links.eta_target_kind: la clave de cache del ETA era solo
--    eta_target_stop_id, que en el flujo legacy (sin paradas navegables) es NULL
--    a ambos lados. Sin esta columna, al pasar de "on_site" a "towing" el cache
--    hacia el ORIGEN seguia calzando y se servia hasta 60 s de ETA al punto
--    equivocado — justo el dato falso que este fix elimina.
BEGIN;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS destination_lat double precision,
  ADD COLUMN IF NOT EXISTS destination_lng double precision;

COMMENT ON COLUMN public.services.destination_lat IS
  'Latitud del destino, resuelta y cacheada bajo demanda por service-tracking (catalogo saved_locations, luego geocoding). NULL = aun no resuelta o no resoluble desde el texto.';
COMMENT ON COLUMN public.services.destination_lng IS
  'Longitud del destino. Ver services.destination_lat.';

ALTER TABLE public.service_tracking_links
  ADD COLUMN IF NOT EXISTS eta_target_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_tracking_links_eta_target_kind_check'
      AND conrelid = 'public.service_tracking_links'::regclass
  ) THEN
    ALTER TABLE public.service_tracking_links
      ADD CONSTRAINT service_tracking_links_eta_target_kind_check
      CHECK (eta_target_kind IS NULL OR eta_target_kind IN ('origin', 'destination', 'stop'));
  END IF;
END $$;

COMMENT ON COLUMN public.service_tracking_links.eta_target_kind IS
  'Hacia que punto apunta el ETA cacheado: origin (antes de la carga), destination (desde "towing") o stop (multidestino). Forma parte de la clave de cache junto a eta_target_stop_id.';

COMMIT;
