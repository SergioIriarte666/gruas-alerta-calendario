-- 1) Renombrar email del perfil pre-registrado para liberar el UNIQUE(email)
UPDATE public.profiles
SET email = email || '__legacy__' || substring(id::text, 1, 8),
    updated_at = now()
WHERE id = 'dc74a82e-19ef-414a-a662-1b1b5990affe';

-- 2) Crear el perfil "real" con el mismo id del usuario Auth
INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
VALUES (
  'bb6d8e6e-d13f-464b-9fe2-951f6464f7ea',
  'pagos@gruas5norte.cl',
  'pagos@gruas5norte.cl',
  'operator',
  true,
  now(),
  now()
);

-- 3) Relink del operador al nuevo profile id
UPDATE public.operators
SET user_id = 'bb6d8e6e-d13f-464b-9fe2-951f6464f7ea'
WHERE user_id = 'dc74a82e-19ef-414a-a662-1b1b5990affe';

-- 4) Relink de invitaciones al nuevo profile id
UPDATE public.user_invitations
SET user_id = 'bb6d8e6e-d13f-464b-9fe2-951f6464f7ea'
WHERE user_id = 'dc74a82e-19ef-414a-a662-1b1b5990affe';