-- Crear nuevo tipo de servicio "Arriendo de Equipos"
INSERT INTO public.service_types (
  name,
  description,
  is_active,
  purchase_order_required,
  origin_required,
  destination_required,
  crane_required,
  operator_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  vehicle_info_optional,
  base_price
) VALUES (
  'Arriendo de Equipos',
  'Servicio de arriendo de equipos por períodos específicos con fechas de inicio y fin',
  true,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
  0
);