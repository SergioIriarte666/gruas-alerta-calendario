-- =======================================================
-- Sistema de Servicios Subcontratados a Terceros
-- =======================================================

-- 1. Agregar columna is_outsourced a service_types
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS is_outsourced BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.service_types.is_outsourced IS 
'Indica si este tipo de servicio es ejecutado por un proveedor externo (subcontratado)';

-- 2. Agregar columnas para proveedor tercero en services
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS outsourced_provider_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS outsourced_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS outsourced_notes TEXT;

COMMENT ON COLUMN public.services.outsourced_provider_id IS 
'Proveedor que ejecuta el servicio subcontratado';
COMMENT ON COLUMN public.services.outsourced_cost IS 
'Monto pagado al proveedor tercero por ejecutar el servicio';
COMMENT ON COLUMN public.services.outsourced_notes IS 
'Notas adicionales sobre el servicio tercerizado (patente grúa tercero, contacto, etc.)';

-- 3. Crear índice para búsquedas por proveedor tercero
CREATE INDEX IF NOT EXISTS idx_services_outsourced_provider 
ON public.services(outsourced_provider_id) 
WHERE outsourced_provider_id IS NOT NULL;

-- 4. Agregar categoría de proveedor para servicios terceros si no existe
INSERT INTO public.supplier_categories (name, label, description, is_active)
SELECT 'servicios_terceros', 'Servicios Terceros', 'Proveedores de servicios subcontratados (grúas, rescates, transporte)', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.supplier_categories WHERE name = 'servicios_terceros'
);

-- 5. Crear tipos de servicio para terceros (desactivar grúa y operador obligatorios)
INSERT INTO public.service_types (
  name, 
  description, 
  is_active, 
  is_outsourced,
  crane_required, 
  operator_required,
  origin_required,
  destination_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  purchase_order_required
)
SELECT 
  'Grúa Tercero Livianos',
  'Servicio de grúa liviana ejecutado por proveedor externo',
  true,
  true,
  false, -- No requiere grúa propia
  false, -- No requiere operador propio
  true,
  true,
  true,
  true,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_types WHERE name = 'Grúa Tercero Livianos'
);

INSERT INTO public.service_types (
  name, 
  description, 
  is_active, 
  is_outsourced,
  crane_required, 
  operator_required,
  origin_required,
  destination_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  purchase_order_required
)
SELECT 
  'Grúa Tercero Pesados',
  'Servicio de grúa pesada ejecutado por proveedor externo',
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  true,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_types WHERE name = 'Grúa Tercero Pesados'
);

INSERT INTO public.service_types (
  name, 
  description, 
  is_active, 
  is_outsourced,
  crane_required, 
  operator_required,
  origin_required,
  destination_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  purchase_order_required
)
SELECT 
  'Rescate Tercero',
  'Rescate vehicular ejecutado por proveedor externo',
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  true,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_types WHERE name = 'Rescate Tercero'
);

INSERT INTO public.service_types (
  name, 
  description, 
  is_active, 
  is_outsourced,
  crane_required, 
  operator_required,
  origin_required,
  destination_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  purchase_order_required
)
SELECT 
  'Apoyo Tercero',
  'Apoyo logístico ejecutado por proveedor externo',
  true,
  true,
  false,
  false,
  true,
  true,
  false,
  false,
  false,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_types WHERE name = 'Apoyo Tercero'
);