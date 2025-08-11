-- SOLUCIÓN GLOBAL CORREGIDA: Sistema de Consistencia de Estados de Facturación
-- Fase 1: Función para corrección masiva de datos inconsistentes

CREATE OR REPLACE FUNCTION public.fix_all_invoiced_services_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fixed_count INTEGER := 0;
  total_inconsistent INTEGER := 0;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de corrección global';
  END IF;

  -- Contar servicios inconsistentes antes de la corrección
  SELECT COUNT(*) INTO total_inconsistent
  FROM public.services 
  WHERE invoice_folio IS NOT NULL 
    AND invoice_folio != ''
    AND status != 'invoiced';

  -- Log inicial
  RAISE NOTICE 'CORRECCIÓN GLOBAL: Iniciando corrección de % servicios inconsistentes', total_inconsistent;

  -- Corregir servicios con invoice_folio pero status incorrecto
  UPDATE public.services 
  SET 
    status = 'invoiced',
    updated_at = now()
  WHERE invoice_folio IS NOT NULL 
    AND invoice_folio != ''
    AND status != 'invoiced';

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  -- Log de resultados
  RAISE NOTICE 'CORRECCIÓN GLOBAL: % servicios corregidos exitosamente', fixed_count;

  RETURN jsonb_build_object(
    'success', true,
    'total_inconsistent_before', total_inconsistent,
    'services_fixed', fixed_count,
    'message', format('Corrección global completada: %s servicios corregidos de %s inconsistentes', fixed_count, total_inconsistent),
    'timestamp', now()
  );
END;
$function$;

-- Fase 2: Trigger automático para mantener consistencia en el futuro
CREATE OR REPLACE FUNCTION public.auto_update_service_invoice_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Si se asigna invoice_folio, cambiar status a 'invoiced'
  IF NEW.invoice_folio IS NOT NULL AND NEW.invoice_folio != '' AND OLD.invoice_folio IS DISTINCT FROM NEW.invoice_folio THEN
    NEW.status := 'invoiced';
    NEW.updated_at := now();
    RAISE NOTICE 'AUTO-UPDATE: Servicio % cambiado a estado "invoiced" por asignación de invoice_folio: %', NEW.folio, NEW.invoice_folio;
  END IF;

  -- Si se quita invoice_folio, revertir status a 'completed'
  IF (NEW.invoice_folio IS NULL OR NEW.invoice_folio = '') AND (OLD.invoice_folio IS NOT NULL AND OLD.invoice_folio != '') THEN
    NEW.status := 'completed';
    NEW.updated_at := now();
    RAISE NOTICE 'AUTO-UPDATE: Servicio % revertido a estado "completed" por eliminación de invoice_folio', NEW.folio;
  END IF;

  RETURN NEW;
END;
$function$;

-- Crear el trigger si no existe
DROP TRIGGER IF EXISTS trigger_auto_update_service_invoice_status ON public.services;
CREATE TRIGGER trigger_auto_update_service_invoice_status
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_service_invoice_status();

-- Fase 3: Función de monitoreo y auditoría (corregida)
CREATE OR REPLACE FUNCTION public.check_service_invoice_consistency()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inconsistent_services INTEGER;
  services_with_folio INTEGER;
  services_invoiced INTEGER;
  sample_folios text[];
BEGIN
  -- Contar servicios inconsistentes
  SELECT COUNT(*) INTO inconsistent_services
  FROM public.services 
  WHERE invoice_folio IS NOT NULL 
    AND invoice_folio != ''
    AND status != 'invoiced';

  -- Contar servicios con folio
  SELECT COUNT(*) INTO services_with_folio
  FROM public.services 
  WHERE invoice_folio IS NOT NULL AND invoice_folio != '';

  -- Contar servicios con status invoiced
  SELECT COUNT(*) INTO services_invoiced
  FROM public.services 
  WHERE status = 'invoiced';

  -- Obtener muestra de inconsistencias para debugging (corregido)
  SELECT array_agg(folio) INTO sample_folios
  FROM (
    SELECT folio 
    FROM public.services 
    WHERE invoice_folio IS NOT NULL 
      AND invoice_folio != ''
      AND status != 'invoiced'
    ORDER BY folio 
    LIMIT 5
  ) sample;

  RETURN jsonb_build_object(
    'consistent', (inconsistent_services = 0),
    'inconsistent_services_count', inconsistent_services,
    'services_with_invoice_folio', services_with_folio,
    'services_with_invoiced_status', services_invoiced,
    'sample_inconsistent_folios', COALESCE(sample_folios, ARRAY[]::text[]),
    'last_check', now(),
    'status', CASE 
      WHEN inconsistent_services = 0 THEN 'PERFECTO'
      WHEN inconsistent_services <= 5 THEN 'ADVERTENCIA'
      ELSE 'CRÍTICO'
    END
  );
END;
$function$;

-- Fase 4: Trigger de validación para prevenir inconsistencias futuras
CREATE OR REPLACE FUNCTION public.validate_service_invoice_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validar que si hay invoice_folio, el status debe ser 'invoiced'
  IF NEW.invoice_folio IS NOT NULL AND NEW.invoice_folio != '' AND NEW.status != 'invoiced' THEN
    RAISE WARNING 'INCONSISTENCIA DETECTADA: Servicio % tiene invoice_folio "%" pero status "%". Auto-corrigiendo...', 
      NEW.folio, NEW.invoice_folio, NEW.status;
    NEW.status := 'invoiced';
    NEW.updated_at := now();
  END IF;

  -- Validar que si no hay invoice_folio, el status no debe ser 'invoiced'
  IF (NEW.invoice_folio IS NULL OR NEW.invoice_folio = '') AND NEW.status = 'invoiced' THEN
    RAISE WARNING 'INCONSISTENCIA DETECTADA: Servicio % no tiene invoice_folio pero status es "invoiced". Auto-corrigiendo...', 
      NEW.folio;
    NEW.status := 'completed';
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Crear trigger de validación
DROP TRIGGER IF EXISTS trigger_validate_service_invoice_consistency ON public.services;
CREATE TRIGGER trigger_validate_service_invoice_consistency
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_service_invoice_consistency();