-- ACTUALIZAR POLÍTICAS RLS PARA RESOLVER RECURSIÓN INFINITA - PARTE 2
-- =======================================================================================

-- TABLA: invoices - Reemplazar política recursiva
DROP POLICY IF EXISTS "invoices_auth_only" ON public.invoices;
CREATE POLICY "invoices_authenticated_access" 
ON public.invoices 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- TABLA: invoice_closures - Reemplazar política recursiva
DROP POLICY IF EXISTS "invoice_closures_auth_only" ON public.invoice_closures;
CREATE POLICY "invoice_closures_authenticated_access" 
ON public.invoice_closures 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- TABLA: invoice_services - Reemplazar política recursiva
DROP POLICY IF EXISTS "invoice_services_auth_only" ON public.invoice_services;
CREATE POLICY "invoice_services_authenticated_access" 
ON public.invoice_services 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- TABLA: profiles - Políticas más específicas y seguras
DROP POLICY IF EXISTS "profiles_own_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

CREATE POLICY "profiles_self_access" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- TABLA: services - Mejorar políticas sin recursión
DROP POLICY IF EXISTS "services_admin_full_access" ON public.services;
DROP POLICY IF EXISTS "services_operator_access" ON public.services;
DROP POLICY IF EXISTS "services_client_own_data" ON public.services;

CREATE POLICY "services_admin_full_access" 
ON public.services 
FOR ALL 
TO authenticated
USING (is_admin_user_safe());

CREATE POLICY "services_operator_access" 
ON public.services 
FOR ALL 
TO authenticated
USING (is_operator_user_safe());

CREATE POLICY "services_client_own_data" 
ON public.services 
FOR SELECT 
TO authenticated
USING (is_client_user_safe() AND client_id = get_user_client_id_safe());

-- TABLA: costs - Mejorar políticas sin recursión
DROP POLICY IF EXISTS "costs_admin_full_access" ON public.costs;
DROP POLICY IF EXISTS "costs_operator_access" ON public.costs;
DROP POLICY IF EXISTS "costs_client_own_services" ON public.costs;

CREATE POLICY "costs_admin_full_access" 
ON public.costs 
FOR ALL 
TO authenticated
USING (is_admin_user_safe());

CREATE POLICY "costs_operator_access" 
ON public.costs 
FOR SELECT 
TO authenticated
USING (is_operator_user_safe());

-- Para clientes, solo pueden ver costos de sus propios servicios
CREATE POLICY "costs_client_own_services" 
ON public.costs 
FOR SELECT 
TO authenticated
USING (
  is_client_user_safe() AND 
  service_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.services s 
    WHERE s.id = costs.service_id 
    AND s.client_id = get_user_client_id_safe()
  )
);

-- TABLA: clients - Mejorar políticas sin recursión
DROP POLICY IF EXISTS "clients_admin_operator_access" ON public.clients;
DROP POLICY IF EXISTS "clients_own_data" ON public.clients;

CREATE POLICY "clients_admin_operator_access" 
ON public.clients 
FOR ALL 
TO authenticated
USING (is_operator_user_safe());

CREATE POLICY "clients_own_data" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (is_client_user_safe() AND id = get_user_client_id_safe());