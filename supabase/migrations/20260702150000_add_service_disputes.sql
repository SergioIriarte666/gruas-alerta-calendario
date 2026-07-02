BEGIN;

-- Mecanismo de "servicio en disputa": condición ortogonal al estado del
-- servicio (no es un nuevo valor de status ni un módulo nuevo). Un servicio
-- puede tener a lo más una disputa abierta a la vez.
CREATE TABLE IF NOT EXISTS public.service_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id),
  dispute_type text NOT NULL CHECK (dispute_type IN (
    'item_faltante_oc',
    'patente_incorrecta',
    'monto_distinto',
    'documento_faltante',
    'otro'
  )),
  description text NOT NULL,
  disputed_amount numeric,
  reference_doc text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz
);

-- Consultas por servicio (historial completo)
CREATE INDEX IF NOT EXISTS idx_service_disputes_service_id
  ON public.service_disputes(service_id);

-- Lookup rápido de disputas abiertas para agrupar el Pipeline
CREATE INDEX IF NOT EXISTS idx_service_disputes_open
  ON public.service_disputes(service_id)
  WHERE status = 'open';

-- Máximo una disputa abierta por servicio
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_disputes_one_open_per_service
  ON public.service_disputes(service_id)
  WHERE status = 'open';

ALTER TABLE public.service_disputes ENABLE ROW LEVEL SECURITY;

-- Admin: acceso completo (crear, editar/resolver, eliminar)
CREATE POLICY "service_disputes_admin_full_access"
  ON public.service_disputes
  TO authenticated
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

-- Viewer: solo lectura
CREATE POLICY "service_disputes_viewer_read_access"
  ON public.service_disputes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));

COMMIT;
