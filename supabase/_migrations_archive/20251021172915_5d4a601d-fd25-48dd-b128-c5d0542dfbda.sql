-- Agregar 3 campos opcionales a la tabla services
ALTER TABLE public.services 
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME,
ADD COLUMN crane_mileage INTEGER;

-- Comentarios para documentación
COMMENT ON COLUMN public.services.start_time IS 'Hora de inicio del servicio (HH:MM)';
COMMENT ON COLUMN public.services.end_time IS 'Hora de término del servicio (HH:MM)';
COMMENT ON COLUMN public.services.crane_mileage IS 'Kilometraje de la grúa al momento del servicio (no del vehículo transportado)';

-- Índice para búsquedas por kilometraje de grúa (útil para mantenimiento predictivo)
CREATE INDEX idx_services_crane_mileage ON public.services(crane_mileage) WHERE crane_mileage IS NOT NULL;