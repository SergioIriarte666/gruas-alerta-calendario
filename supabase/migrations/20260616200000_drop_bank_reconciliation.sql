BEGIN;

-- Eliminar tablas del segundo intento (Jun 16)
DROP TABLE IF EXISTS public.bank_reconciliations CASCADE;
DROP TABLE IF EXISTS public.bank_movements CASCADE;
DROP TABLE IF EXISTS public.bank_imports CASCADE;

-- Eliminar tablas del primer intento (Jun 10)
DROP TABLE IF EXISTS public.bank_statement_movements CASCADE;
DROP TABLE IF EXISTS public.bank_statement_imports CASCADE;

-- Eliminar RPCs
DROP FUNCTION IF EXISTS public.create_bank_statement_import(text, text, text, jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.mark_bank_statement_movement_exception(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.list_bank_statement_invoice_candidates(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.reconcile_bank_statement_movement_full(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.reconcile_bank_statement_movement_full(uuid, uuid, date) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_bank_statement_imports(uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.sync_bank_statement_movement_statuses(uuid) CASCADE;

COMMIT;
