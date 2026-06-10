-- Agregar campos para facturación diferida a la tabla clients
ALTER TABLE public.clients 
ADD COLUMN billing_cycle_type text DEFAULT 'immediate' CHECK (billing_cycle_type IN ('immediate', 'deferred')),
ADD COLUMN billing_delay_days integer DEFAULT 0,
ADD COLUMN billing_cycle_day integer DEFAULT NULL CHECK (billing_cycle_day >= 1 AND billing_cycle_day <= 31),
ADD COLUMN auto_invoice_generation boolean DEFAULT false,
ADD COLUMN billing_notes text DEFAULT NULL;

-- Comentarios para documentar los campos
COMMENT ON COLUMN public.clients.billing_cycle_type IS 'Tipo de ciclo de facturación: immediate (inmediata) o deferred (diferida)';
COMMENT ON COLUMN public.clients.billing_delay_days IS 'Días de diferimiento para facturación (ej: 30 para facturar al mes siguiente)';
COMMENT ON COLUMN public.clients.billing_cycle_day IS 'Día del mes preferido para facturación (opcional, 1-31)';
COMMENT ON COLUMN public.clients.auto_invoice_generation IS 'Generar facturas automáticamente cuando se cumple el período de diferimiento';
COMMENT ON COLUMN public.clients.billing_notes IS 'Notas adicionales sobre el proceso de facturación del cliente';

-- Crear índice para optimizar consultas de facturación diferida
CREATE INDEX idx_clients_billing_cycle ON public.clients(billing_cycle_type, billing_delay_days) WHERE billing_cycle_type = 'deferred';

-- Función para calcular la fecha de facturación de un cliente
CREATE OR REPLACE FUNCTION public.calculate_billing_date(
  service_date date,
  billing_cycle_type text,
  billing_delay_days integer DEFAULT 0,
  billing_cycle_day integer DEFAULT NULL
) RETURNS date AS $$
BEGIN
  IF billing_cycle_type = 'immediate' THEN
    RETURN service_date;
  END IF;
  
  -- Para facturación diferida
  IF billing_cycle_day IS NOT NULL THEN
    -- Si se especifica un día del mes, usar ese día en el mes correspondiente
    RETURN date_trunc('month', service_date + (billing_delay_days || ' days')::interval)::date + (billing_cycle_day - 1);
  ELSE
    -- Solo agregar los días de diferimiento
    RETURN service_date + (billing_delay_days || ' days')::interval;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista para servicios listos para facturación diferida
CREATE OR REPLACE VIEW public.services_ready_for_deferred_billing AS
SELECT 
  s.*,
  c.name as client_name,
  c.billing_cycle_type,
  c.billing_delay_days,
  c.billing_cycle_day,
  c.auto_invoice_generation,
  public.calculate_billing_date(s.service_date, c.billing_cycle_type, c.billing_delay_days, c.billing_cycle_day) as billing_ready_date
FROM public.services s
JOIN public.clients c ON s.client_id = c.id
WHERE c.billing_cycle_type = 'deferred'
  AND s.status = 'completed'
  AND s.id NOT IN (
    SELECT DISTINCT service_id 
    FROM public.invoice_services 
    WHERE service_id IS NOT NULL
  )
  AND public.calculate_billing_date(s.service_date, c.billing_cycle_type, c.billing_delay_days, c.billing_cycle_day) <= CURRENT_DATE;

-- Función para obtener servicios en período de diferimiento
CREATE OR REPLACE FUNCTION public.get_deferred_services_summary()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'ready_for_billing', (
      SELECT COUNT(*) FROM public.services_ready_for_deferred_billing
    ),
    'pending_deferred', (
      SELECT COUNT(*)
      FROM public.services s
      JOIN public.clients c ON s.client_id = c.id
      WHERE c.billing_cycle_type = 'deferred'
        AND s.status = 'completed'
        AND s.id NOT IN (SELECT DISTINCT service_id FROM public.invoice_services WHERE service_id IS NOT NULL)
        AND public.calculate_billing_date(s.service_date, c.billing_cycle_type, c.billing_delay_days, c.billing_cycle_day) > CURRENT_DATE
    ),
    'total_pending_amount', (
      SELECT COALESCE(SUM(s.value), 0)
      FROM public.services s
      JOIN public.clients c ON s.client_id = c.id
      WHERE c.billing_cycle_type = 'deferred'
        AND s.status = 'completed'
        AND s.id NOT IN (SELECT DISTINCT service_id FROM public.invoice_services WHERE service_id IS NOT NULL)
    ),
    'clients_with_deferred_billing', (
      SELECT COUNT(DISTINCT c.id)
      FROM public.clients c
      WHERE c.billing_cycle_type = 'deferred'
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;