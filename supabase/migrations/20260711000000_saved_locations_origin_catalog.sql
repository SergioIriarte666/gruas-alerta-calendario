BEGIN;

-- Primer registro verificado del catalogo curado de ubicaciones de origen.
-- El geocoding automatico no puede arbitrar nombres de lugar ambiguos
-- ("Mantos de Oro" resolvio a oficinas de Kinross en Paipote, 85km de la
-- faena real en la cordillera): este catalogo prioriza coordenadas curadas
-- por el admin sobre cualquier resultado de Places/Geocoding.
INSERT INTO public.saved_locations (name, latitude, longitude, aliases, category, address, is_active)
SELECT
  'Mina La Coipa - Mantos de Oro',
  -26.8129475,
  -69.2698737,
  ARRAY['la coipa', 'minera la coipa', 'mantos de oro'],
  'faena_minera',
  'Distrito Maricunga, Copiapó',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.saved_locations WHERE name = 'Mina La Coipa - Mantos de Oro'
);

-- RLS de saved_locations ya cumple lo requerido (verificado, sin cambios):
-- saved_locations_read  -> SELECT para cualquier authenticated
-- saved_locations_write -> INSERT solo admin u operator
-- saved_locations_update -> UPDATE solo admin u operator
-- (00000000000000_baseline_schema.sql, sin policies para anon)

-- Upsert atomico del catalogo desde el formulario de servicios:
-- - Si se reutiliza una ubicacion existente (p_matched_id), incrementa
--   usage_count y agrega el texto tipeado a aliases si no estaba ya.
-- - Si es una ubicacion nueva confirmada por el admin (p_save_new), la inserta.
-- SECURITY INVOKER a proposito: debe respetar las RLS de saved_locations
-- (admin/operator), no evitarlas.
CREATE OR REPLACE FUNCTION public.upsert_service_origin_location(
  p_matched_id uuid,
  p_typed_text text,
  p_lat double precision,
  p_lng double precision,
  p_save_new boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_matched_id IS NOT NULL THEN
    UPDATE public.saved_locations
    SET
      usage_count = usage_count + 1,
      latitude = p_lat,
      longitude = p_lng,
      aliases = CASE
        WHEN p_typed_text IS NOT NULL
          AND trim(p_typed_text) <> ''
          AND lower(trim(p_typed_text)) <> lower(name)
          AND NOT EXISTS (
            SELECT 1 FROM unnest(aliases) AS a WHERE lower(a) = lower(trim(p_typed_text))
          )
        THEN array_append(aliases, trim(p_typed_text))
        ELSE aliases
      END
    WHERE id = p_matched_id;
  ELSIF p_save_new AND p_typed_text IS NOT NULL AND trim(p_typed_text) <> '' THEN
    INSERT INTO public.saved_locations (name, latitude, longitude, category, is_active, created_by)
    VALUES (trim(p_typed_text), p_lat, p_lng, 'otro', true, auth.uid());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_service_origin_location(uuid, text, double precision, double precision, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_service_origin_location(uuid, text, double precision, double precision, boolean) TO authenticated;

COMMIT;
