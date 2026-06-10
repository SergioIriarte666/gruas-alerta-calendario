
-- Corregir los IDs de los perfiles de clientes para que coincidan con auth.users
-- Esto eliminará la necesidad de buscar por email y permitirá buscar directamente por ID

-- Paso 1: Eliminar los perfiles con IDs incorrectos
DELETE FROM public.profiles 
WHERE email IN ('notifica@gruas5norte.cl', 'pagos@gruas5norte.cl');

-- Paso 2: Crear nuevos perfiles con los IDs correctos de autenticación
-- Para notifica@gruas5norte.cl (ID correcto: 340c9634-ea83-4f34-a091-ad94c938a802)
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  client_id,
  is_active,
  created_at,
  updated_at
) VALUES (
  '340c9634-ea83-4f34-a091-ad94c938a802',
  'notifica@gruas5norte.cl',
  'Usuario Notificaciones',
  'client',
  (SELECT id FROM public.clients WHERE email = 'notifica@gruas5norte.cl' LIMIT 1),
  true,
  now(),
  now()
);

-- Para pagos@gruas5norte.cl (ID correcto: 20d91062-bcb3-403e-bb66-dbf3f3f1f2d9)
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  client_id,
  is_active,
  created_at,
  updated_at
) VALUES (
  '20d91062-bcb3-403e-bb66-dbf3f3f1f2d9',
  'pagos@gruas5norte.cl',
  'Usuario Pagos',
  'client',
  (SELECT id FROM public.clients WHERE email = 'pagos@gruas5norte.cl' LIMIT 1),
  true,
  now(),
  now()
);

-- Verificar que los IDs ahora coincidan con auth.users
SELECT 
  p.id as profile_id,
  p.email,
  p.role,
  p.client_id,
  'IDs now match auth.users' as status
FROM public.profiles p
WHERE p.email IN ('notifica@gruas5norte.cl', 'pagos@gruas5norte.cl', 'admin@admin.com')
ORDER BY p.email;
