
-- Agregar campos para nombres de archivos de fotografías a la tabla inspections
ALTER TABLE public.inspections 
ADD COLUMN photos_before_service TEXT[] DEFAULT '{}',
ADD COLUMN photos_client_vehicle TEXT[] DEFAULT '{}',
ADD COLUMN photos_equipment_used TEXT[] DEFAULT '{}';

-- Agregar comentarios para documentar los nuevos campos
COMMENT ON COLUMN public.inspections.photos_before_service IS 'Array de nombres de archivos de fotos tomadas antes del servicio';
COMMENT ON COLUMN public.inspections.photos_client_vehicle IS 'Array de nombres de archivos de fotos del vehículo del cliente';
COMMENT ON COLUMN public.inspections.photos_equipment_used IS 'Array de nombres de archivos de fotos del equipo utilizado';
