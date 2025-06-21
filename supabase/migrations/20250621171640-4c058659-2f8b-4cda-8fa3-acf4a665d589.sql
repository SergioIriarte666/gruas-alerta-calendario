
-- Verificar el usuario actual y asignar rol de admin
UPDATE public.profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'siriartev@gmail.com';

-- Verificar que el cambio se aplicó correctamente
SELECT id, email, full_name, role, is_active 
FROM public.profiles 
WHERE email = 'siriartev@gmail.com';
