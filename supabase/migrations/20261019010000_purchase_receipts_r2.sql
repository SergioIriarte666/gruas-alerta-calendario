BEGIN;

CREATE TABLE public.purchase_receipt_files (
  path text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  r2_bucket text NOT NULL CHECK (length(r2_bucket) > 0),
  r2_key text NOT NULL UNIQUE,
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  sha256 text NOT NULL CHECK (length(sha256) = 44),
  verified_at timestamptz NOT NULL DEFAULT now(),
  legacy_removed boolean NOT NULL DEFAULT false,
  CHECK (path = owner_id::text || '/manual-purchases/' || request_id::text || '.jpg'),
  CHECK (r2_key = 'purchase-receipts/' || path)
);
ALTER TABLE public.purchase_receipt_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_receipt_files FROM anon, authenticated;
GRANT SELECT ON public.purchase_receipt_files TO authenticated;
GRANT ALL ON public.purchase_receipt_files TO service_role;
CREATE POLICY purchase_receipt_files_read ON public.purchase_receipt_files FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE FUNCTION public.manual_purchase_receipt_exists(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.purchase_receipt_files WHERE path = p_path)
    OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'quick-entry-photos' AND name = p_path);
$$;
REVOKE ALL ON FUNCTION public.manual_purchase_receipt_exists(text) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_function regprocedure;
  v_source text;
  v_replacement text;
BEGIN
  FOREACH v_function IN ARRAY ARRAY['public.register_manual_inventory_purchase(uuid,jsonb,text)'::regprocedure, 'public.register_manual_cost_purchase(uuid,jsonb,text)'::regprocedure] LOOP
    v_source := pg_get_functiondef(v_function);
    v_replacement := replace(v_source,
      'NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = ''quick-entry-photos'' AND name = p_receipt_path)',
      'NOT public.manual_purchase_receipt_exists(p_receipt_path)');
    IF v_source = v_replacement THEN RAISE EXCEPTION 'No se encontró la validación esperada en %', v_function; END IF;
    EXECUTE v_replacement;
  END LOOP;
END;
$$;

CREATE FUNCTION public.list_purchase_receipts_for_r2(p_limit integer DEFAULT 5, p_after text DEFAULT '')
RETURNS TABLE(path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT candidate.path FROM (
    SELECT name AS path FROM storage.objects WHERE bucket_id = 'quick-entry-photos'
      AND name ~ '^[0-9a-f-]{36}/manual-purchases/[0-9a-f-]{36}\.jpg$'
    UNION
    SELECT path FROM public.purchase_receipt_files WHERE NOT legacy_removed
  ) AS candidate
  WHERE candidate.path > coalesce(p_after, '') ORDER BY candidate.path LIMIT least(greatest(p_limit, 1), 10);
$$;
REVOKE ALL ON FUNCTION public.list_purchase_receipts_for_r2(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_purchase_receipts_for_r2(integer, text) TO service_role;

CREATE POLICY manual_purchase_photos_use_r2_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'quick-entry-photos' OR name NOT LIKE '%/manual-purchases/%');
CREATE POLICY manual_purchase_photos_use_r2_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (bucket_id <> 'quick-entry-photos' OR name NOT LIKE '%/manual-purchases/%');

COMMIT;
