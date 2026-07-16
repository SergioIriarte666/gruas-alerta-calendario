BEGIN;

ALTER TABLE public.sii_rcv_records
  ADD COLUMN IF NOT EXISTS linked_sale_id uuid;

ALTER TABLE public.sii_rcv_records
  DROP CONSTRAINT IF EXISTS sii_rcv_records_link_type_check,
  DROP CONSTRAINT IF EXISTS sii_rcv_records_linked_sale_id_fkey;

ALTER TABLE public.sii_rcv_records
  ADD CONSTRAINT sii_rcv_records_link_type_check
    CHECK (
      (linked_cost_id IS NULL OR book_type = 'compra')
      AND (linked_sale_id IS NULL OR book_type = 'venta')
    ),
  ADD CONSTRAINT sii_rcv_records_linked_sale_id_fkey
    FOREIGN KEY (linked_sale_id) REFERENCES public.lowboy_sales(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.idx_sii_rcv_records_linked_service;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sii_rcv_records_linked_sale
  ON public.sii_rcv_records(linked_sale_id)
  WHERE linked_sale_id IS NOT NULL;

ALTER TABLE public.sii_rcv_records
  DROP COLUMN IF EXISTS linked_service_id;

ALTER TABLE public.lowboy_sales
  DROP CONSTRAINT IF EXISTS lowboy_sales_linked_rcv_record_id_fkey,
  DROP CONSTRAINT IF EXISTS lowboy_sales_executed_date_check,
  DROP COLUMN IF EXISTS linked_rcv_record_id;

ALTER TABLE public.lowboy_sales
  ADD CONSTRAINT lowboy_sales_executed_date_check
    CHECK (status IN ('confirmada', 'cancelada') OR executed_date IS NOT NULL);

COMMENT ON COLUMN public.sii_rcv_records.linked_sale_id IS
  'Vínculo conciliatorio único de una venta RCV con una venta comercial LowBoy.';
COMMENT ON TABLE public.sii_rcv_records IS
  'Registro de Compras y Ventas de LowBoy. Compras se vinculan a costs; ventas se vinculan exclusivamente a lowboy_sales.';
COMMENT ON TABLE public.lowboy_sales IS
  'Ventas comerciales de LowBoy Chile SpA. Las facturas se vinculan exclusivamente desde sii_rcv_records.linked_sale_id.';

CREATE OR REPLACE FUNCTION public.set_lowboy_rcv_sale_link(
  p_record_id uuid,
  p_sale_id uuid,
  p_mark_as_invoiced boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  target_record public.sii_rcv_records%ROWTYPE;
  target_sale public.lowboy_sales%ROWTYPE;
BEGIN
  SELECT * INTO target_record
  FROM public.sii_rcv_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF target_record.id IS NULL THEN
    RAISE EXCEPTION 'El documento RCV seleccionado no existe';
  END IF;
  IF target_record.book_type <> 'venta' THEN
    RAISE EXCEPTION 'Solo los documentos de venta pueden vincularse a ventas LowBoy';
  END IF;

  IF p_sale_id IS NULL THEN
    UPDATE public.sii_rcv_records SET linked_sale_id = NULL WHERE id = p_record_id;
    RETURN;
  END IF;

  SELECT * INTO target_sale
  FROM public.lowboy_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF target_sale.id IS NULL OR target_sale.status = 'cancelada' THEN
    RAISE EXCEPTION 'La venta LowBoy seleccionada no existe o está cancelada';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sii_rcv_records
    WHERE linked_sale_id = p_sale_id AND id <> p_record_id
  ) THEN
    RAISE EXCEPTION 'La venta LowBoy ya está vinculada a otra factura';
  END IF;

  IF p_mark_as_invoiced AND target_sale.status IN ('confirmada', 'ejecutada') THEN
    UPDATE public.lowboy_sales
    SET status = 'facturada',
        executed_date = COALESCE(executed_date, target_record.doc_date)
    WHERE id = p_sale_id;
  END IF;

  UPDATE public.sii_rcv_records
  SET linked_sale_id = p_sale_id
  WHERE id = p_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sell_lowboy_container(
  p_container_id uuid,
  p_sale_id uuid,
  p_sale_net_price numeric,
  p_rcv_record_id uuid DEFAULT NULL,
  p_mark_as_invoiced boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  target_container public.lowboy_containers%ROWTYPE;
  target_sale public.lowboy_sales%ROWTYPE;
BEGIN
  IF p_sale_net_price < 0 THEN
    RAISE EXCEPTION 'El precio neto del contenedor no puede ser negativo';
  END IF;

  SELECT * INTO target_container
  FROM public.lowboy_containers
  WHERE id = p_container_id
  FOR UPDATE;

  IF target_container.id IS NULL OR target_container.status = 'vendido' THEN
    RAISE EXCEPTION 'El contenedor no existe o ya fue vendido';
  END IF;

  SELECT * INTO target_sale
  FROM public.lowboy_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF target_sale.id IS NULL OR target_sale.sale_type <> 'producto' OR target_sale.status = 'cancelada' THEN
    RAISE EXCEPTION 'La venta debe existir, ser de producto y no estar cancelada';
  END IF;

  IF p_rcv_record_id IS NOT NULL THEN
    PERFORM public.set_lowboy_rcv_sale_link(p_rcv_record_id, p_sale_id, p_mark_as_invoiced);
  END IF;

  UPDATE public.lowboy_containers
  SET sale_id = p_sale_id,
      sale_net_price = p_sale_net_price,
      status = 'vendido'
  WHERE id = p_container_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_lowboy_sale_containers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.lowboy_containers
    SET status = 'disponible', sale_id = NULL, sale_net_price = NULL
    WHERE sale_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.lowboy_containers
    SET status = 'disponible', sale_id = NULL, sale_net_price = NULL
    WHERE sale_id = OLD.id;
    UPDATE public.sii_rcv_records SET linked_sale_id = NULL WHERE linked_sale_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_lowboy_rcv_sale_link(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sell_lowboy_container(uuid, uuid, numeric, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lowboy_rcv_sale_link(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sell_lowboy_container(uuid, uuid, numeric, uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_lowboy_rcv_sale_link(uuid, uuid, boolean) IS
  'Vincula, cambia o elimina atómicamente el vínculo entre una venta RCV y lowboy_sales.';
COMMENT ON FUNCTION public.sell_lowboy_container(uuid, uuid, numeric, uuid, boolean) IS
  'Confirma atómicamente la venta de un contenedor y su factura RCV opcional.';

COMMIT;
