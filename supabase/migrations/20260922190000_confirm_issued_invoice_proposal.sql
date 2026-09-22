-- The simplified screen confirms the proposed OC/services once for the selected
-- invoices. Preserve the stale-draft check and registration's full validation.
CREATE OR REPLACE FUNCTION public.confirm_and_register_issued_invoice(
  p_document_id uuid, p_expected_draft jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE doc public.issued_invoice_imports; confirmed jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user_safe() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO doc FROM public.issued_invoice_imports WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento no encontrado'; END IF;
  IF doc.result IS NOT NULL THEN RETURN public.register_issued_invoice(p_document_id, p_expected_draft); END IF;
  IF doc.draft IS DISTINCT FROM p_expected_draft THEN RAISE EXCEPTION 'La propuesta cambió en otra sesión. Recarga y revisa antes de confirmar'; END IF;
  confirmed := jsonb_set(doc.draft, '{reviewed}', 'true'::jsonb);
  UPDATE public.issued_invoice_imports SET draft = confirmed, updated_at = now() WHERE id = p_document_id;
  RETURN public.register_issued_invoice(p_document_id, confirmed);
END $$;
REVOKE ALL ON FUNCTION public.confirm_and_register_issued_invoice(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_and_register_issued_invoice(uuid,jsonb) TO authenticated;
