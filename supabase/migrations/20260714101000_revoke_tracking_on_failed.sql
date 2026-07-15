BEGIN;

-- Bloque 4b de la consolidación. El seguimiento existe solo durante la fase
-- operacional del rescate. 'failed' es un estado final operacional (el servicio
-- terminó sin éxito) igual que completed/cancelled, así que debe revocar los
-- links de seguimiento vigentes. Antes solo revocaba completed/cancelled, y un
-- link sobre un servicio fallido seguía exponiendo posición.
CREATE OR REPLACE FUNCTION public.revoke_tracking_links_on_service_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled', 'failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.service_tracking_links
    SET revoked_at = now()
    WHERE service_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Función de trigger SECURITY DEFINER: nunca invocable via RPC público
-- (patrón de 20260712020000_lock_down_revoke_trigger_function.sql). CREATE OR
-- REPLACE conserva privilegios, se re-aplica por consistencia.
REVOKE ALL ON FUNCTION public.revoke_tracking_links_on_service_close() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_tracking_links_on_service_close() FROM anon;
REVOKE ALL ON FUNCTION public.revoke_tracking_links_on_service_close() FROM authenticated;

-- Revocar links de servicios que ya estén en 'failed' y aún tengan links vivos
-- (idempotente).
UPDATE public.service_tracking_links l
SET revoked_at = now()
FROM public.services s
WHERE l.service_id = s.id
  AND s.status = 'failed'
  AND l.revoked_at IS NULL;

COMMIT;
