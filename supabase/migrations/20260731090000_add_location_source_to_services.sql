-- Trazabilidad de la procedencia del punto: la etiqueta escrita a mano y la
-- coordenada dejan de estar amarradas, asi que hace falta saber de donde salio
-- cada par lat/lng (catalogo verificado, Places, link del cliente, plus code,
-- pin arrastrado a mano o coordenadas pegadas).

BEGIN;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS origin_location_source text,
  ADD COLUMN IF NOT EXISTS destination_location_source text;

COMMENT ON COLUMN public.services.origin_location_source IS
  'Procedencia de origin_lat/lng: catalog | places | client_link | plus_code | manual_pin | coords. NULL = servicio sin coordenada o anterior a esta columna.';

COMMENT ON COLUMN public.services.destination_location_source IS
  'Procedencia de destination_lat/lng: catalog | places | client_link | plus_code | manual_pin | coords. NULL = servicio sin coordenada o anterior a esta columna.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'services_origin_location_source_check'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_origin_location_source_check
      CHECK (origin_location_source IS NULL OR origin_location_source IN
        ('catalog','places','client_link','plus_code','manual_pin','coords'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'services_destination_location_source_check'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_destination_location_source_check
      CHECK (destination_location_source IS NULL OR destination_location_source IN
        ('catalog','places','client_link','plus_code','manual_pin','coords'))
      NOT VALID;
  END IF;
END $$;

COMMIT;
