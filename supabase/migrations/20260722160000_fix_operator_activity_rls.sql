BEGIN;

-- get_operator_id_by_user(uuid) fue correctamente restringida por la migración de
-- seguridad, ya que permitiría consultar el vínculo de cualquier usuario. Para RLS
-- exponemos en cambio una función sin parámetros que sólo resuelve la sesión actual.
CREATE OR REPLACE FUNCTION public.current_operator_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT operator.id
  FROM public.operators operator
  WHERE operator.user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_operator_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_operator_id() TO authenticated, service_role;

DROP POLICY IF EXISTS "Operators read own activity" ON public.operator_activity_events;
CREATE POLICY "Operators read own activity"
  ON public.operator_activity_events
  FOR SELECT
  TO authenticated
  USING (
    operator_id = (SELECT public.current_operator_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "Operators mark own activity as read" ON public.operator_activity_events;
CREATE POLICY "Operators mark own activity as read"
  ON public.operator_activity_events
  FOR UPDATE
  TO authenticated
  USING (operator_id = (SELECT public.current_operator_id()))
  WITH CHECK (operator_id = (SELECT public.current_operator_id()));

COMMIT;
