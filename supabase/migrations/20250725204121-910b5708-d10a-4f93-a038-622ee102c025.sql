-- Actualizar el tipo de servicio "Traslado de Insumos" para que los campos de vehículo sean opcionales
UPDATE public.service_types 
SET vehicle_info_optional = true,
    updated_at = now()
WHERE name = 'Traslado de Insumos';