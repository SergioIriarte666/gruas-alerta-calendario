-- MIGRACIÓN FINAL - Arreglar las 3 funciones restantes con search_path mutable

-- 1. Arreglar handle_new_user - Función crítica de auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Arreglar get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '';

-- 3. Arreglar update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 4. Habilitar protección de contraseñas comprometidas
-- Esto no se puede hacer por SQL, pero agregamos un comentario para recordar

-- Mensaje final de verificación
DO $$
BEGIN
  RAISE NOTICE 'MIGRACIÓN COMPLETADA: Todas las funciones críticas ahora tienen search_path inmutable. Protección de contraseñas debe habilitarse manualmente en el dashboard.';
END $$;