-- El historial GPS es del OPERADOR, no del servicio: sobrevive a su borrado.
--
-- Hallazgo de la limpieza del 25/07: al eliminar TEST-TRACK-01, las filas de
-- operator_location_points y operator_location_sessions con el service_id de
-- ese servicio no fueron tocadas por cascade_delete_service_data y hubo que
-- decidir a mano qué hacer con ellas.
--
-- La decisión de diseño es NO borrarlas. El módulo Ubicaciones usa esos puntos
-- sin servicio de por medio (recorrido del día, tiempos muertos, sesiones por
-- horario, y hay sesiones con service_id NULL desde siempre): borrar el
-- historial de ruta de un operador porque se eliminó un servicio administrativo
-- destruye evidencia que no le pertenece al servicio. Con ON DELETE SET NULL la
-- referencia muerta se limpia sola y el recorrido queda intacto.
--
-- Por eso NO se agrega el borrado a cascade_delete_service_data: su ausencia
-- ahí es intencional, y esta migración la deja escrita.
--
-- En producción ambas FK ya son SET NULL; esta migración las normaliza de forma
-- idempotente y solo reescribe la constraint si la regla difiere, para no
-- forzar el revalidado completo de operator_location_points (tabla grande) en
-- cada despliegue.

BEGIN;

DO $$
DECLARE
  v_spec record;
BEGIN
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('operator_location_points',   'operator_location_points_service_id_fkey'),
      ('operator_location_sessions', 'operator_location_sessions_service_id_fkey')
    ) AS t(table_name, constraint_name)
  LOOP
    -- confdeltype 'n' = ON DELETE SET NULL. Si ya lo es, no se toca.
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = v_spec.table_name
        AND c.conname = v_spec.constraint_name
        AND c.confdeltype = 'n'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      v_spec.table_name, v_spec.constraint_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (service_id) '
      || 'REFERENCES public.services(id) ON DELETE SET NULL',
      v_spec.table_name, v_spec.constraint_name
    );

    RAISE NOTICE 'FK % normalizada a ON DELETE SET NULL', v_spec.constraint_name;
  END LOOP;
END;
$$;

COMMENT ON COLUMN public.operator_location_points.service_id IS
  'Servicio al que se asoció el punto, si lo hubo. ON DELETE SET NULL: el punto es historial del OPERADOR y sobrevive al borrado del servicio (decisión del 26/07/2026).';

COMMENT ON COLUMN public.operator_location_sessions.service_id IS
  'Servicio al que se asoció la sesión, si lo hubo. ON DELETE SET NULL: la sesión es historial del OPERADOR y sobrevive al borrado del servicio (decisión del 26/07/2026).';

COMMIT;
