-- Actualizar la función calculate_billing_date para facturación mensual diferida
CREATE OR REPLACE FUNCTION public.calculate_billing_date(service_date date, billing_cycle_type text, billing_delay_days integer DEFAULT 0, billing_cycle_day integer DEFAULT NULL::integer)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  service_month_start date;
  next_month date;
  billing_date date;
BEGIN
  IF billing_cycle_type = 'immediate' THEN
    RETURN service_date;
  END IF;
  
  -- Para facturación diferida, todos los servicios de un mes se facturan en el mes siguiente
  -- Calcular el primer día del mes del servicio
  service_month_start := date_trunc('month', service_date)::date;
  
  -- Calcular el mes siguiente más el número de meses de diferimiento
  next_month := (service_month_start + interval '1 month' + (billing_delay_days || ' months')::interval)::date;
  
  -- Si se especifica un día del ciclo, usar ese día, sino usar el día 1
  IF billing_cycle_day IS NOT NULL AND billing_cycle_day BETWEEN 1 AND 28 THEN
    billing_date := date_trunc('month', next_month)::date + (billing_cycle_day - 1);
  ELSE
    -- Por defecto usar el día 5 del mes siguiente
    billing_date := date_trunc('month', next_month)::date + interval '4 days';
  END IF;
  
  RETURN billing_date;
END;
$function$;

-- Actualizar la vista para reflejar la nueva lógica de agrupación mensual
DROP VIEW IF EXISTS public.services_ready_for_deferred_billing;

CREATE VIEW public.services_ready_for_deferred_billing AS
SELECT DISTINCT ON (s.client_id, date_trunc('month', s.service_date))
  gen_random_uuid() as id,
  s.client_id,
  c.name as client_name,
  date_trunc('month', s.service_date)::date as service_month,
  COUNT(s.id) OVER (PARTITION BY s.client_id, date_trunc('month', s.service_date)) as service_count,
  SUM(s.value) OVER (PARTITION BY s.client_id, date_trunc('month', s.service_date)) as total_value,
  public.calculate_billing_date(s.service_date, c.billing_cycle_type, c.billing_delay_days, c.billing_cycle_day) as billing_ready_date,
  c.billing_cycle_type,
  c.billing_delay_days,
  c.billing_cycle_day,
  c.auto_invoice_generation,
  to_char(date_trunc('month', s.service_date), 'YYYY-MM') as service_period
FROM public.services s
JOIN public.clients c ON s.client_id = c.id
WHERE c.billing_cycle_type = 'deferred'
  AND s.status = 'completed'
  AND s.id NOT IN (
    SELECT DISTINCT service_id 
    FROM public.invoice_services 
    WHERE service_id IS NOT NULL
  )
  AND public.calculate_billing_date(s.service_date, c.billing_cycle_type, c.billing_delay_days, c.billing_cycle_day) <= CURRENT_DATE
ORDER BY s.client_id, date_trunc('month', s.service_date), s.service_date;