BEGIN;

-- Vincula salidas de bodega a un servicio de "Venta de Productos" y conserva
-- el precio de venta al cliente por separado del costo FIFO real (unit_cost),
-- para poder calcular el margen sin perder ninguno de los dos valores.
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS service_id uuid NULL REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_unit_price numeric(12,2) NULL;

-- Sin ON DELETE CASCADE: convención del repo desde el fix de historial de
-- servicios (20260703190000_harden_service_audit.sql) para no arrastrar
-- borrados en cascada sobre datos operativos de bodega.
CREATE INDEX IF NOT EXISTS idx_inventory_movements_service_id
  ON public.inventory_movements (service_id)
  WHERE service_id IS NOT NULL;

COMMENT ON COLUMN public.inventory_movements.service_id IS
  'Servicio de tipo "Venta de Productos" al que pertenece esta salida. NULL para salidas por consumo interno (grúa/mantención/ajuste).';

COMMENT ON COLUMN public.inventory_movements.sale_unit_price IS
  'Precio de venta unitario al cliente cuando la salida corresponde a una venta (service_id no nulo). unit_cost/total_cost siguen guardando el costo FIFO real de adquisición para no perder el margen.';

-- Nota de diseño (ver PR): las salidas vinculadas a un servicio de venta NO
-- deben generar un costo operacional en la categoría "Inventario"/"Mantenimiento"
-- como si fueran consumo interno. sync_inventory_exit_to_crane_parts_trigger
-- (que crea crane_parts y podría derivar en costos) solo se activa cuando
-- crane_id IS NOT NULL, así que estas salidas deliberadamente NO setean
-- crane_id. La venta ya se contabiliza como ingreso vía services.value; el
-- costo de la mercadería vendida se expone solo de forma informativa (tarjeta
-- de margen), no como un cost adicional.

COMMIT;
