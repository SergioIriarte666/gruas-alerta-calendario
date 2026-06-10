
-- Primero, eliminar las políticas existentes problemáticas
DROP POLICY IF EXISTS "Allow client to create their own service requests" ON public.services;
DROP POLICY IF EXISTS "Allow client to read their own services" ON public.services;
DROP POLICY IF EXISTS "Users can view services based on role" ON public.services;
DROP POLICY IF EXISTS "Users can manage services based on role" ON public.services;
DROP POLICY IF EXISTS "Operators can view their assigned services" ON public.services;
DROP POLICY IF EXISTS "Admins and operators can manage services" ON public.services;

-- Crear nuevas políticas más permisivas y correctas

-- Política para que los administradores puedan hacer todo
CREATE POLICY "Admins can manage all services" ON public.services
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Política para que los clientes puedan crear servicios para sí mismos
CREATE POLICY "Clients can create their own services" ON public.services
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'client' AND
  client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);

-- Política para que los clientes puedan ver sus propios servicios
CREATE POLICY "Clients can view their own services" ON public.services
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'client' AND
  client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);

-- Política para que los operadores puedan ver servicios asignados a ellos
CREATE POLICY "Operators can view assigned services" ON public.services
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'operator' AND
  operator_id = (SELECT id FROM public.operators WHERE user_id = auth.uid())
);

-- Política para que los operadores puedan actualizar servicios asignados a ellos
CREATE POLICY "Operators can update assigned services" ON public.services
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'operator' AND
  operator_id = (SELECT id FROM public.operators WHERE user_id = auth.uid())
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'operator' AND
  operator_id = (SELECT id FROM public.operators WHERE user_id = auth.uid())
);

-- Política para que los viewers puedan ver todos los servicios
CREATE POLICY "Viewers can view all services" ON public.services
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'viewer'
);
