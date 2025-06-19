
-- Agregar campo para indicar si la información del vehículo es opcional
ALTER TABLE public.service_types 
ADD COLUMN vehicle_info_optional boolean NOT NULL DEFAULT false;

-- Actualizar los tipos de servicio existentes donde la información del vehículo debería ser opcional
UPDATE public.service_types 
SET vehicle_info_optional = true 
WHERE LOWER(name) LIKE '%taxi%' 
   OR LOWER(name) LIKE '%transporte de materiales%' 
   OR LOWER(name) LIKE '%transporte de suministros%' 
   OR LOWER(name) LIKE '%traslado de insumos%'
   OR LOWER(name) LIKE '%insumos%';
