-- Agregar columna 'role' a la tabla service_resources para guardar el rol del operador
ALTER TABLE public.service_resources 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Principal';

-- Comentario explicativo
COMMENT ON COLUMN public.service_resources.role IS 'Rol del operador en el servicio (ej: Principal, Auxiliar, Supervisor)';

-- Actualizar registros existentes para que tengan el rol 'Principal' si is_primary es true
UPDATE public.service_resources
SET role = 'Principal'
WHERE is_primary = true AND role IS NULL;

-- Crear índice para mejorar consultas por rol
CREATE INDEX IF NOT EXISTS idx_service_resources_role ON public.service_resources(role);