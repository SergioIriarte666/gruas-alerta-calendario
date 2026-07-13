-- CAUSA RAÍZ del bug "Error al subir foto {archivo}: new row violates row-level
-- security policy" al Completar la Inspección Inicial.
--
-- uploadInspectionPhoto() sube con { upsert: true }. Cuando la foto ya existe en
-- el bucket (p.ej. tras un reintento, porque el nombre del objeto es determinista
-- por captura), Storage ejecuta el camino ON CONFLICT DO UPDATE sobre
-- storage.objects. Ese UPDATE requiere una política RLS de UPDATE para el bucket
-- inspection-photos que NUNCA se creó: 20260622120000_fix_inspection_storage_admin_rls
-- alineó INSERT y DELETE (operator OR admin) pero omitió UPDATE. Sin política de
-- UPDATE, el upsert rebota con:
--   42501: new row violates row-level security policy (USING expression) for table "objects"
-- y como las fotos quedan en el bucket, cada reintento falla SIEMPRE.
--
-- El bloqueo es independiente del rol: no existía NINGUNA política de UPDATE para
-- el bucket, así que afecta a admin y a operador por igual. Se agrega UPDATE con el
-- mismo patrón (is_operator_user_safe() OR is_admin_user_safe()) para ambos buckets
-- de inspección, haciendo el upsert idempotente.
--
-- Además se alinea inspection_storage_orphans (ledger de archivado R2) al mismo
-- patrón: los operadores reales (Juan Carlos, Jesús) también recorren el flujo de
-- limpieza y deben poder registrar el ledger, no solo los admin.

BEGIN;

-- UPDATE para el upsert de fotos (la rama que faltaba).
DROP POLICY IF EXISTS inspection_photos_operator_update ON storage.objects;
CREATE POLICY inspection_photos_operator_update
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inspection-photos' AND (is_operator_user_safe() OR is_admin_user_safe()))
WITH CHECK (bucket_id = 'inspection-photos' AND (is_operator_user_safe() OR is_admin_user_safe()));

-- Paridad para inspection-pdfs: hoy sube con upsert:false y nombres únicos, pero se
-- deja la política por consistencia y para que un futuro upsert no vuelva a romperse.
DROP POLICY IF EXISTS inspection_pdfs_operator_update ON storage.objects;
CREATE POLICY inspection_pdfs_operator_update
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inspection-pdfs' AND (is_operator_user_safe() OR is_admin_user_safe()))
WITH CHECK (bucket_id = 'inspection-pdfs' AND (is_operator_user_safe() OR is_admin_user_safe()));

-- Ledger de huérfanos de Storage: operator OR admin (antes solo admin).
DROP POLICY IF EXISTS orphans_admin_write ON public.inspection_storage_orphans;
CREATE POLICY orphans_admin_write ON public.inspection_storage_orphans
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user_safe() OR public.is_operator_user_safe()))
  WITH CHECK ((SELECT public.is_admin_user_safe() OR public.is_operator_user_safe()));

COMMIT;
