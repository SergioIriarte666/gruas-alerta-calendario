-- Agregar columnas de configuración de tiempo de sesión
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS session_timeout_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS session_warning_minutes integer DEFAULT 25,
ADD COLUMN IF NOT EXISTS session_timeout_minutes integer DEFAULT 30;

-- Agregar restricciones de validación
ALTER TABLE public.system_settings 
ADD CONSTRAINT check_session_warning_minutes 
CHECK (session_warning_minutes >= 5 AND session_warning_minutes <= 60);

ALTER TABLE public.system_settings 
ADD CONSTRAINT check_session_timeout_minutes 
CHECK (session_timeout_minutes >= 10 AND session_timeout_minutes <= 120);

-- Comentarios descriptivos
COMMENT ON COLUMN public.system_settings.session_timeout_enabled IS 'Habilitar cierre automático de sesión por inactividad';
COMMENT ON COLUMN public.system_settings.session_warning_minutes IS 'Minutos de inactividad antes de mostrar advertencia (5-60)';
COMMENT ON COLUMN public.system_settings.session_timeout_minutes IS 'Minutos totales antes de cerrar sesión (10-120)';