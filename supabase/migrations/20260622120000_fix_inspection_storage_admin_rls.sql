-- Alinea las politicas de INSERT/DELETE de storage.objects para los buckets
-- inspection-photos e inspection-pdfs con las de SELECT: estas ya permiten
-- is_admin_user_safe() ademas de is_operator_user_safe(), pero a las de
-- subida/borrado se les habia omitido la rama admin, bloqueando a usuarios
-- admin que tambien hacen inspecciones en terreno con "new row violates
-- row-level security policy".

BEGIN;

DROP POLICY IF EXISTS inspection_photos_operator_upload ON storage.objects;
CREATE POLICY inspection_photos_operator_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-photos' AND (is_operator_user_safe() OR is_admin_user_safe()));

DROP POLICY IF EXISTS inspection_pdfs_operator_upload ON storage.objects;
CREATE POLICY inspection_pdfs_operator_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-pdfs' AND (is_operator_user_safe() OR is_admin_user_safe()));

DROP POLICY IF EXISTS inspection_photos_operator_delete ON storage.objects;
CREATE POLICY inspection_photos_operator_delete
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inspection-photos' AND (is_operator_user_safe() OR is_admin_user_safe()));

COMMIT;
