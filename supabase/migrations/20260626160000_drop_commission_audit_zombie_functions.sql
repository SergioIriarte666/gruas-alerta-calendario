BEGIN;

-- Funciones de auditoría/reparación de comisiones sin uso (panel "Auditoría del
-- Sistema de Comisiones" eliminado del frontend: 0 visitas en
-- user_activity_log, falsos positivos, código zombie de la era Lovable).
-- Verificado contra pg_trigger.tgfoid y contra el código fuente de todas las
-- funciones de public: ninguna de las siguientes está adjunta como trigger ni
-- es invocada por PERFORM desde otra función activa.
DROP FUNCTION IF EXISTS public.audit_commission_system();
DROP FUNCTION IF EXISTS public.repair_commission_system();
DROP FUNCTION IF EXISTS public.reconcile_orphan_records();
DROP FUNCTION IF EXISTS public.resolve_commission_conflicts(uuid);
DROP FUNCTION IF EXISTS public.force_commission_sync_for_service(uuid);
DROP FUNCTION IF EXISTS public.migrate_existing_operator_commissions();
DROP FUNCTION IF EXISTS public.sync_legacy_operator_commission();

-- NOTA — public.sync_service_commissions(uuid) se EXCLUYE deliberadamente de
-- este DROP a pesar de estar en la lista original solicitada: es la función
-- núcleo invocada vía PERFORM por trg_services_commission_sync() y
-- trg_service_resources_commission_sync(), ambas activas como
-- trigger_services_commission_sync (services) y
-- trigger_service_resources_commission_sync (service_resources). No aparece
-- en pg_trigger.tgfoid directamente porque no es ella misma el trigger handler,
-- pero es load-bearing: eliminarla rompe la sincronización de comisiones en
-- cada INSERT/UPDATE de services y service_resources. Confirmado en vivo:
--   SELECT t.tgname, p.prosrc ILIKE '%sync_service_commissions%'
--   FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
--   WHERE p.proname IN ('trg_services_commission_sync','trg_service_resources_commission_sync');
--   → ambas filas con calls_sync = true.

-- Limpieza adicional: list_orphan_commissions() y
-- mark_commission_manual_adjustment(uuid, text), agregadas en la migración
-- 20260626130000 para alimentar la sección "Issues Críticos" del panel que
-- esta migración elimina del frontend, quedan sin ningún consumidor.
-- create_manual_commission(...) y la columna costs.is_manual_adjustment NO se
-- tocan: siguen en uso por el formulario "Nueva comisión manual" del módulo
-- Comisiones, que es una funcionalidad independiente del panel de auditoría.
DROP FUNCTION IF EXISTS public.list_orphan_commissions();
DROP FUNCTION IF EXISTS public.mark_commission_manual_adjustment(uuid, text);

COMMIT;
