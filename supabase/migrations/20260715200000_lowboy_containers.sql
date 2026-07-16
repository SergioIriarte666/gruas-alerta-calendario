BEGIN;

CREATE TABLE IF NOT EXISTS public.lowboy_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text,
  size text NOT NULL CHECK (size IN ('20', '40', '40HC', 'otro')),
  container_type text NOT NULL DEFAULT 'dry'
    CHECK (container_type IN ('dry', 'reefer', 'open_top', 'flat_rack', 'otro')),
  condition text NOT NULL DEFAULT 'usado'
    CHECK (condition IN ('nuevo', 'seminuevo', 'usado', 'a_reparar')),
  acquisition_date date NOT NULL,
  supplier_rut text,
  supplier_name text,
  acquisition_net_cost numeric NOT NULL CHECK (acquisition_net_cost >= 0),
  purchase_rcv_record_id uuid REFERENCES public.sii_rcv_records(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'disponible'
    CHECK (status IN ('disponible', 'reservado', 'vendido')),
  sale_id uuid REFERENCES public.lowboy_sales(id) ON DELETE SET NULL,
  sale_net_price numeric CHECK (sale_net_price >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lowboy_containers_sold_sale_check
    CHECK ((status = 'vendido') = (sale_id IS NOT NULL)),
  CONSTRAINT lowboy_containers_sale_price_check
    CHECK (sale_id IS NOT NULL OR sale_net_price IS NULL)
);

CREATE TABLE IF NOT EXISTS public.lowboy_container_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.lowboy_containers(id) ON DELETE CASCADE,
  concept text NOT NULL,
  net_amount numeric NOT NULL CHECK (net_amount >= 0),
  cost_date date NOT NULL,
  rcv_record_id uuid REFERENCES public.sii_rcv_records(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lowboy_containers_serial_unique
  ON public.lowboy_containers (serial_number)
  WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lowboy_containers_status
  ON public.lowboy_containers (status);
CREATE INDEX IF NOT EXISTS idx_lowboy_containers_purchase_rcv
  ON public.lowboy_containers (purchase_rcv_record_id);
CREATE INDEX IF NOT EXISTS idx_lowboy_containers_sale
  ON public.lowboy_containers (sale_id);
CREATE INDEX IF NOT EXISTS idx_lowboy_container_costs_container
  ON public.lowboy_container_costs (container_id);
CREATE INDEX IF NOT EXISTS idx_lowboy_container_costs_rcv
  ON public.lowboy_container_costs (rcv_record_id);

ALTER TABLE public.lowboy_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lowboy_container_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lowboy_containers_admin_all ON public.lowboy_containers;
CREATE POLICY lowboy_containers_admin_all
  ON public.lowboy_containers
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user_safe()))
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS lowboy_containers_viewer_select ON public.lowboy_containers;
CREATE POLICY lowboy_containers_viewer_select
  ON public.lowboy_containers
  FOR SELECT TO authenticated
  USING ((SELECT public.get_current_user_role_safe()) = 'viewer'::public.app_role);

DROP POLICY IF EXISTS lowboy_container_costs_admin_all ON public.lowboy_container_costs;
CREATE POLICY lowboy_container_costs_admin_all
  ON public.lowboy_container_costs
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user_safe()))
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS lowboy_container_costs_viewer_select ON public.lowboy_container_costs;
CREATE POLICY lowboy_container_costs_viewer_select
  ON public.lowboy_container_costs
  FOR SELECT TO authenticated
  USING ((SELECT public.get_current_user_role_safe()) = 'viewer'::public.app_role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lowboy_containers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lowboy_container_costs TO authenticated;
GRANT ALL ON public.lowboy_containers TO service_role;
GRANT ALL ON public.lowboy_container_costs TO service_role;

CREATE OR REPLACE FUNCTION public.touch_lowboy_containers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lowboy_containers_updated_at ON public.lowboy_containers;
CREATE TRIGGER trg_lowboy_containers_updated_at
  BEFORE UPDATE ON public.lowboy_containers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_lowboy_containers_updated_at();

CREATE OR REPLACE FUNCTION public.validate_lowboy_container_sale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  linked_sale public.lowboy_sales%ROWTYPE;
BEGIN
  IF NEW.sale_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO linked_sale
  FROM public.lowboy_sales
  WHERE id = NEW.sale_id;

  IF linked_sale.id IS NULL THEN
    RAISE EXCEPTION 'La venta LowBoy seleccionada no existe';
  END IF;
  IF linked_sale.sale_type <> 'producto' THEN
    RAISE EXCEPTION 'Un contenedor solo puede asociarse a una venta de producto';
  END IF;
  IF linked_sale.status = 'cancelada' THEN
    RAISE EXCEPTION 'No se puede vender un contenedor mediante una venta cancelada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lowboy_container_sale ON public.lowboy_containers;
CREATE TRIGGER trg_validate_lowboy_container_sale
  BEFORE INSERT OR UPDATE OF sale_id ON public.lowboy_containers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lowboy_container_sale();

CREATE OR REPLACE FUNCTION public.release_lowboy_sale_containers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.lowboy_containers
    SET status = 'disponible',
        sale_id = NULL,
        sale_net_price = NULL
    WHERE sale_id = OLD.id;

    RETURN OLD;
  END IF;

  IF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.lowboy_containers
    SET status = 'disponible',
        sale_id = NULL,
        sale_net_price = NULL
    WHERE sale_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_lowboy_sale_containers ON public.lowboy_sales;
CREATE TRIGGER trg_release_lowboy_sale_containers
  BEFORE UPDATE OF status OR DELETE ON public.lowboy_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.release_lowboy_sale_containers();

REVOKE ALL ON FUNCTION public.release_lowboy_sale_containers() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.lowboy_containers IS
  'Inventario seriado de contenedores de LowBoy Chile SpA. No se sincroniza con inventory_* ni costs.';
COMMENT ON TABLE public.lowboy_container_costs IS
  'Costos adicionales netos por contenedor (flete, reparación, pintura u otros).';
COMMENT ON FUNCTION public.release_lowboy_sale_containers() IS
  'Libera automáticamente los contenedores cuando su venta se cancela o elimina. Esta es la única vía de liberación por cancelación.';

WITH seed(folio, acquisition_date, acquisition_net_cost) AS (
  VALUES
    (6157::bigint, DATE '2026-07-07', 2360000::numeric),
    (6161::bigint, DATE '2026-07-08', 2100000::numeric)
),
source_records AS (
  SELECT DISTINCT ON (seed.folio)
    r.id,
    r.folio,
    r.counterpart_rut,
    COALESCE(NULLIF(BTRIM(r.counterpart_name), ''), 'Kube SpA.') AS counterpart_name,
    seed.acquisition_date,
    seed.acquisition_net_cost
  FROM seed
  JOIN public.sii_rcv_records r
    ON r.book_type = 'compra'
   AND r.folio = seed.folio
   AND regexp_replace(r.entity_rut, '[^0-9Kk]', '', 'g') = '783876566'
  ORDER BY seed.folio, r.created_at DESC
)
INSERT INTO public.lowboy_containers (
  serial_number,
  size,
  container_type,
  condition,
  acquisition_date,
  supplier_rut,
  supplier_name,
  acquisition_net_cost,
  purchase_rcv_record_id,
  status
)
SELECT
  NULL,
  '20',
  'dry',
  'usado',
  source_records.acquisition_date,
  source_records.counterpart_rut,
  source_records.counterpart_name,
  source_records.acquisition_net_cost,
  source_records.id,
  'disponible'
FROM source_records
WHERE NOT EXISTS (
  SELECT 1
  FROM public.lowboy_containers existing
  WHERE existing.purchase_rcv_record_id = source_records.id
);

COMMIT;
