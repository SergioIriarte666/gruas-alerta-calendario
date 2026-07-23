-- Sincronización automática de folio: services.folio → costs.service_folio
-- Problema: costs.service_folio es un snapshot escrito al crear el costo/comisión
-- y nunca se actualizaba cuando el folio del servicio cambiaba (ej: PENDIENTE_XX
-- que luego recibe folio real del cliente). Comisiones y Costos mostraban el folio viejo.
-- Los datos históricos ya fueron sincronizados manualmente; este trigger es el fix estructural.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_service_folio_to_costs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.folio IS DISTINCT FROM OLD.folio THEN
    -- Bypass del guard prevent_non_admin_updates_on_paid_costs
    -- (misma convención app.sync_in_progress que la sincronización existente)
    PERFORM set_config('app.sync_in_progress', 'true', true);

    UPDATE public.costs
    SET service_folio = NEW.folio,
        updated_at = now()
    WHERE service_id = NEW.id
      AND service_folio IS DISTINCT FROM NEW.folio;

    PERFORM set_config('app.sync_in_progress', 'false', true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_service_folio_to_costs ON public.services;
CREATE TRIGGER trg_sync_service_folio_to_costs
AFTER UPDATE OF folio ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.sync_service_folio_to_costs();

COMMIT;
