-- Permite registrar snapshots de historial de costos desde el cliente
-- sin habilitar INSERT directo sobre cost_change_history.

CREATE OR REPLACE FUNCTION public.log_cost_snapshot_entry(
  p_cost_id uuid,
  p_field_name text,
  p_old_value text DEFAULT NULL,
  p_new_value text DEFAULT NULL,
  p_change_summary text DEFAULT NULL,
  p_change_context text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_history_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'operator'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to log cost snapshots';
  END IF;

  INSERT INTO public.cost_change_history (
    cost_id,
    changed_by,
    change_type,
    field_name,
    old_value,
    new_value,
    change_summary,
    change_context
  )
  VALUES (
    p_cost_id,
    v_user_id,
    'SNAPSHOT',
    p_field_name,
    p_old_value,
    p_new_value,
    p_change_summary,
    p_change_context
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_cost_snapshot_entry(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_cost_snapshot_entry(uuid, text, text, text, text, text) TO authenticated;
