-- Crear tabla para registro de anulaciones de facturas con Nota de Crédito
CREATE TABLE public.invoice_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  credit_note_number TEXT NOT NULL,
  cancellation_reason TEXT NOT NULL,
  reason_details TEXT,
  cancelled_by UUID REFERENCES public.profiles(id),
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  original_folio TEXT NOT NULL,
  original_numero_fiscal TEXT,
  original_total NUMERIC NOT NULL,
  original_client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_invoice_cancellation UNIQUE(invoice_id),
  CONSTRAINT unique_credit_note_number UNIQUE(credit_note_number)
);

-- Habilitar RLS
ALTER TABLE public.invoice_cancellations ENABLE ROW LEVEL SECURITY;

-- Política: Admins tienen acceso completo
CREATE POLICY "invoice_cancellations_admin_full_access"
ON public.invoice_cancellations
FOR ALL TO authenticated
USING (is_admin_user_safe())
WITH CHECK (is_admin_user_safe());

-- Política: Usuarios autenticados pueden ver las anulaciones
CREATE POLICY "invoice_cancellations_authenticated_select"
ON public.invoice_cancellations
FOR SELECT TO authenticated
USING (is_authenticated_user_safe());

-- Crear índices para consultas frecuentes
CREATE INDEX idx_invoice_cancellations_invoice_id ON public.invoice_cancellations(invoice_id);
CREATE INDEX idx_invoice_cancellations_cancelled_at ON public.invoice_cancellations(cancelled_at DESC);
CREATE INDEX idx_invoice_cancellations_credit_note ON public.invoice_cancellations(credit_note_number);

-- Agregar comentarios descriptivos
COMMENT ON TABLE public.invoice_cancellations IS 'Registro de anulaciones de facturas con Nota de Crédito para auditoría contable';
COMMENT ON COLUMN public.invoice_cancellations.credit_note_number IS 'Número de Nota de Crédito emitida en SII (obligatorio)';
COMMENT ON COLUMN public.invoice_cancellations.cancellation_reason IS 'Motivo de anulación (obligatorio)';