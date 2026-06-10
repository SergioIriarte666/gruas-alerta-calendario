
-- Primero, obtener el user_id del usuario siriartev@gmail.com
-- y crear un operador para este usuario
INSERT INTO public.operators (
  name,
  rut,
  phone,
  license_number,
  exam_expiry,
  is_active,
  user_id,
  created_at,
  updated_at
)
SELECT 
  'Sergio Iriarte Vega',
  '12.345.678-9',
  '+56 9 8765 4321',
  'LIC-12345',
  '2025-12-31',
  true,
  p.id,
  now(),
  now()
FROM public.profiles p
WHERE p.email = 'siriartev@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.operators o WHERE o.user_id = p.id
);

-- Asignar algunos servicios existentes al nuevo operador
UPDATE public.services 
SET operator_id = (
  SELECT o.id 
  FROM public.operators o 
  JOIN public.profiles p ON o.user_id = p.id 
  WHERE p.email = 'siriartev@gmail.com'
)
WHERE folio IN ('SRV-001', 'SRV-002')
AND status IN ('pending', 'in_progress');

-- Si no hay servicios con esos folios, actualizar los primeros 2 servicios pendientes
UPDATE public.services 
SET operator_id = (
  SELECT o.id 
  FROM public.operators o 
  JOIN public.profiles p ON o.user_id = p.id 
  WHERE p.email = 'siriartev@gmail.com'
)
WHERE id IN (
  SELECT id 
  FROM public.services 
  WHERE status = 'pending' 
  LIMIT 2
)
AND operator_id != (
  SELECT o.id 
  FROM public.operators o 
  JOIN public.profiles p ON o.user_id = p.id 
  WHERE p.email = 'siriartev@gmail.com'
);
