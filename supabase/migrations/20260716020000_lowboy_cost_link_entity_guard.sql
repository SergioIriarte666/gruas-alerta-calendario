BEGIN;

-- Elimina cualquier vínculo histórico incompatible antes de activar la guarda.
UPDATE public.sii_rcv_records AS record
SET linked_cost_id = NULL
FROM public.costs AS cost
WHERE record.linked_cost_id = cost.id
  AND cost.entity <> 'lowboy';

CREATE OR REPLACE FUNCTION public.validate_lowboy_rcv_cost_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  linked_entity text;
BEGIN
  IF NEW.linked_cost_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT entity INTO linked_entity
  FROM public.costs
  WHERE id = NEW.linked_cost_id;

  IF linked_entity IS NULL THEN
    RAISE EXCEPTION 'El costo seleccionado no existe';
  END IF;
  IF linked_entity <> 'lowboy' THEN
    RAISE EXCEPTION 'Una compra LowBoy solo puede vincularse a costos de LowBoy';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lowboy_rcv_cost_link ON public.sii_rcv_records;
CREATE TRIGGER trg_validate_lowboy_rcv_cost_link
  BEFORE INSERT OR UPDATE OF linked_cost_id ON public.sii_rcv_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lowboy_rcv_cost_link();

CREATE OR REPLACE FUNCTION public.set_lowboy_rcv_cost_link(
  p_record_id uuid,
  p_cost_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_record public.sii_rcv_records%ROWTYPE;
  target_cost public.costs%ROWTYPE;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede vincular compras LowBoy';
  END IF;

  SELECT * INTO target_record
  FROM public.sii_rcv_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF target_record.id IS NULL THEN
    RAISE EXCEPTION 'El documento RCV seleccionado no existe';
  END IF;
  IF target_record.book_type <> 'compra' THEN
    RAISE EXCEPTION 'Solo los documentos de compra pueden vincularse a costos';
  END IF;

  IF p_cost_id IS NULL THEN
    UPDATE public.sii_rcv_records SET linked_cost_id = NULL WHERE id = p_record_id;
    RETURN;
  END IF;

  SELECT * INTO target_cost
  FROM public.costs
  WHERE id = p_cost_id
  FOR UPDATE;

  IF target_cost.id IS NULL THEN
    RAISE EXCEPTION 'El costo seleccionado no existe';
  END IF;
  IF target_cost.entity <> 'lowboy' THEN
    RAISE EXCEPTION 'Una compra LowBoy solo puede vincularse a costos de LowBoy';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.sii_rcv_records
    WHERE linked_cost_id = p_cost_id
      AND id <> p_record_id
  ) THEN
    RAISE EXCEPTION 'El costo seleccionado ya está vinculado a otro documento RCV';
  END IF;

  UPDATE public.sii_rcv_records
  SET linked_cost_id = p_cost_id
  WHERE id = p_record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_lowboy_rcv_cost_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lowboy_rcv_cost_link(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lowboy_rcv_cost_link(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_lowboy_rcv_cost_link(uuid, uuid) IS
  'Vincula una compra RCV LowBoy exclusivamente con un costo entity=lowboy.';

COMMIT;
