-- Recuperado de supabase_migrations.schema_migrations (version 20260609171331,
-- name "20260609220000_approve_user_profiles.sql") el 2026-06-10. Aplicada en
-- remoto sin archivo local. NO re-aplicar: contiene un UPDATE de datos puntual
-- (one-off) y un cambio de DEFAULT que ya rige en produccion.
-- OJO: el UPDATE es data-fix de un solo uso; NO pertenece a un baseline de esquema.

-- ============================================================
-- Aprobar perfiles de usuario pendientes
-- ============================================================
BEGIN;

-- Aprobar usuario especifico
UPDATE profiles
SET status = 'approved', updated_at = NOW()
WHERE email = 'siriartev@gmail.com'
  AND status = 'pending';

-- Cambiar el default de status a 'approved' para nuevos perfiles
ALTER TABLE profiles
  ALTER COLUMN status SET DEFAULT 'approved';

COMMIT;
