-- Castigo formal de servicios incobrables: columnas, RPCs y guarda de tracking.
--
-- Reglas que quedan:
--   * Castigar es una vía única (write_off_service), solo admin, con motivo
--     obligatorio y solo desde 'completed'. Un servicio vinculado a factura o a
--     cierre NO se castiga: primero se desvincula, porque el castigo declara
--     que nunca se cobró y un vínculo vivo dice lo contrario.
--   * Revertir es también vía única (revert_write_off), solo admin, y devuelve
--     el servicio a 'completed' limpiando los campos del castigo.
--   * Las dos escriben en audit_log con el row completo antes y después.
--
-- El UPDATE directo sobre services.status sigue existiendo (herramientas de
-- admin), pero ninguna pantalla lo usa para castigar: el motivo y la traza solo
-- los garantiza el RPC.

BEGIN;

-- ---------------------------------------------------------------------------
-- (a) Columnas del castigo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS written_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS written_off_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS written_off_reason text;

COMMENT ON COLUMN public.services.written_off_at IS
  'Momento del castigo formal (write_off_service). NULL = nunca castigado.';
COMMENT ON COLUMN public.services.written_off_by IS
  'Admin que castigó el servicio. Lo escribe solo write_off_service.';
COMMENT ON COLUMN public.services.written_off_reason IS
  'Motivo del castigo. Obligatorio: sin motivo el RPC rechaza.';

-- ---------------------------------------------------------------------------
-- (b) write_off_service: la única vía de castigo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_off_service(p_service_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old         jsonb;
  v_new         jsonb;
  v_status      text;
  v_reason      text;
  v_invoices    integer;
  v_closures    integer;
BEGIN
  -- auth.uid() NULL (crons, service_role) NO es admin: el castigo es un acto
  -- humano con nombre y apellido, nunca un efecto de fondo.
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede castigar un servicio.'
      USING ERRCODE = '42501';
  END IF;

  v_reason := btrim(COALESCE(p_reason, ''));
  IF v_reason = '' THEN
    RAISE EXCEPTION 'El motivo del castigo es obligatorio.'
      USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(s), s.status::text
    INTO v_old, v_status
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'El servicio % no existe.', p_service_id
      USING ERRCODE = '22023';
  END IF;

  IF v_status = 'written_off' THEN
    RAISE EXCEPTION 'El servicio ya está castigado.'
      USING ERRCODE = '22023';
  END IF;

  IF v_status <> 'completed' THEN
    RAISE EXCEPTION 'Solo se puede castigar un servicio completado (estado actual: %).', v_status
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_invoices
  FROM public.invoice_services
  WHERE service_id = p_service_id;

  SELECT count(*) INTO v_closures
  FROM public.closure_services
  WHERE service_id = p_service_id;

  IF v_invoices > 0 OR v_closures > 0 THEN
    RAISE EXCEPTION 'El servicio está vinculado a % factura(s) y % cierre(s): desvincúlalo antes de castigarlo.', v_invoices, v_closures
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.services
  SET status             = 'written_off',
      written_off_at     = now(),
      written_off_by     = auth.uid(),
      written_off_reason = v_reason
  WHERE id = p_service_id;

  SELECT to_jsonb(s) INTO v_new
  FROM public.services s
  WHERE s.id = p_service_id;

  INSERT INTO public.audit_log (user_id, operation, table_name, old_data, new_data)
  VALUES (auth.uid(), 'WRITE_OFF', 'services', v_old, v_new);
END;
$function$;

-- ---------------------------------------------------------------------------
-- (c) revert_write_off: deshacer el castigo, también auditado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revert_write_off(p_service_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old    jsonb;
  v_new    jsonb;
  v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede revertir un castigo.'
      USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s), s.status::text
    INTO v_old, v_status
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'El servicio % no existe.', p_service_id
      USING ERRCODE = '22023';
  END IF;

  IF v_status <> 'written_off' THEN
    RAISE EXCEPTION 'El servicio no está castigado (estado actual: %).', v_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.services
  SET status             = 'completed',
      written_off_at     = NULL,
      written_off_by     = NULL,
      written_off_reason = NULL
  WHERE id = p_service_id;

  SELECT to_jsonb(s) INTO v_new
  FROM public.services s
  WHERE s.id = p_service_id;

  INSERT INTO public.audit_log (user_id, operation, table_name, old_data, new_data)
  VALUES (auth.uid(), 'WRITE_OFF_REVERT', 'services', v_old, v_new);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.write_off_service(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_write_off(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (d) Ningún estado final pare un token de tracking.
--
-- El castigo es terminal: el servicio ya no admite seguimiento en vivo. Las dos
-- listas que deciden esto son las mismas de siempre (20260731120000) y tienen
-- que decir lo mismo que FINAL_SERVICE_STATUSES del front.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_tracking_link_on_closed_service()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT s.status INTO v_status
  FROM public.services s
  WHERE s.id = NEW.service_id;

  IF v_status IN ('completed', 'cancelled', 'failed', 'invoiced', 'partially_invoiced', 'written_off') THEN
    RAISE EXCEPTION 'No se puede crear un link de seguimiento sobre un servicio en estado final (%)', v_status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_tracking_token(p_service_id uuid, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_existing_token text;
  v_token text;
  v_status text;
BEGIN
  -- Lo primero, antes incluso de validar coordenadas: un servicio cerrado no
  -- tiene seguimiento que entregar. Si quedara un link vivo sobre él es
  -- justamente el fantasma que este cambio persigue, así que tampoco se
  -- devuelve.
  SELECT s.status INTO v_status
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_status IN ('completed', 'cancelled', 'failed', 'invoiced', 'partially_invoiced', 'written_off') THEN
    RETURN NULL;
  END IF;

  PERFORM public.assert_tracking_service_coordinates(p_service_id);

  SELECT token INTO v_existing_token
  FROM public.service_tracking_links
  WHERE service_id = p_service_id
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_token IS NOT NULL THEN
    RETURN v_existing_token;
  END IF;

  LOOP
    v_token := substr(
      regexp_replace(encode(gen_random_bytes(16), 'base64'), '[^a-zA-Z0-9]', '', 'g'),
      1, 16
    );

    BEGIN
      INSERT INTO public.service_tracking_links (service_id, created_by, token)
      VALUES (p_service_id, p_created_by, v_token);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Colisión extremadamente improbable: generar otro token.
    END;
  END LOOP;

  RETURN v_token;
END;
$function$;

COMMIT;
