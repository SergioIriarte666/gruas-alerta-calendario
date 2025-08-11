
-- Insertar operadores de ejemplo para que el sistema funcione
INSERT INTO public.operators (
  id,
  name,
  rut,
  phone,
  license_number,
  exam_expiry,
  is_active,
  created_at,
  updated_at
) VALUES 
(
  gen_random_uuid(),
  'Juan Carlos Pérez',
  '12.345.678-9',
  '+56912345678',
  'D5-12345',
  '2025-12-31',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'María Elena González',
  '98.765.432-1',
  '+56987654321',
  'D5-67890',
  '2025-06-30',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'Roberto Silva Martinez',
  '11.222.333-4',
  '+56911222333',
  'D5-11111',
  '2025-09-15',
  true,
  now(),
  now()
);

-- También agregar algunas grúas de ejemplo con los tipos correctos del enum
INSERT INTO public.cranes (
  id,
  license_plate,
  brand,
  model,
  type,
  circulation_permit_expiry,
  insurance_expiry,
  technical_review_expiry,
  is_active,
  created_at,
  updated_at
) VALUES 
(
  gen_random_uuid(),
  'GRUA-001',
  'Mercedes-Benz',
  'Actros 2642',
  'heavy',
  '2025-12-31',
  '2025-12-31',
  '2025-06-30',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'GRUA-002',
  'Volvo',
  'FH16',
  'medium',
  '2025-12-31',
  '2025-12-31',
  '2025-09-15',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'GRUA-003',
  'Scania',
  'R450',
  'light',
  '2025-12-31',
  '2025-12-31',
  '2025-08-20',
  true,
  now(),
  now()
);
