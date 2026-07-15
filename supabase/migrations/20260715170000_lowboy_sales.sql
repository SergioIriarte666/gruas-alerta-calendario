BEGIN;

-- Pipeline comercial de LowBoy Chile SpA. Módulo AISLADO: sin FK a services,
-- closures ni clients de G5N. La única FK externa permitida es a sii_rcv_records
-- (mismo módulo Lowboy). Dos líneas de negocio: reventa de contenedores marítimos
-- ('producto') y fletes con equipo propio ('flete').
-- Flujo real: una venta nace CONFIRMADA (no hay cotización) y avanza
-- confirmada → ejecutada → facturada → pagada, o se cancela.
CREATE TABLE IF NOT EXISTS public.lowboy_sales (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_type            text NOT NULL CHECK (sale_type IN ('producto', 'flete')),
  client_rut           text NOT NULL,          -- normalizado XX.XXX.XXX-D
  client_name          text NOT NULL,
  description          text NOT NULL,          -- ej: "Contenedor 40HC serie XXXX" o "Flete estructura Santiago→Copiapó"
  origin               text,                   -- solo flete
  destination          text,                   -- solo flete
  scheduled_date       date,                   -- fecha comprometida (flete o entrega)
  executed_date        date,                   -- fecha real de ejecución/entrega
  net_amount           numeric NOT NULL CHECK (net_amount >= 0),
  status               text NOT NULL DEFAULT 'confirmada'
    CHECK (status IN ('confirmada', 'ejecutada', 'facturada', 'pagada', 'cancelada')),
  linked_rcv_record_id uuid REFERENCES public.sii_rcv_records(id) ON DELETE SET NULL,
  notes                text,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- origen/destino solo aplican a fletes; un producto no los tiene.
  CONSTRAINT lowboy_sales_flete_route_check
    CHECK ((sale_type = 'flete') OR (origin IS NULL AND destination IS NULL))
);

COMMENT ON TABLE public.lowboy_sales IS
  'Ventas comerciales de LowBoy Chile SpA (producto=contenedores, flete=equipo propio). Módulo aislado; única FK externa: sii_rcv_records. linked_rcv_record_id reservado para fase futura (sin UI).';

CREATE INDEX IF NOT EXISTS idx_lowboy_sales_status         ON public.lowboy_sales(status);
CREATE INDEX IF NOT EXISTS idx_lowboy_sales_scheduled_date ON public.lowboy_sales(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_lowboy_sales_sale_type      ON public.lowboy_sales(sale_type);

ALTER TABLE public.lowboy_sales ENABLE ROW LEVEL SECURITY;

-- Escritura completa: solo admin (mismo helper del resto del módulo Lowboy).
DROP POLICY IF EXISTS lowboy_sales_admin_all ON public.lowboy_sales;
CREATE POLICY lowboy_sales_admin_all
  ON public.lowboy_sales
  FOR ALL
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

-- Lectura: viewer (mismo patrón que sii_rcv_records).
DROP POLICY IF EXISTS lowboy_sales_viewer_select ON public.lowboy_sales;
CREATE POLICY lowboy_sales_viewer_select
  ON public.lowboy_sales
  FOR SELECT
  USING (public.get_current_user_role_safe() = 'viewer'::public.app_role);

-- Trigger updated_at, mismo patrón del repo (touch_*_updated_at).
CREATE OR REPLACE FUNCTION public.touch_lowboy_sales_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lowboy_sales_updated_at ON public.lowboy_sales;
CREATE TRIGGER trg_lowboy_sales_updated_at
  BEFORE UPDATE ON public.lowboy_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_lowboy_sales_updated_at();

COMMIT;
