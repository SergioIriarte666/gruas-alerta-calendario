BEGIN;

-- Corrige typo en el RUT de propietario de la grúa DSBZ-85 (Mack CXU 613): el dígito
-- verificador correcto para 78.387.656 es 6 (coincide con JD-6696 y company_profiles).
-- Sin esto, el agrupamiento por RUT de "LowBoy Chile SpA." queda incompleto.
UPDATE public.cranes
SET owner_company_rut = '78.387.656-6'
WHERE license_plate = 'DSBZ-85'
  AND owner_company_rut = '78.387.656-7';

CREATE TABLE public.sii_rcv_imports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_rut        text NOT NULL,
  book_type         text NOT NULL CHECK (book_type IN ('compra', 'venta')),
  period            text,
  file_name         text,
  records_inserted  integer NOT NULL DEFAULT 0,
  records_skipped   integer NOT NULL DEFAULT 0,
  imported_by       uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sii_rcv_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id         uuid REFERENCES public.sii_rcv_imports(id) ON DELETE SET NULL,
  entity_rut        text NOT NULL,
  book_type         text NOT NULL CHECK (book_type IN ('compra', 'venta')),
  doc_type          integer NOT NULL,
  folio             bigint NOT NULL,
  counterpart_rut   text NOT NULL,
  counterpart_name  text,
  doc_date          date NOT NULL,
  net_amount        numeric NOT NULL DEFAULT 0,
  exempt_amount     numeric NOT NULL DEFAULT 0,
  tax_amount        numeric NOT NULL DEFAULT 0,
  total_amount      numeric NOT NULL DEFAULT 0,
  content_hash      text NOT NULL UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sii_rcv_records_entity_book_date
  ON public.sii_rcv_records(entity_rut, book_type, doc_date);

CREATE INDEX idx_sii_rcv_records_import_id
  ON public.sii_rcv_records(import_id);

ALTER TABLE public.sii_rcv_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sii_rcv_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sii_rcv_imports_admin_all"
  ON public.sii_rcv_imports
  FOR ALL
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

CREATE POLICY "sii_rcv_imports_viewer_select"
  ON public.sii_rcv_imports
  FOR SELECT
  USING (public.get_current_user_role_safe() = 'viewer'::public.app_role);

CREATE POLICY "sii_rcv_records_admin_all"
  ON public.sii_rcv_records
  FOR ALL
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

CREATE POLICY "sii_rcv_records_viewer_select"
  ON public.sii_rcv_records
  FOR SELECT
  USING (public.get_current_user_role_safe() = 'viewer'::public.app_role);

COMMENT ON TABLE public.sii_rcv_records IS
  'Registro de Compras y Ventas (RCV) del SII importado desde CSV, por entidad (RUT propio, ej. lowboy). Sin vínculo con services, clients, costs ni ninguna tabla operacional. Solo lectura y reporte "Resultado".';
COMMENT ON TABLE public.sii_rcv_imports IS
  'Bitácora de cada importación CSV del RCV (compra o venta).';

COMMIT;
