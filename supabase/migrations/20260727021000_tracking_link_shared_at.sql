-- "Hay un cliente mirando" deja de ser "existe un token".
--
-- El control de transmisión ahora pide el token POR ADELANTADO, apenas hay
-- servicio, para poder llamar a navigator.share dentro del gesto (el share del
-- 26/07 a las 14:13 murió con NotAllowedError porque la llamada de red iba
-- primero y la activación transitoria expiraba). Efecto colateral: si "link
-- vigente" siguiera significando "existe una fila", TODO servicio tendría uno
-- desde el primer render, la insignia del ojo mentiría —"el cliente puede ver
-- tu recorrido" sin que nadie tenga el link— y el corte pediría PIN siempre.
--
-- El hecho que importa es que el link haya SALIDO hacia el cliente:
--   · shared_at: el operador lo compartió o lo copió (lo escribe la app).
--   · access_count > 0: alguien lo abrió (lo escribe service-tracking).
-- Con cualquiera de los dos hay un cliente que puede estar mirando la pantalla,
-- y el corte manual pasa a exigir PIN.
--
-- Sin backfill a propósito: los links ya entregados quedan cubiertos por la
-- rama access_count > 0.

BEGIN;

ALTER TABLE public.service_tracking_links
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

COMMENT ON COLUMN public.service_tracking_links.shared_at IS
  'Momento en que el operador entregó el link (share nativo o copia al portapapeles). Distingue un token pre-creado por la app de uno que efectivamente salió hacia el cliente.';

/** ¿Hay link de cliente vigente Y entregado? Alimenta la insignia de ojo del
 * control de transmisión y el gate del PIN al cortar. */
CREATE OR REPLACE FUNCTION public.service_has_active_tracking_link(p_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_tracking_links l
    WHERE l.service_id = p_service_id
      AND l.revoked_at IS NULL
      AND l.expires_at > now()
      AND (l.shared_at IS NOT NULL OR COALESCE(l.access_count, 0) > 0)
  );
$$;

COMMENT ON FUNCTION public.service_has_active_tracking_link(uuid) IS
  'true cuando el servicio tiene un link de seguimiento vigente que YA salió hacia el cliente (compartido o abierto). Un token pre-creado y nunca entregado no cuenta.';

/**
 * Marca el link vigente del servicio como entregado.
 *
 * Autoriza por ASIGNACIÓN, igual que get_operator_service_tracking_token: quien
 * puede compartir el link es quien puede declarar que lo compartió. Idempotente
 * y sin retroceso: el primer envío es el que vale.
 */
CREATE OR REPLACE FUNCTION public.mark_service_tracking_link_shared(p_service_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF NOT public.is_operator_assigned_to_service(p_service_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo el operador asignado puede compartir el seguimiento de este servicio'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.service_tracking_links
  SET shared_at = now()
  WHERE service_id = p_service_id
    AND revoked_at IS NULL
    AND expires_at > now()
    AND shared_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_service_tracking_link_shared(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_service_tracking_link_shared(uuid) TO authenticated;

COMMIT;
