CREATE OR REPLACE FUNCTION public.normalize_inventory_movement_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  business_tz text;
  now_business timestamptz;
  today_business date;
BEGIN
  SELECT COALESCE(report_timezone, 'America/Santiago')
    INTO business_tz
  FROM public.company_data
  LIMIT 1;
  business_tz := COALESCE(business_tz, 'America/Santiago');

  now_business := now();
  today_business := (now_business AT TIME ZONE business_tz)::date;

  -- Si movement_date llega como medianoche UTC y representa "hoy" en TZ negocio,
  -- vino como string YYYY-MM-DD sin hora -> reemplazar por timestamp real.
  IF NEW.movement_date IS NOT NULL
     AND EXTRACT(HOUR FROM NEW.movement_date AT TIME ZONE 'UTC') = 0
     AND EXTRACT(MINUTE FROM NEW.movement_date AT TIME ZONE 'UTC') = 0
     AND EXTRACT(SECOND FROM NEW.movement_date AT TIME ZONE 'UTC') = 0
     AND (NEW.movement_date AT TIME ZONE business_tz)::date = today_business
  THEN
    NEW.movement_date := now_business;
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now_business;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_inventory_movement_timestamp ON public.inventory_movements;
CREATE TRIGGER trg_normalize_inventory_movement_timestamp
  BEFORE INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_inventory_movement_timestamp();