-- El PIN es un dato de control sobre el operador, no del operador.
--
-- set_operator_pin y clear_operator_pin ya exigen rol admin (ronda 1). Faltaba
-- cerrar la consulta: operator_has_pin respondía sobre CUALQUIER operador a
-- cualquier usuario autenticado, y esa respuesta —"este operador no tiene PIN"—
-- es justamente la que dice dónde el corte de transmisión no está protegido.
--
-- Ahora responde solo sobre el propio operador o para un admin. Devuelve false
-- en vez de lanzar: la UI del operador la usa para decidir si pedir el PIN, y
-- un error ahí lo dejaría sin poder cortar en terreno.

BEGIN;

CREATE OR REPLACE FUNCTION public.operator_has_pin(p_operator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.operator_pins p
    JOIN public.operators o ON o.id = p.operator_id
    WHERE p.operator_id = p_operator_id
      AND (
        o.user_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      )
  );
$$;

COMMENT ON FUNCTION public.operator_has_pin(uuid) IS
  'Indica si el operador tiene PIN configurado. Solo responde sobre el propio operador o para un admin: saber qué operador no tiene PIN es saber a quién no se le puede atribuir un corte.';

REVOKE ALL ON FUNCTION public.operator_has_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operator_has_pin(uuid) TO authenticated;

COMMIT;
