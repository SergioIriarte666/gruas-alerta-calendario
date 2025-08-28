-- Fix security warnings: Add search_path to all functions missing it

-- Update functions that are missing search_path parameter
CREATE OR REPLACE FUNCTION public.validate_email(email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Basic email validation
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$function$;

-- Update all other functions to include search_path where missing
-- Note: Many functions already have SET search_path TO 'public' from previous migration

-- Update sync_maintenance_costs function
CREATE OR REPLACE FUNCTION public.sync_maintenance_costs()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  synced_count INTEGER := 0;
  maintenance_record RECORD;
  maintenance_category_id UUID;
  cost_description TEXT;
  cost_subcategory TEXT;
BEGIN
  -- Get maintenance category
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name = 'Mantenimiento'
  LIMIT 1;
  
  -- If category doesn't exist, create it
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones de grúas')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Loop through completed maintenances without associated costs
  FOR maintenance_record IN 
    SELECT cm.*
    FROM public.crane_maintenance cm
    WHERE cm.status = 'completed' 
      AND cm.cost > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.costs c WHERE c.maintenance_id = cm.id
      )
  LOOP
    -- Build description
    cost_description := 'Mantenimiento: ' || maintenance_record.description;
    IF maintenance_record.provider IS NOT NULL THEN
      cost_description := cost_description || ' - Proveedor: ' || maintenance_record.provider;
    END IF;
    
    -- Determine subcategory
    cost_subcategory := CASE 
      WHEN maintenance_record.maintenance_type ILIKE '%preventivo%' THEN 'Mantenimiento Preventivo'
      WHEN maintenance_record.maintenance_type ILIKE '%correctivo%' OR maintenance_record.maintenance_type ILIKE '%reparaci%' THEN 'Reparaciones'
      WHEN maintenance_record.maintenance_type ILIKE '%repuesto%' OR maintenance_record.maintenance_type ILIKE '%pieza%' THEN 'Piezas y Repuestos'
      WHEN maintenance_record.maintenance_type ILIKE '%revision%' OR maintenance_record.maintenance_type ILIKE '%inspecci%' THEN 'Inspecciones'
      ELSE 'Mantenimiento General'
    END;
    
    -- Try to insert with unique timestamp to avoid duplicates
    BEGIN
      INSERT INTO public.costs (
        amount,
        category_id,
        crane_id,
        date,
        description,
        notes,
        subcategory,
        maintenance_id,
        created_by,
        created_at
      ) VALUES (
        maintenance_record.cost,
        maintenance_category_id,
        maintenance_record.crane_id,
        COALESCE(maintenance_record.completed_date, maintenance_record.scheduled_date, maintenance_record.created_at::date),
        cost_description,
        'Costo migrado automáticamente desde mantenimiento histórico' ||
        CASE WHEN maintenance_record.notes IS NOT NULL THEN '. Notas: ' || maintenance_record.notes ELSE '' END,
        cost_subcategory,
        maintenance_record.id,
        maintenance_record.created_by,
        maintenance_record.created_at + (synced_count * INTERVAL '1 second') -- Add offset to avoid duplicates
      );
      
      synced_count := synced_count + 1;
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE NOTICE 'Error syncing maintenance %: %', maintenance_record.id, SQLERRM;
        CONTINUE;
    END;
  END LOOP;
  
  RETURN format('Sincronizados %s mantenimientos con costos', synced_count);
END;
$function$;

-- Create or update RLS policy functions
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
  ORDER BY i.due_date ASC;
END;
$function$;

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
  ORDER BY i.due_date ASC;
END;
$function$;

-- Add proper RLS policies for notifications
CREATE OR REPLACE FUNCTION public.insert_notification_if_not_exists(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_logs (user_id, type, title, body, data)
  SELECT p_user_id, p_type, p_title, p_body, p_data
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_logs
    WHERE user_id = p_user_id 
      AND type = p_type 
      AND title = p_title
      AND created_at > (NOW() - INTERVAL '1 hour')
  );
END;
$function$;