BEGIN;

-- Índice único parcial: a lo más 1 inspección activa por servicio
-- (la tabla guarda inicial y entrega en el mismo row, por columnas separadas)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inspections_service
  ON public.inspections (service_id)
  WHERE deleted_at IS NULL;

-- Tabla de auditoría de PDFs huérfanos detectados por el cleanup
CREATE TABLE IF NOT EXISTS public.inspection_storage_orphans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  bucket_id text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  cleanup_attempted boolean NOT NULL DEFAULT false,
  cleanup_succeeded boolean,
  error_message text,
  resolved_at timestamptz
);

ALTER TABLE public.inspection_storage_orphans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inspection_storage_orphans'
      AND policyname = 'orphans_admin_read'
  ) THEN
    CREATE POLICY orphans_admin_read ON public.inspection_storage_orphans
      FOR SELECT TO authenticated USING ((SELECT public.is_admin_user_safe()));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inspection_storage_orphans'
      AND policyname = 'orphans_admin_write'
  ) THEN
    CREATE POLICY orphans_admin_write ON public.inspection_storage_orphans
      FOR ALL TO authenticated
      USING ((SELECT public.is_admin_user_safe()))
      WITH CHECK ((SELECT public.is_admin_user_safe()));
  END IF;
END;
$$;

COMMIT;
