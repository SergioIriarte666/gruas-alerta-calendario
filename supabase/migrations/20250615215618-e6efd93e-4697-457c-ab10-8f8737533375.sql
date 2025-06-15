
-- This migration refines Row-Level Security policies for more granular, role-based access control.

-- 1. Refine RLS for 'clients' table
-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can manage clients" ON public.clients;

-- Admins/viewers can see all. Operators can see clients related to their assigned services.
CREATE POLICY "Users can view clients based on role" ON public.clients
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND id IN (
      SELECT client_id FROM public.services WHERE operator_id = get_operator_id_by_user(auth.uid())
    ))
  );

-- Only admins can manage clients.
CREATE POLICY "Admins can manage clients" ON public.clients
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- 2. Refine RLS for 'cranes' table
-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can view cranes" ON public.cranes;
DROP POLICY IF EXISTS "Admins and operators can manage cranes" ON public.cranes;

-- Admins/viewers can see all. Operators can see cranes used in their services.
CREATE POLICY "Users can view cranes based on role" ON public.cranes
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND id IN (
      SELECT crane_id FROM public.services WHERE operator_id = get_operator_id_by_user(auth.uid())
    ))
  );

-- Only admins can manage cranes.
CREATE POLICY "Admins can manage cranes" ON public.cranes
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- 3. Refine RLS for 'invoices' and related tables
-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and operators can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view invoice services" ON public.invoice_services;
DROP POLICY IF EXISTS "Admins and operators can manage invoice services" ON public.invoice_services;

-- Admins/viewers can see all invoices.
CREATE POLICY "Admin and viewers can view invoices" ON public.invoices
  FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'viewer'));
-- Only admins can manage invoices.
CREATE POLICY "Admins can manage invoices" ON public.invoices
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Admins/viewers can see all invoice services.
CREATE POLICY "Admin and viewers can view invoice services" ON public.invoice_services
  FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'viewer'));
-- Only admins can manage invoice services.
CREATE POLICY "Admins can manage invoice services" ON public.invoice_services
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- 4. Refine RLS for 'service_closures' and related tables
-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can view closures" ON public.service_closures;
DROP POLICY IF EXISTS "Admins and operators can manage closures" ON public.service_closures;
DROP POLICY IF EXISTS "Authenticated users can view closure services" ON public.closure_services;
DROP POLICY IF EXISTS "Admins and operators can manage closure services" ON public.closure_services;

-- Admins/viewers can see all closures.
CREATE POLICY "Admin and viewers can view closures" ON public.service_closures
  FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'viewer'));
-- Only admins can manage closures.
CREATE POLICY "Admins can manage closures" ON public.service_closures
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Admins/viewers can see all closure services.
CREATE POLICY "Admin and viewers can view closure services" ON public.closure_services
  FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'viewer'));
-- Only admins can manage closure services.
CREATE POLICY "Admins can manage closure services" ON public.closure_services
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- 5. Refine RLS for 'company_data'
-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can view company data" ON public.company_data;
DROP POLICY IF EXISTS "Admins can manage company data" ON public.company_data;

-- Admins/viewers can view company data.
CREATE POLICY "Admins and viewers can view company data" ON public.company_data
  FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'viewer'));
-- Only admins can update company data.
CREATE POLICY "Admins can update company data" ON public.company_data
  FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');
  
-- 6. Add RLS for 'costs' table
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;

-- Admins/viewers can see all. Operators can see their own costs.
CREATE POLICY "Users can view costs based on role" ON public.costs
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );

-- Admins and operators can create costs.
CREATE POLICY "Admins and operators can create costs" ON public.costs
  FOR INSERT
  WITH CHECK (
    (get_user_role(auth.uid()) = 'admin')
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );

-- Admins can update all. Operators can update their own.
CREATE POLICY "Admins and operators can manage their costs" ON public.costs
  FOR UPDATE
  USING (
    (get_user_role(auth.uid()) = 'admin')
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  )
  WITH CHECK (
    (get_user_role(auth.uid()) = 'admin')
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );
  
-- Only admins can delete costs.
CREATE POLICY "Admins can delete costs" ON public.costs
  FOR DELETE
  USING (get_user_role(auth.uid()) = 'admin');

-- 7. Add RLS for 'cost_categories' table
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see cost categories, as it's needed for context.
CREATE POLICY "Authenticated users can view cost categories" ON public.cost_categories
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can manage cost categories.
CREATE POLICY "Admins can manage cost categories" ON public.cost_categories
    FOR ALL
    USING (get_user_role(auth.uid()) = 'admin');

