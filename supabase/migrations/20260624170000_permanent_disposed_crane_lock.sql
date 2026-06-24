-- Las grúas vendidas o dadas de baja son terminales y quedan en modo solo lectura.
-- Se bloquea en base de datos para cubrir UI, API, importaciones y automatizaciones.

CREATE OR REPLACE FUNCTION public.prevent_disposed_crane_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.crane_status;
  v_plate text;
BEGIN
  -- Primero protege el registro histórico actual, incluso si intentan quitar o
  -- cambiar crane_id para eludir el bloqueo.
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.crane_id IS NOT NULL THEN
    SELECT status, license_plate
      INTO v_status, v_plate
    FROM public.cranes
    WHERE id = OLD.crane_id;

    IF v_status IN ('sold', 'written_off') THEN
      RAISE EXCEPTION 'La grúa % está % y tiene bloqueo permanente. No se permite % en %',
        v_plate,
        CASE v_status WHEN 'sold' THEN 'vendida' ELSE 'dada de baja' END,
        TG_OP,
        TG_TABLE_NAME
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Luego impide crear o reasignar registros hacia una grúa terminal.
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.crane_id IS NOT NULL THEN
    SELECT status, license_plate
      INTO v_status, v_plate
    FROM public.cranes
    WHERE id = NEW.crane_id;

    IF v_status IN ('sold', 'written_off') THEN
      RAISE EXCEPTION 'La grúa % está % y tiene bloqueo permanente. No se permite % en %',
        v_plate,
        CASE v_status WHEN 'sold' THEN 'vendida' ELSE 'dada de baja' END,
        TG_OP,
        TG_TABLE_NAME
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tbl
      ON tbl.table_schema = c.table_schema
     AND tbl.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'crane_id'
      AND c.table_name <> 'cranes'
      AND tbl.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_block_disposed_crane ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_block_disposed_crane
       BEFORE INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.prevent_disposed_crane_records()',
      t
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_disposed_crane_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('sold', 'written_off') THEN
    RAISE EXCEPTION 'La grúa % está % y tiene bloqueo permanente',
      OLD.license_plate,
      CASE OLD.status WHEN 'sold' THEN 'vendida' ELSE 'dada de baja' END
      USING ERRCODE = 'P0001';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_disposed_crane ON public.cranes;
CREATE TRIGGER trg_lock_disposed_crane
BEFORE UPDATE OR DELETE ON public.cranes
FOR EACH ROW EXECUTE FUNCTION public.prevent_disposed_crane_changes();
