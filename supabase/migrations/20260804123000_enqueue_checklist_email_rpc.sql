-- Encolado y consulta del correo de checklist desde la app.
--
-- POR QUÉ UN RPC Y NO UN INSERT DIRECTO: `notification_outbox` tiene RLS activa
-- con UNA sola política —"Admins can view notification outbox", solo SELECT— y
-- ninguna de INSERT. Hoy las filas las encolan triggers y funciones SECURITY
-- DEFINER, nunca el cliente. Un operador que intentara insertar desde el portal
-- rebotaría con "new row violates row-level security policy", y darle una
-- política de INSERT sobre la cola de notificaciones sería abrirle la puerta a
-- encolar cualquier kind hacia cualquier servicio.
--
-- Estas dos funciones son la superficie mínima: el operador solo puede encolar
-- el correo de SU checklist y solo puede leer el estado de ese envío.
--
-- Tampoco es un trigger sobre `checklists`: quién y cuándo se encola lo decide la
-- app (al firmar, o con el botón de reenvío), que es justamente lo que un trigger
-- quitaría de las manos.

BEGIN;

-- ── Estado del último envío, para el badge de la UI ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_checklist_email_status(p_checklist_id uuid)
RETURNS TABLE (status text, last_error text, created_at timestamptz, processed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.status, o.last_error, o.created_at, o.processed_at
  FROM public.notification_outbox o
  JOIN public.checklists c ON c.id = o.checklist_id
  WHERE o.checklist_id = p_checklist_id
    AND o.kind = 'checklist_email'
    -- Misma regla que las políticas de `checklists`: el operador ve lo suyo,
    -- el admin ve todo.
    AND (
      public.is_admin_user_safe()
      OR EXISTS (
        SELECT 1 FROM public.operators op
        WHERE op.id = c.operator_id AND op.user_id = auth.uid()
      )
    )
  ORDER BY o.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_checklist_email_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checklist_email_status(uuid) TO authenticated;

-- ── Encolado idempotente ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_checklist_email(p_checklist_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_checklist public.checklists%ROWTYPE;
  v_allowed   boolean;
  v_existing  uuid;
BEGIN
  SELECT * INTO v_checklist FROM public.checklists WHERE id = p_checklist_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  SELECT public.is_admin_user_safe()
      OR EXISTS (
        SELECT 1 FROM public.operators op
        WHERE op.id = v_checklist.operator_id AND op.user_id = auth.uid()
      )
    INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'No autorizado para encolar el correo de este checklist'
      USING ERRCODE = '42501';
  END IF;

  -- Un borrador no se envía: el correo respalda un documento firmado.
  IF v_checklist.status NOT IN ('signed', 'sent') THEN
    RETURN 'not_signed';
  END IF;

  -- Sin PDF no hay nada que adjuntar. No es un error: se reintenta cuando el
  -- PDF exista.
  IF v_checklist.pdf_url IS NULL THEN
    RETURN 'pdf_missing';
  END IF;

  -- IDEMPOTENCIA: si ya hay un envío en vuelo no se encola otro. Va en la base y
  -- no en el cliente para que dos toques seguidos no metan dos filas.
  SELECT id INTO v_existing
  FROM public.notification_outbox
  WHERE checklist_id = p_checklist_id
    AND kind = 'checklist_email'
    AND status IN ('pending', 'processing')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN 'already_queued';
  END IF;

  INSERT INTO public.notification_outbox (kind, service_id, checklist_id, payload, status)
  VALUES (
    'checklist_email',
    NULL,
    p_checklist_id,
    jsonb_build_object(
      'template_id', v_checklist.template_id,
      'performed_date', v_checklist.performed_date
    ),
    'pending'
  );

  RETURN 'queued';
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_checklist_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_checklist_email(uuid) TO authenticated;

COMMIT;
