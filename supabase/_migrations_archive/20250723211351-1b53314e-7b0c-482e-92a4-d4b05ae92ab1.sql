-- Crear la comisión que falta para el servicio 3008437-1
INSERT INTO public.costs (
  date,
  description,
  amount,
  category_id,
  operator_id,
  service_id,
  service_folio,
  subcategory,
  cost_center_id
) VALUES (
  '2025-07-20',
  'Comisión por servicio 3008437-1 - Jesus Rojas',
  150000,
  '440296d4-09c2-4f3a-b02b-835f861df4c4',  -- Category ID for "Comisión Operador"
  '987a2f79-73be-4d0f-9398-6bca07132dcd',  -- Jesus Rojas operator ID
  'ff01d4cf-0e20-4750-a195-aca55c4a2a0f',  -- Service ID for 3008437-1
  '3008437-1',
  'comisiones',
  'fddd6660-d149-4be8-8067-96856fc4cadb'   -- Default cost center
);