
-- Habilitar RLS en las tablas principales si no está habilitado
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla services
DROP POLICY IF EXISTS "Users can view services based on role" ON public.services;
CREATE POLICY "Users can view services based on role" ON public.services
FOR SELECT USING (
  CASE 
    WHEN get_current_user_role() = 'admin' THEN true
    WHEN get_current_user_role() = 'viewer' THEN true
    WHEN get_current_user_role() = 'operator' THEN 
      operator_id = get_operator_id_by_user(auth.uid())
    WHEN get_current_user_role() = 'client' THEN 
      client_id = get_client_id_for_user(auth.uid())
    ELSE false
  END
);

DROP POLICY IF EXISTS "Users can insert services based on role" ON public.services;
CREATE POLICY "Users can insert services based on role" ON public.services
FOR INSERT WITH CHECK (
  get_current_user_role() IN ('admin', 'viewer')
);

DROP POLICY IF EXISTS "Users can update services based on role" ON public.services;
CREATE POLICY "Users can update services based on role" ON public.services
FOR UPDATE USING (
  CASE 
    WHEN get_current_user_role() = 'admin' THEN true
    WHEN get_current_user_role() = 'viewer' THEN true
    WHEN get_current_user_role() = 'operator' THEN 
      operator_id = get_operator_id_by_user(auth.uid())
    ELSE false
  END
);

-- Políticas para la tabla clients
DROP POLICY IF EXISTS "Users can view clients based on role" ON public.clients;
CREATE POLICY "Users can view clients based on role" ON public.clients
FOR SELECT USING (
  CASE 
    WHEN get_current_user_role() = 'admin' THEN true
    WHEN get_current_user_role() = 'viewer' THEN true
    WHEN get_current_user_role() = 'operator' THEN true
    WHEN get_current_user_role() = 'client' THEN 
      id = get_client_id_for_user(auth.uid())
    ELSE false
  END
);

-- Políticas para la tabla operators
DROP POLICY IF EXISTS "Users can view operators based on role" ON public.operators;
CREATE POLICY "Users can view operators based on role" ON public.operators
FOR SELECT USING (
  CASE 
    WHEN get_current_user_role() = 'admin' THEN true
    WHEN get_current_user_role() = 'viewer' THEN true
    WHEN get_current_user_role() = 'operator' THEN 
      user_id = auth.uid()
    ELSE false
  END
);

-- Políticas para la tabla cranes
DROP POLICY IF EXISTS "Users can view cranes based on role" ON public.cranes;
CREATE POLICY "Users can view cranes based on role" ON public.cranes
FOR SELECT USING (
  get_current_user_role() IN ('admin', 'viewer', 'operator')
);

-- Políticas para la tabla service_types
DROP POLICY IF EXISTS "Users can view service_types based on role" ON public.service_types;
CREATE POLICY "Users can view service_types based on role" ON public.service_types
FOR SELECT USING (
  get_current_user_role() IN ('admin', 'viewer', 'operator', 'client')
);

-- Políticas para la tabla profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (
  id = auth.uid() OR get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (
  id = auth.uid() OR get_current_user_role() = 'admin'
);
