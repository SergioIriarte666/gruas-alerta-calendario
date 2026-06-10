-- Bucket privado para fotos de inspección
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-photos',
  'inspection-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Operadores pueden subir sus propias fotos
CREATE POLICY "inspection_photos_operator_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inspection-photos'
  AND is_operator_user_safe()
);

-- Operadores y admins pueden leer fotos
CREATE POLICY "inspection_photos_operator_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (is_operator_user_safe() OR is_admin_user_safe())
);

-- Operadores pueden eliminar sus propias fotos
CREATE POLICY "inspection_photos_operator_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND is_operator_user_safe()
);
