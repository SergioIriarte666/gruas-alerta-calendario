
-- Limpiar perfiles duplicados manteniendo solo el más reciente por email
WITH duplicates AS (
  SELECT id, email, role, created_at,
    ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
  FROM public.profiles
)
DELETE FROM public.profiles 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Agregar constraint único en email para prevenir duplicados futuros
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Crear función para prevenir duplicados en el trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar si ya existe un perfil para este usuario
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un perfil con este email
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = NEW.email) THEN
    RAISE NOTICE 'Profile with email % already exists', NEW.email;
    RETURN NEW;
  END IF;

  -- Insertar nuevo perfil solo si no existe
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer'
  );
  
  RETURN NEW;
END;
$$;

-- Crear función para limpiar duplicados automáticamente
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Eliminar perfiles duplicados por email, manteniendo el más reciente
  WITH duplicates AS (
    SELECT id, email, role, created_at,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.profiles
  )
  DELETE FROM public.profiles 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  RAISE NOTICE 'Duplicate profiles cleanup completed';
END;
$$;
