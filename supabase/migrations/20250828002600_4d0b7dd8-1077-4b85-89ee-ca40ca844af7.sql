-- Corrección de advertencias de seguridad: Agregar search_path a funciones
-- Corrigiendo el error del enum app_role

-- Función: get_overdue_invoices_for_alerts
CREATE OR REPLACE FUNCTION public.get_overdue_invoices_for_alerts()
RETURNS TABLE(
  id uuid,
  folio text,
  client_name text,
  due_date date,
  total numeric,
  days_overdue integer,
  status invoice_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.folio,
    c.name as client_name,
    i.due_date,
    i.total,
    (CURRENT_DATE - i.due_date)::integer as days_overdue,
    i.status
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  WHERE i.status IN ('sent', 'overdue', 'partial')
    AND i.due_date < CURRENT_DATE
    AND (i.total - COALESCE(i.paid_amount, 0)) > 0
  ORDER BY i.due_date ASC;
END;
$$;

-- Función: get_invoices_due_soon
CREATE OR REPLACE FUNCTION public.get_invoices_due_soon(days_ahead integer DEFAULT 7)
RETURNS TABLE(
  id uuid,
  folio text,
  client_name text,
  due_date date,
  total numeric,
  days_until_due integer,
  status invoice_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.folio,
    c.name as client_name,
    i.due_date,
    i.total,
    (i.due_date - CURRENT_DATE)::integer as days_until_due,
    i.status
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  WHERE i.status IN ('sent', 'partial')
    AND i.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead)
    AND (i.total - COALESCE(i.paid_amount, 0)) > 0
  ORDER BY i.due_date ASC;
END;
$$;

-- Función: is_operator_user_safe (corrigiendo enum)
CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  );
$$;