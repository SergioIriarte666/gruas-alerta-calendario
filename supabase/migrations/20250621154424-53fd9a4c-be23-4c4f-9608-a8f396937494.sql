
-- Agregar campos de configuración a la tabla service_types
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS purchase_order_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS origin_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS destination_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS crane_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS operator_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS vehicle_brand_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS vehicle_model_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS license_plate_required boolean NOT NULL DEFAULT true;

-- Actualizar los tipos de servicio existentes para reflejar sus configuraciones correctas
UPDATE public.service_types 
SET 
  vehicle_brand_required = false,
  vehicle_model_required = false,
  license_plate_required = false,
  crane_required = false
WHERE name ILIKE '%taxi%' OR name ILIKE '%traslado%' OR vehicle_info_optional = true;

-- Actualizar servicios de traslado de insumos para que también tengan orden de compra opcional
UPDATE public.service_types 
SET purchase_order_required = false
WHERE name ILIKE '%traslado%' OR name ILIKE '%insumo%';
