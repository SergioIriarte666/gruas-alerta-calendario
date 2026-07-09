BEGIN;

-- Vincula un ítem de service_items al producto de inventario de origen
-- cuando la línea viene de "Productos a Vender" (Venta de Productos).
-- NULL para ítems de texto libre (Apoyo Logístico, Servicios Mecánicos y
-- De Apoyo), que no corresponden a un producto de catálogo.
ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid NULL
    REFERENCES public.inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_items_inventory_item_id
  ON public.service_items (inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

COMMENT ON COLUMN public.service_items.inventory_item_id IS
  'Producto de inventario de origen cuando el ítem viene de "Productos a Vender". Permite reconstruir el selector al editar el servicio. NULL para ítems de texto libre.';

COMMIT;
