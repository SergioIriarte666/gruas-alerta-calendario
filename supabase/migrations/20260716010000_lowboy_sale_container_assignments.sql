BEGIN;

ALTER TABLE public.lowboy_containers
  DROP CONSTRAINT IF EXISTS lowboy_containers_sold_sale_check;

ALTER TABLE public.lowboy_containers
  ADD CONSTRAINT lowboy_containers_sold_sale_check
    CHECK (status <> 'vendido' OR sale_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.assign_lowboy_container_to_sale(
  p_container_id uuid,
  p_sale_id uuid,
  p_sale_net_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_container public.lowboy_containers%ROWTYPE;
  target_sale public.lowboy_sales%ROWTYPE;
  target_status text;
BEGIN
  IF p_sale_net_price IS NULL OR p_sale_net_price < 0 THEN
    RAISE EXCEPTION 'El precio neto asignado al contenedor debe ser mayor o igual a cero';
  END IF;

  SELECT * INTO target_sale
  FROM public.lowboy_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF target_sale.id IS NULL OR target_sale.sale_type <> 'producto' OR target_sale.status = 'cancelada' THEN
    RAISE EXCEPTION 'La venta debe existir, ser de producto y no estar cancelada';
  END IF;

  SELECT * INTO target_container
  FROM public.lowboy_containers
  WHERE id = p_container_id
  FOR UPDATE;

  IF target_container.id IS NULL THEN
    RAISE EXCEPTION 'El contenedor seleccionado no existe';
  END IF;
  IF target_container.sale_id IS NOT NULL AND target_container.sale_id <> p_sale_id THEN
    RAISE EXCEPTION 'El contenedor ya está asociado a otra venta';
  END IF;
  IF target_container.sale_id IS NULL AND target_container.status <> 'disponible' THEN
    RAISE EXCEPTION 'El contenedor ya no está disponible';
  END IF;

  target_status := CASE WHEN target_sale.status = 'confirmada' THEN 'reservado' ELSE 'vendido' END;

  UPDATE public.lowboy_containers
  SET sale_id = p_sale_id,
      sale_net_price = p_sale_net_price,
      status = target_status
  WHERE id = p_container_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_lowboy_sale_with_containers(
  p_sale_id uuid,
  p_sale_type text,
  p_client_rut text,
  p_client_name text,
  p_description text,
  p_origin text,
  p_destination text,
  p_scheduled_date date,
  p_executed_date date,
  p_net_amount numeric,
  p_status text,
  p_notes text,
  p_container_assignments jsonb DEFAULT '[]'::jsonb,
  p_rcv_record_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved_sale public.lowboy_sales%ROWTYPE;
  assignment jsonb;
  assignment_ids uuid[] := ARRAY[]::uuid[];
  assignment_id uuid;
  assignment_price numeric;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede guardar ventas LowBoy';
  END IF;
  IF p_sale_type NOT IN ('producto', 'flete') THEN
    RAISE EXCEPTION 'Tipo de venta inválido';
  END IF;
  IF p_status NOT IN ('confirmada', 'ejecutada', 'facturada', 'pagada') THEN
    RAISE EXCEPTION 'Estado inicial inválido';
  END IF;
  IF p_status <> 'confirmada' AND p_executed_date IS NULL THEN
    RAISE EXCEPTION 'La fecha de ejecución es obligatoria para una venta realizada';
  END IF;
  IF p_net_amount < 0 THEN
    RAISE EXCEPTION 'El neto de la venta no puede ser negativo';
  END IF;
  IF NULLIF(BTRIM(p_client_rut), '') IS NULL OR NULLIF(BTRIM(p_client_name), '') IS NULL OR NULLIF(BTRIM(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'RUT, cliente y descripción son obligatorios';
  END IF;
  IF jsonb_typeof(COALESCE(p_container_assignments, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'La asignación de contenedores debe ser una lista';
  END IF;
  IF p_sale_type <> 'producto' AND jsonb_array_length(COALESCE(p_container_assignments, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Solo las ventas de producto pueden asociar contenedores';
  END IF;

  IF p_sale_id IS NULL THEN
    INSERT INTO public.lowboy_sales (
      sale_type, client_rut, client_name, description, origin, destination,
      scheduled_date, executed_date, net_amount, status, notes, created_by
    ) VALUES (
      p_sale_type, BTRIM(p_client_rut), BTRIM(p_client_name), BTRIM(p_description),
      CASE WHEN p_sale_type = 'flete' THEN NULLIF(BTRIM(p_origin), '') ELSE NULL END,
      CASE WHEN p_sale_type = 'flete' THEN NULLIF(BTRIM(p_destination), '') ELSE NULL END,
      p_scheduled_date, p_executed_date, p_net_amount, p_status, NULLIF(BTRIM(p_notes), ''), auth.uid()
    ) RETURNING * INTO saved_sale;
  ELSE
    SELECT * INTO saved_sale FROM public.lowboy_sales WHERE id = p_sale_id FOR UPDATE;
    IF saved_sale.id IS NULL THEN
      RAISE EXCEPTION 'La venta seleccionada no existe';
    END IF;
    IF saved_sale.status IN ('pagada', 'cancelada') THEN
      RAISE EXCEPTION 'Una venta pagada o cancelada no se puede editar';
    END IF;
    IF p_status <> saved_sale.status THEN
      RAISE EXCEPTION 'El estado de la venta debe cambiarse desde el flujo de estados';
    END IF;

    UPDATE public.lowboy_sales
    SET sale_type = p_sale_type,
        client_rut = BTRIM(p_client_rut),
        client_name = BTRIM(p_client_name),
        description = BTRIM(p_description),
        origin = CASE WHEN p_sale_type = 'flete' THEN NULLIF(BTRIM(p_origin), '') ELSE NULL END,
        destination = CASE WHEN p_sale_type = 'flete' THEN NULLIF(BTRIM(p_destination), '') ELSE NULL END,
        scheduled_date = p_scheduled_date,
        net_amount = p_net_amount,
        notes = NULLIF(BTRIM(p_notes), '')
    WHERE id = p_sale_id
    RETURNING * INTO saved_sale;
  END IF;

  FOR assignment IN SELECT value FROM jsonb_array_elements(COALESCE(p_container_assignments, '[]'::jsonb))
  LOOP
    assignment_id := NULLIF(assignment->>'container_id', '')::uuid;
    assignment_price := NULLIF(assignment->>'sale_net_price', '')::numeric;
    IF assignment_id IS NULL OR assignment_price IS NULL THEN
      RAISE EXCEPTION 'Cada contenedor debe incluir id y precio neto asignado';
    END IF;
    IF assignment_id = ANY(assignment_ids) THEN
      RAISE EXCEPTION 'Un contenedor no puede repetirse en la misma venta';
    END IF;
    assignment_ids := array_append(assignment_ids, assignment_id);
    PERFORM public.assign_lowboy_container_to_sale(assignment_id, saved_sale.id, assignment_price);
  END LOOP;

  UPDATE public.lowboy_containers
  SET status = 'disponible', sale_id = NULL, sale_net_price = NULL
  WHERE sale_id = saved_sale.id
    AND NOT (id = ANY(assignment_ids));

  IF p_rcv_record_id IS NOT NULL THEN
    PERFORM public.set_lowboy_rcv_sale_link(p_rcv_record_id, saved_sale.id, false);
  END IF;

  RETURN saved_sale.id;
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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede asociar contenedores a ventas';
  END IF;
  IF p_rcv_record_id IS NOT NULL THEN
    PERFORM public.set_lowboy_rcv_sale_link(p_rcv_record_id, p_sale_id, p_mark_as_invoiced);
  END IF;
  PERFORM public.assign_lowboy_container_to_sale(p_container_id, p_sale_id, p_sale_net_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_lowboy_sale_containers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  assigned_total numeric;
  missing_count integer;
  fallback_price numeric;
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
  ELSIF NEW.status IN ('ejecutada', 'facturada', 'pagada')
    AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT COALESCE(SUM(sale_net_price), 0), COUNT(*) FILTER (WHERE sale_net_price IS NULL)
    INTO assigned_total, missing_count
    FROM public.lowboy_containers
    WHERE sale_id = NEW.id;

    fallback_price := CASE
      WHEN missing_count > 0 THEN GREATEST((NEW.net_amount - assigned_total) / missing_count, 0)
      ELSE 0
    END;

    UPDATE public.lowboy_containers
    SET status = 'vendido',
        sale_net_price = COALESCE(sale_net_price, fallback_price)
    WHERE sale_id = NEW.id AND status = 'reservado';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_lowboy_container_to_sale(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_lowboy_sale_with_containers(uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sell_lowboy_container(uuid, uuid, numeric, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lowboy_sale_with_containers(uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sell_lowboy_container(uuid, uuid, numeric, uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_lowboy_container_to_sale(uuid, uuid, numeric) IS
  'Única vía interna para asociar un contenedor: reserva en confirmada y vende desde ejecutada.';
COMMENT ON FUNCTION public.save_lowboy_sale_with_containers(uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid) IS
  'Crea o edita una venta y sincroniza atómicamente su selección completa de contenedores.';
COMMENT ON FUNCTION public.release_lowboy_sale_containers() IS
  'Sincroniza contenedores al ejecutar, cancelar o eliminar una venta; es la única vía para transiciones posteriores.';

COMMIT;
