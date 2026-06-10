CREATE OR REPLACE FUNCTION public.get_overdue_invoices_for_alerts()
 RETURNS TABLE(id uuid, folio text, client_name text, due_date date, total numeric, days_overdue integer, status invoice_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM public.invoices i
  JOIN public.clients c ON i.client_id = c.id
  WHERE i.status IN ('sent', 'overdue')
    AND i.due_date < CURRENT_DATE
    AND i.folio NOT LIKE 'HIST-%'
  ORDER BY i.due_date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_invoices_due_soon(days_ahead integer DEFAULT 7)
 RETURNS TABLE(id uuid, folio text, client_name text, due_date date, total numeric, days_until_due integer, status invoice_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM public.invoices i
  JOIN public.clients c ON i.client_id = c.id
  WHERE i.status IN ('sent', 'partial')
    AND i.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead)
    AND i.folio NOT LIKE 'HIST-%'
  ORDER BY i.due_date ASC;
END;
$function$;