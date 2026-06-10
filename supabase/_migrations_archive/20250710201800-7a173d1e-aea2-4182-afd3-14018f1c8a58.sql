-- Crear tabla de mantenimiento de grúas
CREATE TABLE IF NOT EXISTS public.crane_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_id UUID NOT NULL REFERENCES public.cranes(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency')),
  description TEXT NOT NULL,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  provider TEXT,
  scheduled_date DATE,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Crear tabla de alertas de documentos
CREATE TABLE IF NOT EXISTS public.document_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_id UUID NOT NULL REFERENCES public.cranes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('technical_review', 'insurance', 'circulation_permit')),
  alert_days INTEGER NOT NULL DEFAULT 30,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(crane_id, document_type)
);

-- Crear tabla de configuración de notificaciones
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  crane_alerts BOOLEAN DEFAULT TRUE,
  maintenance_reminders BOOLEAN DEFAULT TRUE,
  document_expiry_alerts BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.crane_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para crane_maintenance
CREATE POLICY "crane_maintenance_select_policy" ON public.crane_maintenance
  FOR SELECT USING (is_operator_user());

CREATE POLICY "crane_maintenance_modify_policy" ON public.crane_maintenance
  FOR ALL USING (is_admin_user());

-- Políticas RLS para document_alerts
CREATE POLICY "document_alerts_select_policy" ON public.document_alerts
  FOR SELECT USING (is_operator_user());

CREATE POLICY "document_alerts_modify_policy" ON public.document_alerts
  FOR ALL USING (is_admin_user());

-- Políticas RLS para notification_settings
CREATE POLICY "notification_settings_own_policy" ON public.notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_crane_maintenance_updated_at
  BEFORE UPDATE ON public.crane_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_alerts_updated_at
  BEFORE UPDATE ON public.document_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para obtener métricas de grúa
CREATE OR REPLACE FUNCTION public.get_crane_metrics(p_crane_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_services', COALESCE(services.total, 0),
    'completed_services', COALESCE(services.completed, 0),
    'pending_services', COALESCE(services.pending, 0),
    'monthly_revenue', COALESCE(services.monthly_revenue, 0),
    'maintenance_costs', COALESCE(maintenance.total_cost, 0),
    'maintenance_count', COALESCE(maintenance.count, 0)
  ) INTO result
  FROM (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      SUM(value) FILTER (WHERE status = 'completed' AND EXTRACT(MONTH FROM service_date) = EXTRACT(MONTH FROM CURRENT_DATE)) as monthly_revenue
    FROM public.services 
    WHERE crane_id = p_crane_id
  ) services
  CROSS JOIN (
    SELECT 
      SUM(cost) as total_cost,
      COUNT(*) as count
    FROM public.crane_maintenance 
    WHERE crane_id = p_crane_id AND status = 'completed'
  ) maintenance;
  
  RETURN result;
END;
$$;

-- Función para obtener alertas de documentos próximos a vencer
CREATE OR REPLACE FUNCTION public.get_document_expiry_alerts()
RETURNS TABLE (
  crane_id UUID,
  crane_license_plate TEXT,
  document_type TEXT,
  expiry_date DATE,
  days_until_expiry INTEGER
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.license_plate,
    'technical_review'::TEXT,
    c.technical_review_expiry,
    (c.technical_review_expiry - CURRENT_DATE)::INTEGER
  FROM public.cranes c
  WHERE c.technical_review_expiry <= CURRENT_DATE + INTERVAL '30 days'
    AND c.is_active = TRUE
  
  UNION ALL
  
  SELECT 
    c.id,
    c.license_plate,
    'insurance'::TEXT,
    c.insurance_expiry,
    (c.insurance_expiry - CURRENT_DATE)::INTEGER
  FROM public.cranes c
  WHERE c.insurance_expiry <= CURRENT_DATE + INTERVAL '30 days'
    AND c.is_active = TRUE
  
  UNION ALL
  
  SELECT 
    c.id,
    c.license_plate,
    'circulation_permit'::TEXT,
    c.circulation_permit_expiry,
    (c.circulation_permit_expiry - CURRENT_DATE)::INTEGER
  FROM public.cranes c
  WHERE c.circulation_permit_expiry <= CURRENT_DATE + INTERVAL '30 days'
    AND c.is_active = TRUE
  
  ORDER BY days_until_expiry ASC;
END;
$$;