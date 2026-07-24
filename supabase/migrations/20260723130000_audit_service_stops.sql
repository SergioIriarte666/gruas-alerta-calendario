BEGIN;

-- Auditoría de service_stops (incidente SRV-6853, 23/07): el recorrido de la
-- mañana fue reemplazado a las 12:55 y no quedó ningún rastro para el
-- diagnóstico. persistServiceStops() guarda por REEMPLAZO COMPLETO
-- (delete + insert, mismo patrón que service_items), así que sin auditoría el
-- itinerario anterior —incluidos armed_at/reached_at ya acumulados— desaparece
-- sin dejar huella.
--
-- Patrón: mismo destino (public.audit_log) y misma forma de trigger que
-- trg_audit_costs / trg_audit_supplier_payments. La diferencia con la función
-- genérica log_audit_changes() es deliberada: aquélla deja old_data en NULL en
-- los UPDATE, y aquí el valor diagnóstico está justo en el ANTES/DESPUÉS
-- (coordenadas movidas, orden reordenado, reached_at borrado).
CREATE OR REPLACE FUNCTION public.log_service_stops_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- UPDATE sin cambios reales (p. ej. un re-guardado idéntico) no ensucia el log.
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_log (user_id, operation, table_name, old_data, new_data)
  VALUES (
    -- NULL cuando escribe el edge function service-tracking con service role
    -- (armed_at / reached_at automáticos): "sistema" vs. una edición humana.
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_service_stops_audit() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_service_stops ON public.service_stops;
CREATE TRIGGER trg_audit_service_stops
  AFTER INSERT OR UPDATE OR DELETE ON public.service_stops
  FOR EACH ROW EXECUTE FUNCTION public.log_service_stops_audit();

COMMIT;
