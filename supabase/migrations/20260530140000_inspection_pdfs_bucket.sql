-- 1. Bucket privado para PDFs de inspección
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-pdfs',
  'inspection-pdfs',
  false,
  20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "inspection_pdfs_operator_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-pdfs' AND is_operator_user_safe());

CREATE POLICY "inspection_pdfs_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inspection-pdfs' AND (is_operator_user_safe() OR is_admin_user_safe()));

-- 2. Columna pdf_url en la tabla inspections
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_uploaded_at TIMESTAMPTZ;

-- 3. Flag para activar/desactivar el envío desde whatsapp_settings
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS notify_inspection_completed BOOLEAN NOT NULL DEFAULT true;
