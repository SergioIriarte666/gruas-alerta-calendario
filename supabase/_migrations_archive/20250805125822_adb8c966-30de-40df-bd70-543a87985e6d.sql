-- Crear tabla para configuraciones de usuario
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  use_system_timezone BOOLEAN NOT NULL DEFAULT true,
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  language TEXT NOT NULL DEFAULT 'es',
  currency TEXT NOT NULL DEFAULT 'CLP',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Crear políticas para acceso personal
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Crear función para actualizar timestamps
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();