-- Crear tipo de servicio especial para ventas de productos
INSERT INTO public.service_types (
  name,
  description,
  base_price,
  is_active,
  vehicle_info_optional,
  purchase_order_required,
  origin_required,
  destination_required,
  crane_required,
  operator_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required
) VALUES (
  'Venta de Productos',
  'Venta esporádica de productos y repuestos del inventario a clientes',
  0,
  true,
  true,  -- La información del vehículo es opcional para ventas
  false, -- No requiere orden de compra
  false, -- No requiere origen
  false, -- No requiere destino
  false, -- No requiere grúa
  false, -- No requiere operador
  false, -- No requiere marca de vehículo
  false, -- No requiere modelo de vehículo
  false  -- No requiere placa
) ON CONFLICT DO NOTHING;