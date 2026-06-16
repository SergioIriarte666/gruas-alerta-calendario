BEGIN;

-- Asegurar que create_bank_statement_import fue eliminada (intento con firma alternativa)
DROP FUNCTION IF EXISTS public.create_bank_statement_import CASCADE;

COMMIT;
