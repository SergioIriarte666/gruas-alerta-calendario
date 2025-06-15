
-- Paso 1: Limpiar políticas RLS conflictivas en la tabla services
DROP POLICY IF EXISTS "Users can view all services" ON public.services;
DROP POLICY IF EXISTS "Users can insert services" ON public.services;
DROP POLICY IF EXISTS "Users can update services" ON public.services;
DROP POLICY IF EXISTS "Users can delete services" ON public.services;
DROP POLICY IF EXISTS "Services access policy" ON public.services;
DROP POLICY IF EXISTS "Services manage policy" ON public.services;

-- Crear políticas RLS específicas y claras para operadores
CREATE POLICY "Operators can view their assigned services" ON public.services
  FOR SELECT USING (
    operator_id = public.get_operator_id_by_user(auth.uid()) OR
    (SELECT public.get_user_role()) IN ('admin', 'operator')
  );

CREATE POLICY "Admins and operators can manage services" ON public.services
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Paso 2: Crear un servicio de prueba para admin@admin.com
-- Primero verificamos que tenemos los datos necesarios
INSERT INTO public.services (
  folio,
  request_date,
  service_date,
  client_id,
  purchase_order,
  vehicle_brand,
  vehicle_model,
  license_plate,
  origin,
  destination,
  service_type_id,
  value,
  crane_id,
  operator_id,
  operator_commission,
  status,
  observations
) VALUES (
  'TEST-2025-001',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 day',
  (SELECT id FROM public.clients LIMIT 1),
  'PO-TEST-001',
  'Toyota',
  'Corolla',
  'ABC-123',
  'Santiago Centro',
  'Las Condes',
  (SELECT id FROM public.service_types LIMIT 1),
  150000,
  (SELECT id FROM public.cranes LIMIT 1),
  (SELECT id FROM public.operators WHERE user_id = '51b278d5-bce2-46be-a050-22b3c1e2ecb6' LIMIT 1),
  15000,
  'pending',
  'Servicio de prueba para testing del portal del operador'
);

-- Crear otro servicio en progreso
INSERT INTO public.services (
  folio,
  request_date,
  service_date,
  client_id,
  purchase_order,
  vehicle_brand,
  vehicle_model,
  license_plate,
  origin,
  destination,
  service_type_id,
  value,
  crane_id,
  operator_id,
  operator_commission,
  status,
  observations
) VALUES (
  'TEST-2025-002',
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE,
  (SELECT id FROM public.clients LIMIT 1),
  'PO-TEST-002',
  'Nissan',
  'Sentra',
  'XYZ-789',
  'Providencia',
  'Ñuñoa',
  (SELECT id FROM public.service_types LIMIT 1),
  200000,
  (SELECT id FROM public.cranes LIMIT 1),
  (SELECT id FROM public.operators WHERE user_id = '51b278d5-bce2-46be-a050-22b3c1e2ecb6' LIMIT 1),
  20000,
  'in_progress',
  'Segundo servicio de prueba en progreso'
);
