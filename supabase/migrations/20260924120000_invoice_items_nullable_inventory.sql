-- Las líneas de factura importadas desde XML en Costos son documentales:
-- reflejan el Detalle del DTE sin crear ítems de inventario. NULL en
-- inventory_item_id = línea sin ítem de bodega asociado; Bodega solo se
-- toca vía el toggle "Sincronizar con Bodega/Inventario" del diálogo.
ALTER TABLE public.supplier_invoice_items
  ALTER COLUMN inventory_item_id DROP NOT NULL;
