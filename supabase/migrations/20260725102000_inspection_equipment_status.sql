-- Estado explícito de cada ítem del checklist de inspección.
--
-- inspections.equipment_checklist (text[]) guarda SOLO los ítems presentes: un
-- ítem revisado-y-ausente es indistinguible de un ítem nunca evaluado. Caso real
-- (servicio 3262047-1): "Foco Faenero" fue revisado, no estaba físicamente, y no
-- quedó rastro en ninguna parte.
--
-- equipment_status congela además el catálogo vigente al momento de inspeccionar:
-- si mañana se agrega o desactiva un ítem, el acta histórica sigue mostrando
-- exactamente lo que se evaluó ese día.
--
-- NO se hace backfill de inspecciones históricas: no es reconstruible qué se
-- evaluó. equipment_checklist se sigue escribiendo en paralelo para no romper
-- consumidores existentes.

BEGIN;

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS equipment_status jsonb;

COMMENT ON COLUMN public.inspections.equipment_status IS
  'Estado explícito de cada ítem del catálogo al momento de la inspección: {item_id: true|false}. Fuente de verdad desde 2026-07. equipment_checklist se mantiene por compatibilidad (solo presentes).';

COMMIT;
