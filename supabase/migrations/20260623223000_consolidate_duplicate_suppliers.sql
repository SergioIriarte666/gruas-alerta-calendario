BEGIN;

-- Identify groups with exactly one active supplier and one or more inactive
-- duplicates sharing the same literal RUT. Empty RUTs are unrelated suppliers.
CREATE TEMP TABLE _consolidation_plan ON COMMIT DROP AS
WITH groups AS (
  SELECT
    rut,
    COUNT(*) FILTER (WHERE is_active) AS n_active,
    COUNT(*) AS n_total,
    (ARRAY_AGG(id) FILTER (WHERE is_active))[1] AS canonical_id
  FROM public.inventory_suppliers
  WHERE rut IS NOT NULL AND BTRIM(rut) <> ''
  GROUP BY rut
)
SELECT
  s.id AS old_id,
  g.canonical_id AS new_id,
  s.rut,
  s.name AS old_name
FROM public.inventory_suppliers s
JOIN groups g ON g.rut = s.rut
WHERE g.n_active = 1
  AND g.n_total > 1
  AND s.id <> g.canonical_id
  AND s.is_active = false;

-- Report the plan in the PostgreSQL migration logs.
DO $$
DECLARE
  plan_count int;
BEGIN
  SELECT COUNT(*) INTO plan_count FROM _consolidation_plan;
  RAISE NOTICE '[Consolidación] % filas inactivas serán fusionadas en sus canónicos activos', plan_count;
END $$;

-- Reassign every foreign key that references inventory_suppliers.id.
UPDATE public.supplier_invoices si
SET supplier_id = cp.new_id
FROM _consolidation_plan cp
WHERE si.supplier_id = cp.old_id;

UPDATE public.costs c
SET supplier_id = cp.new_id
FROM _consolidation_plan cp
WHERE c.supplier_id = cp.old_id;

UPDATE public.supplier_payments sp
SET supplier_id = cp.new_id
FROM _consolidation_plan cp
WHERE sp.supplier_id = cp.old_id;

UPDATE public.crane_parts pa
SET supplier_id = cp.new_id
FROM _consolidation_plan cp
WHERE pa.supplier_id = cp.old_id;

UPDATE public.inventory_movements im
SET supplier_id = cp.new_id
FROM _consolidation_plan cp
WHERE im.supplier_id = cp.old_id;

UPDATE public.creditors cr
SET supplier_id = cp.new_id
FROM _consolidation_plan cp
WHERE cr.supplier_id = cp.old_id;

UPDATE public.services s
SET outsourced_provider_id = cp.new_id
FROM _consolidation_plan cp
WHERE s.outsourced_provider_id = cp.old_id;

-- Delete the inactive duplicates after all references have moved.
DELETE FROM public.inventory_suppliers
WHERE id IN (SELECT old_id FROM _consolidation_plan);

-- Abort the transaction if a targeted active/inactive duplicate group remains.
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM (
    SELECT rut
    FROM public.inventory_suppliers
    WHERE rut IS NOT NULL AND BTRIM(rut) <> ''
    GROUP BY rut
    HAVING COUNT(*) FILTER (WHERE is_active) = 1 AND COUNT(*) > 1
  ) x;

  IF remaining > 0 THEN
    RAISE EXCEPTION '[Consolidación] Aún quedan % grupos sin consolidar', remaining;
  END IF;
  RAISE NOTICE '[Consolidación] OK — 0 grupos duplicados con 1 activo + ≥1 inactivo';
END $$;

COMMIT;
