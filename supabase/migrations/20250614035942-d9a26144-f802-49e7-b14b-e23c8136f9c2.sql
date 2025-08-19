
-- Políticas RLS para la tabla clients
CREATE POLICY "Users can view all clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Users can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update clients" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Users can delete clients" ON public.clients FOR DELETE USING (true);

-- Políticas RLS para la tabla operators
CREATE POLICY "Users can view all operators" ON public.operators FOR SELECT USING (true);
CREATE POLICY "Users can insert operators" ON public.operators FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update operators" ON public.operators FOR UPDATE USING (true);
CREATE POLICY "Users can delete operators" ON public.operators FOR DELETE USING (true);

-- Políticas RLS para la tabla cranes
CREATE POLICY "Users can view all cranes" ON public.cranes FOR SELECT USING (true);
CREATE POLICY "Users can insert cranes" ON public.cranes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update cranes" ON public.cranes FOR UPDATE USING (true);
CREATE POLICY "Users can delete cranes" ON public.cranes FOR DELETE USING (true);

-- Políticas RLS para la tabla services
CREATE POLICY "Users can view all services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Users can insert services" ON public.services FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update services" ON public.services FOR UPDATE USING (true);
CREATE POLICY "Users can delete services" ON public.services FOR DELETE USING (true);

-- Políticas RLS para la tabla service_types
CREATE POLICY "Users can view all service_types" ON public.service_types FOR SELECT USING (true);
CREATE POLICY "Users can insert service_types" ON public.service_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update service_types" ON public.service_types FOR UPDATE USING (true);
CREATE POLICY "Users can delete service_types" ON public.service_types FOR DELETE USING (true);

-- Políticas RLS para la tabla invoices
CREATE POLICY "Users can view all invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Users can insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update invoices" ON public.invoices FOR UPDATE USING (true);
CREATE POLICY "Users can delete invoices" ON public.invoices FOR DELETE USING (true);

-- Políticas RLS para la tabla service_closures
CREATE POLICY "Users can view all service_closures" ON public.service_closures FOR SELECT USING (true);
CREATE POLICY "Users can insert service_closures" ON public.service_closures FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update service_closures" ON public.service_closures FOR UPDATE USING (true);
CREATE POLICY "Users can delete service_closures" ON public.service_closures FOR DELETE USING (true);

-- Políticas RLS para las tablas de relación
CREATE POLICY "Users can view all invoice_services" ON public.invoice_services FOR SELECT USING (true);
CREATE POLICY "Users can insert invoice_services" ON public.invoice_services FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update invoice_services" ON public.invoice_services FOR UPDATE USING (true);
CREATE POLICY "Users can delete invoice_services" ON public.invoice_services FOR DELETE USING (true);

CREATE POLICY "Users can view all closure_services" ON public.closure_services FOR SELECT USING (true);
CREATE POLICY "Users can insert closure_services" ON public.closure_services FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update closure_services" ON public.closure_services FOR UPDATE USING (true);
CREATE POLICY "Users can delete closure_services" ON public.closure_services FOR DELETE USING (true);
