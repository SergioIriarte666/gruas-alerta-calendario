BEGIN;

-- Tabla de documentos de operadores
CREATE TABLE IF NOT EXISTS public.operator_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT,
  expiry_date DATE,
  issued_date DATE,
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT operator_documents_document_type_check CHECK (
    document_type IN (
      'cedula_identidad',
      'licencia_conducir',
      'examen_psicosensotecnico',
      'examen_altura',
      'seguro_vida',
      'contrato_trabajo'
    )
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_operator_documents_operator_id ON public.operator_documents(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_documents_expiry_date ON public.operator_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_operator_documents_document_type ON public.operator_documents(document_type);

-- RLS
ALTER TABLE public.operator_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin puede gestionar todos los documentos de operadores"
ON public.operator_documents
FOR ALL
USING (is_admin_user())
WITH CHECK (is_admin_user());

CREATE POLICY "Usuarios pueden ver documentos de operadores"
ON public.operator_documents
FOR SELECT
USING (true);

-- Storage bucket (público igual que crane-documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('operator-documents', 'operator-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (idénticas a crane-documents)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Lectura pública de documentos de operadores'
  ) THEN
    CREATE POLICY "Lectura pública de documentos de operadores"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'operator-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Usuarios autenticados pueden subir documentos de operadores'
  ) THEN
    CREATE POLICY "Usuarios autenticados pueden subir documentos de operadores"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'operator-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Usuarios pueden actualizar documentos de operadores'
  ) THEN
    CREATE POLICY "Usuarios pueden actualizar documentos de operadores"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'operator-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Usuarios pueden eliminar documentos de operadores'
  ) THEN
    CREATE POLICY "Usuarios pueden eliminar documentos de operadores"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'operator-documents');
  END IF;
END
$$;

-- Trigger updated_at
CREATE TRIGGER update_operator_documents_updated_at
  BEFORE UPDATE ON public.operator_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Columna de configuración WhatsApp para alertas de documentos de operadores
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS notify_operator_document_expiry BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_settings.notify_operator_document_expiry
  IS 'Enviar alerta WhatsApp cuando documentos de operadores estén por vencer o vencidos';

COMMIT;
