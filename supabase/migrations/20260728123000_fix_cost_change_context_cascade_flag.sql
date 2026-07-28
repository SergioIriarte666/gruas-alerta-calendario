-- Corrección de la migración 20260728120000, detectada al ensayarla contra la
-- base real: TODO borrado de costo quedaba etiquetado 'cascade_delete'.
--
-- Causa: app.cascade_delete no es una bandera de procedencia. La pone
-- sync_cost_deletion_cascade(), que es el propio BEFORE DELETE de costs, para
-- avisar a los guardas de las tablas hijas (pagos, bodega, repuestos) que ese
-- borrado viene en cascada desde el costo. Como corre ANTES del AFTER que
-- audita, la bandera ya estaba puesta para cualquier borrado y ganaba a todo lo
-- demás. Un origen que dice lo mismo para todos los casos no es un origen.
--
-- Queda como señal de procedencia lo que sí lo es: el contexto declarado por
-- quien hace el cambio (app.change_context, que fija delete_cost_with_context),
-- las banderas de sincronización, y la ausencia de sesión de usuario.

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_cost_change_context()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.change_context', true), ''),
    CASE
      WHEN current_setting('app.commission_autoflow', true) = 'true' THEN 'commission_sync'
      WHEN current_setting('app.sync_in_progress', true) = 'true' THEN 'sync'
      WHEN current_setting('app.bidirectional_sync', true) = 'true' THEN 'sync'
      WHEN auth.uid() IS NULL THEN 'system'
      ELSE 'sql'
    END
  );
$$;

COMMENT ON FUNCTION public.resolve_cost_change_context() IS
  'Origen del cambio para cost_change_history.change_context. app.cascade_delete queda fuera a propósito: la pone el propio BEFORE DELETE de costs y no distingue nada.';

COMMIT;
