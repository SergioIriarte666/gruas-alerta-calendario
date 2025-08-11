-- Sistema de Alertas para Facturas Vencidas
-- ==========================================

-- 1. Función para obtener facturas próximas a vencer
CREATE OR REPLACE FUNCTION public.get_invoices_due_soon(days_ahead integer DEFAULT 7)
RETURNS TABLE(
  id uuid,
  folio text,
  client_name text,
  due_date date,
  total numeric,
  days_until_due integer,
  status invoice_status
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.folio,
    c.name as client_name,
    i.due_date,
    i.total,
    (i.due_date - CURRENT_DATE)::integer as days_until_due,
    i.status
  FROM public.invoices i
  JOIN public.clients c ON i.client_id = c.id
  WHERE 
    i.status IN ('sent', 'draft')
    AND i.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead)
  ORDER BY i.due_date ASC;
END;
$$;

-- 2. Tabla para configuración de alertas
CREATE TABLE IF NOT EXISTS public.invoice_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  overdue_alerts_enabled boolean DEFAULT true,
  due_soon_alerts_enabled boolean DEFAULT true,
  due_soon_days integer DEFAULT 7,
  email_notifications boolean DEFAULT false,
  push_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS para configuración de alertas
ALTER TABLE public.invoice_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own alert settings" ON public.invoice_alert_settings
  FOR ALL USING (auth.uid() = user_id);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_invoices_overdue_check ON public.invoices(status, due_date) 
  WHERE status IN ('sent', 'draft', 'overdue');

CREATE INDEX IF NOT EXISTS idx_invoice_alert_settings_user ON public.invoice_alert_settings(user_id);