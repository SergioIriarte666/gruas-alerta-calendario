-- Corregir la función calculate_billing_date para usar días, no meses
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
  
  -- Calcular el mes siguiente más los DÍAS de diferimiento
  next_month := (service_month_start + interval '1 month' + (billing_delay_days || ' days')::interval)::date;
  
  -- Si se especifica un día del ciclo, usar ese día, sino usar el día 5
  IF billing_cycle_day IS NOT NULL AND billing_cycle_day BETWEEN 1 AND 28 THEN
    -- Ajustar al día específico del mes
    billing_date := date_trunc('month', next_month)::date + (billing_cycle_day - 1);
  ELSE
    -- Por defecto usar el día 5 del mes
    billing_date := date_trunc('month', next_month)::date + interval '4 days';
  END IF;
  
  RETURN billing_date;
END;
$function$;