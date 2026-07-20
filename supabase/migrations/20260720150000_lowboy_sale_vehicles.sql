BEGIN;

-- Vehículos/maquinarias trasladados en ventas tipo "flete (equipo propio)" de
-- LowBoy Chile SpA. Tabla hija de lowboy_sales: un flete puede trasladar 0..N
-- vehículos (los datos son OPCIONALES; hay fletes de estructuras/contenedores sin
-- vehículo). Estos vehículos son carga transportada, NO flota propia: no se
-- sincronizan con cranes/vehículos operativos de G5N ni con inventory_*.
CREATE TABLE IF NOT EXISTS public.lowboy_sale_vehicles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    uuid NOT NULL REFERENCES public.lowboy_sales(id) ON DELETE CASCADE,
  plate      text,                          -- patente normalizada en mayúsculas; NULL para maquinaria sin patente
  make       text,                          -- marca (texto libre)
  model      text,                          -- modelo (texto libre)
  notes      text,
  position   integer NOT NULL DEFAULT 1,    -- orden de despliegue
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lowboy_sale_vehicles IS
  'Vehículos/maquinarias trasladados en ventas tipo flete de LowBoy Chile SpA. Opcional: un flete puede no tener vehículos.';

CREATE INDEX IF NOT EXISTS idx_lowboy_sale_vehicles_sale ON public.lowboy_sale_vehicles(sale_id);

ALTER TABLE public.lowboy_sale_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS: mismo patrón que lowboy_sales / lowboy_containers (escritura solo admin,
-- lectura para viewer).
DROP POLICY IF EXISTS lowboy_sale_vehicles_admin_all ON public.lowboy_sale_vehicles;
CREATE POLICY lowboy_sale_vehicles_admin_all
  ON public.lowboy_sale_vehicles
  FOR ALL
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

DROP POLICY IF EXISTS lowboy_sale_vehicles_viewer_select ON public.lowboy_sale_vehicles;
CREATE POLICY lowboy_sale_vehicles_viewer_select
  ON public.lowboy_sale_vehicles
  FOR SELECT
  USING (public.get_current_user_role_safe() = 'viewer'::public.app_role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lowboy_sale_vehicles TO authenticated;
GRANT ALL ON public.lowboy_sale_vehicles TO service_role;

-- Extiende save_lowboy_sale_with_containers para sincronizar atómicamente los
-- vehículos del flete (delete-all + insert, mismo criterio que la selección de
-- contenedores). Al ir dentro de la misma transacción del RPC, un fallo al
-- guardar vehículos revierte también la venta: no quedan registros huérfanos.
DROP FUNCTION IF EXISTS public.save_lowboy_sale_with_containers(
  uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid);

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
  p_vehicles jsonb DEFAULT '[]'::jsonb
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
  IF jsonb_typeof(COALESCE(p_vehicles, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'La lista de vehículos debe ser un arreglo';
  END IF;
  IF p_sale_type <> 'flete' AND jsonb_array_length(COALESCE(p_vehicles, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Solo las ventas de flete pueden registrar vehículos';
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

  -- Sincronización completa de vehículos del flete: se reemplaza la lista entera.
  -- Filas totalmente vacías se descartan (no aportan patente/marca/modelo/nota).
  DELETE FROM public.lowboy_sale_vehicles WHERE sale_id = saved_sale.id;

  INSERT INTO public.lowboy_sale_vehicles (sale_id, plate, make, model, notes, position)
  SELECT
    saved_sale.id,
    NULLIF(BTRIM(UPPER(elem->>'plate')), ''),
    NULLIF(BTRIM(elem->>'make'), ''),
    NULLIF(BTRIM(elem->>'model'), ''),
    NULLIF(BTRIM(elem->>'notes'), ''),
    ord::integer
  FROM jsonb_array_elements(COALESCE(p_vehicles, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
  WHERE NULLIF(BTRIM(elem->>'plate'), '') IS NOT NULL
     OR NULLIF(BTRIM(elem->>'make'), '') IS NOT NULL
     OR NULLIF(BTRIM(elem->>'model'), '') IS NOT NULL
     OR NULLIF(BTRIM(elem->>'notes'), '') IS NOT NULL;

  IF p_rcv_record_id IS NOT NULL THEN
    PERFORM public.set_lowboy_rcv_sale_link(p_rcv_record_id, saved_sale.id, false);
  END IF;

  RETURN saved_sale.id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_lowboy_sale_with_containers(uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lowboy_sale_with_containers(uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.save_lowboy_sale_with_containers(uuid, text, text, text, text, text, text, date, date, numeric, text, text, jsonb, uuid, jsonb) IS
  'Crea o edita una venta y sincroniza atómicamente su selección de contenedores (producto) y su lista de vehículos trasladados (flete).';

COMMIT;
