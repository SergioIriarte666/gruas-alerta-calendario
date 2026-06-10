
-- Add missing indexes for foreign keys to improve JOIN performance
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_cranes_created_by ON public.cranes(created_by);
CREATE INDEX IF NOT EXISTS idx_operators_created_by ON public.operators(created_by);
CREATE INDEX IF NOT EXISTS idx_service_types_created_by ON public.service_types(created_by);
CREATE INDEX IF NOT EXISTS idx_services_created_by ON public.services(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_service_closures_created_by ON public.service_closures(created_by);
CREATE INDEX IF NOT EXISTS idx_service_closures_client_id ON public.service_closures(client_id);
CREATE INDEX IF NOT EXISTS idx_closure_services_service_id ON public.closure_services(service_id);
CREATE INDEX IF NOT EXISTS idx_invoice_services_service_id ON public.invoice_services(service_id);

-- Remove unused indexes that are not being utilized by current queries
DROP INDEX IF EXISTS idx_services_client_id;
DROP INDEX IF EXISTS idx_services_crane_id;
DROP INDEX IF EXISTS idx_services_operator_id;
DROP INDEX IF EXISTS idx_services_service_type_id;
DROP INDEX IF EXISTS idx_services_status;
DROP INDEX IF EXISTS idx_services_service_date;
DROP INDEX IF EXISTS idx_invoices_client_id;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_cranes_type;
DROP INDEX IF EXISTS idx_clients_rut;
DROP INDEX IF EXISTS idx_operators_rut;
