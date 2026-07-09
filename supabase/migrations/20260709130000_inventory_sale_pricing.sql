BEGIN;

-- Precio de venta configurable por producto: recargo porcentual sobre el
-- costo, o valor fijo. Si ambos quedan en NULL, se usa el margen por
-- defecto global (system_settings.default_sale_markup_percent). unit_cost
-- sigue siendo la única fuente del costo FIFO — estas columnas no lo tocan.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS sale_markup_percent numeric NULL
    CHECK (sale_markup_percent IS NULL OR sale_markup_percent >= 0),
  ADD COLUMN IF NOT EXISTS sale_price_fixed numeric NULL
    CHECK (sale_price_fixed IS NULL OR sale_price_fixed >= 0);

COMMENT ON COLUMN public.inventory_items.sale_markup_percent IS
  'Recargo porcentual sobre unit_cost para calcular el precio de venta sugerido. NULL = no configurado (usa sale_price_fixed o el margen por defecto global).';

COMMENT ON COLUMN public.inventory_items.sale_price_fixed IS
  'Precio de venta fijo, tiene precedencia sobre sale_markup_percent. NULL = no configurado.';

-- Margen de venta por defecto (%) para productos sin configuración propia.
-- system_settings ya es la tabla activa para "Configuración > Sistema"
-- (ver useSystemSettings.ts) y su RLS es admin-only, a diferencia de
-- company_data/localStorage que usa el resto de useSettings.ts.
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS default_sale_markup_percent numeric NOT NULL DEFAULT 30
    CHECK (default_sale_markup_percent >= 0);

COMMENT ON COLUMN public.system_settings.default_sale_markup_percent IS
  'Margen de venta por defecto (%) aplicado a productos de inventario sin sale_markup_percent ni sale_price_fixed propios.';

COMMIT;
