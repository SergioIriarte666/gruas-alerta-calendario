BEGIN;

-- Apple exige que la eliminación iniciada dentro de la app sea definitiva.
-- Los dos campos siguientes conservan evidencia operativa, pero dejan de ser
-- obligatorios para que la identidad de acceso pueda eliminarse sin borrar el
-- registro comercial que la empresa debe mantener.
ALTER TABLE public.service_external_closures
  ALTER COLUMN admin_user_id DROP NOT NULL;

ALTER TABLE public.service_external_evidence
  ALTER COLUMN uploaded_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.delete_account_permanently(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  fk_record record;
  deleted_email text;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de cuenta requerido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Cuenta no encontrada';
  END IF;

  -- Historiales estrictamente personales que no deben conservarse.
  DELETE FROM public.user_activity_log WHERE user_id = target_user_id;
  DELETE FROM public.patent_search_history WHERE user_id = target_user_id;
  DELETE FROM public.user_settings WHERE user_id = target_user_id;
  DELETE FROM public.notification_settings WHERE user_id = target_user_id;
  DELETE FROM public.user_invitations WHERE user_id = target_user_id;

  -- La ficha laboral/operativa se conserva por separado, sin vínculo con la
  -- cuenta eliminada. Los servicios e inspecciones siguen siendo registros de
  -- la empresa y no credenciales personales del usuario.
  UPDATE public.operators
  SET user_id = NULL, updated_at = now()
  WHERE user_id = target_user_id;

  -- Desvincula referencias de auditoría que apuntan directamente a auth.users.
  -- Solo actúa sobre FK de una columna, nullable y sin regla de borrado. Los
  -- nombres provienen del catálogo de PostgreSQL y se escapan como identificadores.
  FOR fk_record IN
    SELECT
      source_namespace.nspname AS schema_name,
      source_table.relname AS table_name,
      source_column.attname AS column_name
    FROM pg_catalog.pg_constraint constraint_record
    JOIN pg_catalog.pg_class source_table
      ON source_table.oid = constraint_record.conrelid
    JOIN pg_catalog.pg_namespace source_namespace
      ON source_namespace.oid = source_table.relnamespace
    JOIN pg_catalog.pg_class target_table
      ON target_table.oid = constraint_record.confrelid
    JOIN pg_catalog.pg_namespace target_namespace
      ON target_namespace.oid = target_table.relnamespace
    JOIN pg_catalog.pg_attribute source_column
      ON source_column.attrelid = source_table.oid
      AND source_column.attnum = constraint_record.conkey[1]
    WHERE constraint_record.contype = 'f'
      AND target_namespace.nspname = 'auth'
      AND target_table.relname = 'users'
      AND source_namespace.nspname = 'public'
      AND array_length(constraint_record.conkey, 1) = 1
      AND constraint_record.confdeltype IN ('a', 'r')
      AND source_column.attnotnull = false
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
      fk_record.schema_name,
      fk_record.table_name,
      fk_record.column_name,
      fk_record.column_name
    ) USING target_user_id;
  END LOOP;

  -- Se preservan solamente referencias de negocio anónimas. Todos los datos
  -- identificables del perfil se reemplazan antes de eliminar auth.users.
  deleted_email := 'deleted+' || replace(target_user_id::text, '-', '') || '@deleted.invalid';

  UPDATE public.profiles
  SET
    email = deleted_email,
    full_name = 'Cuenta eliminada',
    avatar_url = NULL,
    phone = NULL,
    company = NULL,
    rut = NULL,
    client_id = NULL,
    role = 'viewer'::public.app_role,
    is_active = false,
    status = 'rejected',
    updated_at = now()
  WHERE id = target_user_id;

  -- Borrado duro: identities, sesiones, factores MFA y tablas con ON DELETE
  -- CASCADE se eliminan en la misma transacción. Cualquier FK no contemplada
  -- hace fallar y revierte la operación completa.
  DELETE FROM auth.users WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo eliminar la cuenta';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_permanently(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_account_permanently(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_account_permanently(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_permanently(uuid) TO service_role;

COMMENT ON FUNCTION public.delete_account_permanently(uuid) IS
  'Eliminación definitiva y atómica de una cuenta, invocable solo por service_role después de validar al usuario en Edge Function.';

COMMIT;
