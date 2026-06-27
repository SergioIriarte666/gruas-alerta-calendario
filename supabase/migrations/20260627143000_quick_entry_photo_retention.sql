-- Limpieza automática de fotos de Entradas Rápidas.
-- Regla operativa:
-- - solo limpiar entradas ya cerradas (completed/discarded)
-- - conservar pending para no romper trabajo aún no procesado
-- - borrar archivos del bucket quick-entry-photos a los 15 días
-- - limpiar referencias en quick_entries para evitar URLs muertas

CREATE OR REPLACE FUNCTION public.extract_quick_entry_photo_path(raw_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  value text := nullif(btrim(raw_value), '');
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  IF value LIKE '%/object/sign/quick-entry-photos/%' THEN
    RETURN NULLIF(split_part(value, '/object/sign/quick-entry-photos/', 2), '');
  END IF;

  IF value LIKE '%/object/public/quick-entry-photos/%' THEN
    RETURN NULLIF(split_part(value, '/object/public/quick-entry-photos/', 2), '');
  END IF;

  RETURN value;
END;
$$;

COMMENT ON FUNCTION public.extract_quick_entry_photo_path(text) IS
'Extrae el path interno del bucket quick-entry-photos desde un path crudo o una signed/public URL.';

CREATE OR REPLACE FUNCTION public.cleanup_expired_quick_entry_photos(
  p_retention interval DEFAULT interval '15 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
DECLARE
  v_cutoff timestamptz := now() - p_retention;
  v_entries_updated integer := 0;
  v_storage_deleted integer := 0;
BEGIN
  CREATE TEMP TABLE tmp_quick_entry_photo_targets (
    entry_id uuid NOT NULL,
    path text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_quick_entry_photo_targets (entry_id, path)
  SELECT DISTINCT
    qe.id,
    candidate.path
  FROM public.quick_entries qe
  CROSS JOIN LATERAL (
    SELECT public.extract_quick_entry_photo_path(photo_item->>'path') AS path
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(qe.data, '{}'::jsonb)->'photos') = 'array'
          THEN COALESCE(qe.data, '{}'::jsonb)->'photos'
        ELSE '[]'::jsonb
      END
    ) AS photo_item

    UNION ALL

    SELECT public.extract_quick_entry_photo_path(qe.photo_url) AS path
  ) AS candidate
  WHERE qe.status IN ('completed', 'discarded')
    AND qe.created_at < v_cutoff
    AND candidate.path IS NOT NULL
    AND candidate.path <> '';

  DELETE FROM storage.objects so
  USING (
    SELECT DISTINCT path
    FROM tmp_quick_entry_photo_targets
  ) targets
  WHERE so.bucket_id = 'quick-entry-photos'
    AND so.name = targets.path;

  GET DIAGNOSTICS v_storage_deleted = ROW_COUNT;

  UPDATE public.quick_entries qe
  SET
    photo_url = NULL,
    data = CASE
      WHEN qe.data IS NULL THEN '{}'::jsonb
      ELSE qe.data - 'photos'
    END,
    updated_at = now()
  WHERE qe.id IN (
    SELECT DISTINCT entry_id
    FROM tmp_quick_entry_photo_targets
  );

  GET DIAGNOSTICS v_entries_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff', v_cutoff,
    'retention_days', extract(day from p_retention),
    'storage_objects_deleted', v_storage_deleted,
    'quick_entries_updated', v_entries_updated
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_quick_entry_photos(interval) IS
'Borra archivos del bucket quick-entry-photos para quick_entries cerradas con más de 15 días y limpia sus referencias en quick_entries.';

REVOKE ALL ON FUNCTION public.extract_quick_entry_photo_path(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_quick_entry_photos(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extract_quick_entry_photo_path(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_quick_entry_photos(interval) TO service_role;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup-expired-quick-entry-photos-daily'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'cleanup-expired-quick-entry-photos-daily',
    '40 3 * * *',
    $cron$
      SELECT public.cleanup_expired_quick_entry_photos(interval '15 days');
    $cron$
  );
END $$;
