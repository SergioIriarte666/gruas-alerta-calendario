-- Servicios "externo_tercero": subcontratados por G5N a proveedores externos.
-- El admin maneja el cierre completo (operador no participa). Recibe evidencia
-- del tercero (PDF, fotos, factura, orden firmada), la sube al TMS, dibuja su
-- firma y emite un Acta de Servicio Externo G5N que puede enviarse por email
-- al cliente.
--
-- Modelo:
--   * service_external_evidence: archivos individuales subidos por admin.
--     Append-only (D4 = solo agregar). RLS solo admin.
--   * service_external_closures: una fila por servicio cerrado. Contiene la
--     firma del admin, el resumen del trabajo del tercero, y el tracking
--     del envío del Acta por email. RLS solo admin.
--   * Storage bucket 'external-evidence': contenedor único con dos prefijos:
--       evidence/{service_id}/{uuid}.{ext}  -> archivos del tercero
--       actas/{folio}.pdf                    -> Acta G5N generada por TMS

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabla de evidencia (append-only)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.service_external_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  evidence_type text NOT NULL
    CHECK (evidence_type IN ('formulario_tercero', 'fotos', 'factura', 'orden_firmada', 'otro')),
  notes text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_evidence_service ON public.service_external_evidence(service_id);
CREATE INDEX idx_external_evidence_uploaded_by ON public.service_external_evidence(uploaded_by);

COMMENT ON TABLE public.service_external_evidence IS
  'Archivos de evidencia enviados por el proveedor externo (tercero) para servicios subcontratados. Append-only.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tabla de cierre de servicios externos
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.service_external_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE REFERENCES public.services(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  admin_name text NOT NULL,
  admin_signature text NOT NULL,
  third_party_provider_name text NOT NULL,
  third_party_provider_rut text,
  third_party_service_summary text NOT NULL,
  closure_notes text,
  pdf_path text,
  email_sent_to text[] NOT NULL DEFAULT ARRAY[]::text[],
  email_sent_at timestamptz,
  email_send_count integer NOT NULL DEFAULT 0,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_closures_service ON public.service_external_closures(service_id);
CREATE INDEX idx_external_closures_admin ON public.service_external_closures(admin_user_id);
CREATE INDEX idx_external_closures_closed_at ON public.service_external_closures(closed_at DESC);

COMMENT ON TABLE public.service_external_closures IS
  'Cierre administrativo de servicios externos: firma del admin, datos del tercero, tracking de envíos de email del Acta G5N.';
COMMENT ON COLUMN public.service_external_closures.admin_signature IS
  'Firma del admin dibujada al momento del cierre (data URL base64 PNG).';
COMMENT ON COLUMN public.service_external_closures.pdf_path IS
  'Path en bucket external-evidence donde se almacena el Acta G5N generada.';
COMMENT ON COLUMN public.service_external_closures.email_sent_to IS
  'Array acumulativo de emails a los que se ha enviado el Acta (permite reenvíos).';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_external_closures_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_external_closures_updated_at
  BEFORE UPDATE ON public.service_external_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.set_external_closures_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — solo admin
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.service_external_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_external_closures ENABLE ROW LEVEL SECURITY;

-- Usa la función existente del proyecto: is_admin_user_safe()
-- (definida en baseline_schema.sql)

-- Evidence: solo admin lee y crea. No UPDATE ni DELETE.
CREATE POLICY "Admin can read external evidence"
  ON public.service_external_evidence FOR SELECT
  USING (public.is_admin_user_safe());

CREATE POLICY "Admin can insert external evidence"
  ON public.service_external_evidence FOR INSERT
  WITH CHECK (public.is_admin_user_safe() AND uploaded_by = auth.uid());

-- Closures: admin lee, crea y puede actualizar (para tracking de email).
-- DELETE bloqueado (trazabilidad).
CREATE POLICY "Admin can read external closures"
  ON public.service_external_closures FOR SELECT
  USING (public.is_admin_user_safe());

CREATE POLICY "Admin can insert external closures"
  ON public.service_external_closures FOR INSERT
  WITH CHECK (public.is_admin_user_safe() AND admin_user_id = auth.uid());

CREATE POLICY "Admin can update external closures"
  ON public.service_external_closures FOR UPDATE
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Storage bucket
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'external-evidence',
  'external-evidence',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS bucket: solo admin
CREATE POLICY "Admin can read external-evidence bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'external-evidence' AND public.is_admin_user_safe());

CREATE POLICY "Admin can upload to external-evidence bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'external-evidence' AND public.is_admin_user_safe());

CREATE POLICY "Admin can update objects in external-evidence bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'external-evidence' AND public.is_admin_user_safe());

-- NOTA: no se crea DELETE policy en storage.objects para este bucket
-- (consistencia con la política append-only de la evidencia).

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Vista helper: servicios externos pendientes de cierre
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.external_services_pending AS
SELECT s.*, st.name AS service_type_name, st.service_category
FROM public.services s
JOIN public.service_types st ON st.id = s.service_type_id
LEFT JOIN public.service_external_closures c ON c.service_id = s.id
WHERE st.service_category = 'externo_tercero'
  AND c.id IS NULL
  AND s.status != 'cancelled';

COMMENT ON VIEW public.external_services_pending IS
  'Servicios de categoría externo_tercero que aún no tienen un cierre admin registrado.';

-- Grants
GRANT SELECT ON public.external_services_pending TO authenticated;
