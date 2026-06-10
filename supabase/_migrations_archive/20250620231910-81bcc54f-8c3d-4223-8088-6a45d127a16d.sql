
-- Crear tabla para configuraciones del sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_backup BOOLEAN NOT NULL DEFAULT true,
  backup_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (backup_frequency IN ('daily', 'weekly', 'monthly')),
  data_retention INTEGER NOT NULL DEFAULT 12 CHECK (data_retention > 0),
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  service_reminders BOOLEAN NOT NULL DEFAULT true,
  invoice_alerts BOOLEAN NOT NULL DEFAULT true,
  overdue_notifications BOOLEAN NOT NULL DEFAULT true,
  system_updates BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS (solo admins pueden gestionar configuraciones del sistema)
CREATE POLICY "Admins can view system settings" 
  ON public.system_settings 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert system settings" 
  ON public.system_settings 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update system settings" 
  ON public.system_settings 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insertar configuración por defecto si no existe
INSERT INTO public.system_settings (
  auto_backup,
  backup_frequency,
  data_retention,
  maintenance_mode,
  email_notifications,
  service_reminders,
  invoice_alerts,
  overdue_notifications,
  system_updates
) 
SELECT 
  true,
  'daily',
  12,
  false,
  true,
  true,
  true,
  true,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

-- Trigger para actualizar updated_at
CREATE OR REPLACE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
