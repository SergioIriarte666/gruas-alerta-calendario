BEGIN;

-- Desactivar proveedores duplicados, conservando primero el que tenga más
-- costos asociados y, en caso de empate, el registro más antiguo.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY rut
           ORDER BY
             (SELECT COUNT(*) FROM costs WHERE supplier_id = inventory_suppliers.id) DESC,
             created_at ASC
         ) AS rn
  FROM inventory_suppliers
  WHERE rut IS NOT NULL
)
UPDATE inventory_suppliers
SET is_active = false
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
)
AND is_active = true;

-- Permitir registros históricos inactivos, pero un solo proveedor activo por RUT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_suppliers_rut_unique
ON inventory_suppliers (rut)
WHERE rut IS NOT NULL AND is_active = true;

COMMIT;
