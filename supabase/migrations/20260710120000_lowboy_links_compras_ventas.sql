BEGIN;

ALTER TABLE public.sii_rcv_records
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'sii_import',
  ADD COLUMN IF NOT EXISTS linked_cost_id uuid
    REFERENCES public.costs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_service_id uuid
    REFERENCES public.services(id) ON DELETE SET NULL;

ALTER TABLE public.sii_rcv_records
  ADD CONSTRAINT sii_rcv_records_source_check
    CHECK (source IN ('sii_import', 'manual')),
  ADD CONSTRAINT sii_rcv_records_link_type_check
    CHECK (
      (linked_cost_id IS NULL OR book_type = 'compra')
      AND (linked_service_id IS NULL OR book_type = 'venta')
    );

CREATE INDEX IF NOT EXISTS idx_sii_rcv_records_linked_cost
  ON public.sii_rcv_records(linked_cost_id)
  WHERE linked_cost_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sii_rcv_records_linked_service
  ON public.sii_rcv_records(linked_service_id)
  WHERE linked_service_id IS NOT NULL;

COMMENT ON COLUMN public.sii_rcv_records.source IS
  'Origen del registro: sii_import para cargas CSV y manual para CRUD desde Lowboy.';
COMMENT ON COLUMN public.sii_rcv_records.linked_cost_id IS
  'Vínculo conciliatorio de una compra RCV con un costo TMS; no modifica el costo.';
COMMENT ON COLUMN public.sii_rcv_records.linked_service_id IS
  'Vínculo conciliatorio de una venta RCV con un servicio TMS; no modifica el servicio.';

COMMENT ON TABLE public.sii_rcv_records IS
  'Registro de Compras y Ventas (RCV) de Lowboy, importado desde CSV o creado manualmente. Los vínculos con costos y servicios son solo conciliatorios.';

COMMIT;
