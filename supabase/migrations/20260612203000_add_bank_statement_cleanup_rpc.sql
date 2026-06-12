CREATE OR REPLACE FUNCTION public.cleanup_bank_statement_imports(
  p_import_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_deleted_count integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF coalesce(array_length(p_import_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'deleted_imports', 0
    );
  END IF;

  DELETE FROM public.bank_statement_imports bsi
  WHERE bsi.id = ANY(p_import_ids)
    AND bsi.uploaded_by = v_user_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_imports', v_deleted_count
  );
END;
$$;

GRANT ALL ON FUNCTION public.cleanup_bank_statement_imports(uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_bank_statement_imports(uuid[]) TO service_role;
