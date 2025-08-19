
-- Optimize RLS policies for better performance

-- First, drop existing policies that will be replaced
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create optimized policies for profiles table
CREATE POLICY "Profiles access policy" ON public.profiles
  FOR SELECT USING (
    (SELECT auth.uid()) = id OR 
    (SELECT public.get_user_role()) = 'admin'
  );

CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE USING (
    (SELECT auth.uid()) = id OR 
    (SELECT public.get_user_role()) = 'admin'
  );

CREATE POLICY "Profiles insert policy" ON public.profiles
  FOR INSERT WITH CHECK (
    (SELECT public.get_user_role()) = 'admin'
  );

CREATE POLICY "Profiles delete policy" ON public.profiles
  FOR DELETE USING (
    (SELECT public.get_user_role()) = 'admin'
  );

-- Optimize other table policies - consolidate multiple SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and operators can manage clients" ON public.clients;

CREATE POLICY "Clients access policy" ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Clients manage policy" ON public.clients
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Optimize cranes policies
DROP POLICY IF EXISTS "Authenticated users can view cranes" ON public.cranes;
DROP POLICY IF EXISTS "Admins and operators can manage cranes" ON public.cranes;

CREATE POLICY "Cranes access policy" ON public.cranes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Cranes manage policy" ON public.cranes
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Optimize operators policies
DROP POLICY IF EXISTS "Authenticated users can view operators" ON public.operators;
DROP POLICY IF EXISTS "Admins and operators can manage operators" ON public.operators;

CREATE POLICY "Operators access policy" ON public.operators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators manage policy" ON public.operators
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Optimize services policies
DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;
DROP POLICY IF EXISTS "Admins and operators can manage services" ON public.services;

CREATE POLICY "Services access policy" ON public.services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Services manage policy" ON public.services
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Optimize invoices policies
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and operators can manage invoices" ON public.invoices;

CREATE POLICY "Invoices access policy" ON public.invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Invoices manage policy" ON public.invoices
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Optimize company_data policies
DROP POLICY IF EXISTS "Authenticated users can view company data" ON public.company_data;
DROP POLICY IF EXISTS "Admins can manage company data" ON public.company_data;

CREATE POLICY "Company data access policy" ON public.company_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Company data manage policy" ON public.company_data
  FOR ALL USING ((SELECT public.get_user_role()) = 'admin');

-- Optimize service_types policies
DROP POLICY IF EXISTS "Authenticated users can view service types" ON public.service_types;
DROP POLICY IF EXISTS "Admins can manage service types" ON public.service_types;

CREATE POLICY "Service types access policy" ON public.service_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service types manage policy" ON public.service_types
  FOR ALL USING ((SELECT public.get_user_role()) = 'admin');

-- Optimize service_closures policies
DROP POLICY IF EXISTS "Authenticated users can view closures" ON public.service_closures;
DROP POLICY IF EXISTS "Admins and operators can manage closures" ON public.service_closures;

CREATE POLICY "Service closures access policy" ON public.service_closures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service closures manage policy" ON public.service_closures
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Optimize invoice_services policies
DROP POLICY IF EXISTS "Authenticated users can view invoice services" ON public.invoice_services;
DROP POLICY IF EXISTS "Admins and operators can manage invoice services" ON public.invoice_services;

CREATE POLICY "Invoice services access policy" ON public.invoice_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Invoice services manage policy" ON public.invoice_services
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));

-- Optimize closure_services policies
DROP POLICY IF EXISTS "Authenticated users can view closure services" ON public.closure_services;
DROP POLICY IF EXISTS "Admins and operators can manage closure services" ON public.closure_services;

CREATE POLICY "Closure services access policy" ON public.closure_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Closure services manage policy" ON public.closure_services
  FOR ALL USING ((SELECT public.get_user_role()) IN ('admin', 'operator'));
