BEGIN;

-- Ajuste comercial del flete como campo único de la venta (antes se registraba como
-- una "línea de vehículo" extra solo con nota + monto). El motivo del ajuste se
-- escribe en las notas de la venta. La columna notes de lowboy_sale_vehicles NO se
-- elimina: queda disponible a nivel de datos (p.ej. nº de serie de maquinaria).
ALTER TABLE public.lowboy_sales
  ADD COLUMN IF NOT EXISTS flete_adjustment bigint NULL;

COMMENT ON COLUMN public.lowboy_sales.flete_adjustment IS
  'Ajuste comercial del flete en CLP (+recargo/−descuento). El motivo se registra en las notas de la venta. NULL = sin ajuste.';

-- El RPC gana un parámetro nuevo (p_flete_adjustment) al final de la firma, por lo que
-- se elimina primero la versión anterior de 15 argumentos para no crear una sobrecarga
-- ambigua que confunda a PostgREST.
DROP FUNCTION IF EXISTS public.save_lowboy_sale_with_containers(
  uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid, jsonb
);

-- Reemplaza el RPC para:
--   1) validar el desglose del flete considerando el ajuste: si hay al menos una línea
--      con valor O un ajuste distinto de 0, el neto guardado debe ser exactamente
--      (suma de valores + ajuste) y ese resultado no puede quedar negativo;
--   2) persistir flete_adjustment en la venta (NULL cuando es 0/ausente);
--   3) sincronizar atómicamente los vehículos (sin cambios respecto de antes).
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
  p_rcv_record_id uuid DEFAULT NULL,
  p_vehicles jsonb DEFAULT '[]'::jsonb,
  p_flete_adjustment bigint DEFAULT NULL
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
  v_valued_count integer := 0;
  v_value_sum bigint := 0;
  v_adjustment bigint := COALESCE(p_flete_adjustment, 0);
  v_expected_net bigint := 0;
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
  IF jsonb_typeof(COALESCE(p_vehicles, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'La lista de vehículos debe ser un arreglo';
  END IF;
  IF p_sale_type <> 'flete' AND jsonb_array_length(COALESCE(p_vehicles, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Solo las ventas de flete pueden registrar vehículos';
  END IF;
  IF p_sale_type <> 'flete' AND v_adjustment <> 0 THEN
    RAISE EXCEPTION 'Solo las ventas de flete pueden llevar un ajuste comercial';
  END IF;

  -- Validación del desglose de flete: el neto = suma de los valores de servicio + el
  -- ajuste comercial (que puede ser negativo). Si hay al menos una línea con valor o un
  -- ajuste distinto de 0, el neto de la venta debe coincidir con ese cálculo y no puede
  -- quedar negativo.
  IF p_sale_type = 'flete' THEN
    SELECT
      COUNT(*) FILTER (WHERE NULLIF(BTRIM(elem->>'service_value'), '') IS NOT NULL),
      COALESCE(SUM((NULLIF(BTRIM(elem->>'service_value'), ''))::bigint), 0)
    INTO v_valued_count, v_value_sum
    FROM jsonb_array_elements(COALESCE(p_vehicles, '[]'::jsonb)) AS t(elem);

    IF v_valued_count > 0 OR v_adjustment <> 0 THEN
      v_expected_net := v_value_sum + v_adjustment;
      IF v_expected_net < 0 THEN
        RAISE EXCEPTION 'El neto no puede ser negativo: valores (%) + ajuste (%) = %', v_value_sum, v_adjustment, v_expected_net;
      END IF;
      IF p_net_amount <> v_expected_net THEN
        RAISE EXCEPTION 'El neto (%) debe coincidir con la suma del flete: valores (%) + ajuste (%) = %', p_net_amount, v_value_sum, v_adjustment, v_expected_net;
      END IF;
    END IF;
  END IF;

  IF p_sale_id IS NULL THEN
    INSERT INTO public.lowboy_sales (
      sale_type, client_rut, client_name, description, origin, destination,
      scheduled_date, executed_date, net_amount, status, notes, flete_adjustment, created_by
    ) VALUES (
      p_sale_type, BTRIM(p_client_rut), BTRIM(p_client_name), BTRIM(p_description),
      CASE WHEN p_sale_type = 'flete' THEN NULLIF(BTRIM(p_origin), '') ELSE NULL END,
      CASE WHEN p_sale_type = 'flete' THEN NULLIF(BTRIM(p_destination), '') ELSE NULL END,
      p_scheduled_date, p_executed_date, p_net_amount, p_status, NULLIF(BTRIM(p_notes), ''),
      CASE WHEN p_sale_type = 'flete' THEN NULLIF(v_adjustment, 0) ELSE NULL END,
      auth.uid()
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
        notes = NULLIF(BTRIM(p_notes), ''),
        flete_adjustment = CASE WHEN p_sale_type = 'flete' THEN NULLIF(v_adjustment, 0) ELSE NULL END
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

  -- Sincronización completa de vehículos del flete: se reemplaza la lista entera.
  -- Se conserva la fila si aporta patente/marca/modelo/nota o valor de servicio.
  DELETE FROM public.lowboy_sale_vehicles WHERE sale_id = saved_sale.id;

  INSERT INTO public.lowboy_sale_vehicles (sale_id, plate, make, model, notes, service_value, position)
  SELECT
    saved_sale.id,
    NULLIF(BTRIM(UPPER(elem->>'plate')), ''),
    NULLIF(BTRIM(elem->>'make'), ''),
    NULLIF(BTRIM(elem->>'model'), ''),
    NULLIF(BTRIM(elem->>'notes'), ''),
    (NULLIF(BTRIM(elem->>'service_value'), ''))::bigint,
    ord::integer
  FROM jsonb_array_elements(COALESCE(p_vehicles, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
  WHERE NULLIF(BTRIM(elem->>'plate'), '') IS NOT NULL
     OR NULLIF(BTRIM(elem->>'make'), '') IS NOT NULL
     OR NULLIF(BTRIM(elem->>'model'), '') IS NOT NULL
     OR NULLIF(BTRIM(elem->>'notes'), '') IS NOT NULL
     OR NULLIF(BTRIM(elem->>'service_value'), '') IS NOT NULL;

  IF p_rcv_record_id IS NOT NULL THEN
    PERFORM public.set_lowboy_rcv_sale_link(p_rcv_record_id, saved_sale.id, false);
  END IF;

  RETURN saved_sale.id;
END;
$$;

COMMENT ON FUNCTION public.save_lowboy_sale_with_containers(uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid, jsonb, bigint) IS
  'Crea o edita una venta y sincroniza atómicamente su selección de contenedores (producto) y su lista de vehículos trasladados (flete). El neto del flete debe coincidir con la suma de los valores de servicio más el ajuste comercial (flete_adjustment) cuando hay desglose.';

COMMIT;
