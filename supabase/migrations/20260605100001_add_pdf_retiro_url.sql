-- Columnas para guardar el PDF de inspección de retiro (fase inicial)
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS pdf_retiro_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_retiro_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.inspections.pdf_retiro_url
  IS 'URL del PDF de inspección de retiro (fase inicial)';
COMMENT ON COLUMN public.inspections.pdf_retiro_uploaded_at
  IS 'Timestamp de cuando se subió el PDF de retiro';
