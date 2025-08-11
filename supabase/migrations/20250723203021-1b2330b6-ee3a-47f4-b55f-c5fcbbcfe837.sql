-- CRÍTICO: Deshabilitar triggers automáticos que generan comisiones masivamente
-- Esto evita que se sigan generando comisiones incorrectamente

-- 1. Deshabilitar trigger de generación automática de comisiones en service_resources
DROP TRIGGER IF EXISTS trigger_generate_commission_cost ON public.service_resources;

-- 2. Deshabilitar trigger de sincronización legacy en services
DROP TRIGGER IF EXISTS trigger_sync_legacy_operator_commission ON public.services;

-- 3. Deshabilitar cualquier otro trigger de comisiones automáticas
DROP TRIGGER IF EXISTS generate_commission_on_service_completion ON public.services;

-- 4. Deshabilitar trigger de múltiples comisiones si existe
DROP TRIGGER IF EXISTS generate_multiple_commissions_for_service_trigger ON public.services;

-- Log de confirmación
RAISE NOTICE 'TRIGGERS DE COMISIONES AUTOMÁTICAS DESHABILITADOS - SISTEMA SEGURO';

-- Verificar triggers restantes (consulta corregida)
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND tgname ILIKE '%commission%';

-- Marcar funciones como deshabilitadas
COMMENT ON FUNCTION public.generate_commission_cost() IS 'DESHABILITADO: Función de generación automática de comisiones deshabilitada por seguridad';
COMMENT ON FUNCTION public.sync_legacy_operator_commission() IS 'DESHABILITADO: Función de sincronización legacy deshabilitada por seguridad';