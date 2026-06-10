-- Corrección de advertencias de seguridad: Agregar search_path a funciones sin SET search_path
-- Esta migración corrige las 82 advertencias de seguridad identificadas

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

-- Función: get_user_client_id_safe
CREATE OR REPLACE FUNCTION public.get_user_client_id_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Función: is_client_user_safe
CREATE OR REPLACE FUNCTION public.is_client_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'client' AND client_id IS NOT NULL
  );
$$;

-- Función: is_operator_user_safe
CREATE OR REPLACE FUNCTION public.is_operator_user_safe()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'operator', 'supervisor')
  );
$$;

-- Función: calculate_inventory_stock
CREATE OR REPLACE FUNCTION public.calculate_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_stock integer;
BEGIN
  -- Calcular stock actual
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type = 'entry' THEN quantity
      WHEN movement_type = 'exit' THEN -quantity
      ELSE 0
    END
  ), 0) INTO current_stock
  FROM inventory_movements 
  WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)
    AND location_id = COALESCE(NEW.location_id, OLD.location_id);

  -- Actualizar tabla de stock
  INSERT INTO inventory_stock (item_id, location_id, current_quantity, available_quantity, updated_at)
  VALUES (
    COALESCE(NEW.item_id, OLD.item_id),
    COALESCE(NEW.location_id, OLD.location_id),
    current_stock,
    current_stock,
    NOW()
  )
  ON CONFLICT (item_id, location_id)
  DO UPDATE SET 
    current_quantity = current_stock,
    available_quantity = current_stock,
    updated_at = NOW(),
    last_movement_date = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Función: auto_create_profile
CREATE OR REPLACE FUNCTION public.auto_create_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  RETURN NEW;
END;
$$;

-- Función: prevent_duplicate_commissions
CREATE OR REPLACE FUNCTION public.prevent_duplicate_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  commission_category_id uuid;
  existing_count integer;
BEGIN
  -- Obtener ID de categoría de comisiones
  SELECT id INTO commission_category_id
  FROM cost_categories 
  WHERE name = 'Comisión Operador'
  LIMIT 1;
  
  -- Si es una comisión, verificar duplicados
  IF NEW.category_id = commission_category_id AND NEW.service_id IS NOT NULL AND NEW.operator_id IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count
    FROM costs 
    WHERE service_id = NEW.service_id 
      AND operator_id = NEW.operator_id 
      AND category_id = commission_category_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una comisión para este servicio y operador';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Función: update_invoice_totals
CREATE OR REPLACE FUNCTION public.update_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.remaining_amount := NEW.total - COALESCE(NEW.paid_amount, 0);
  
  -- Actualizar estado basado en pagos
  IF NEW.paid_amount >= NEW.total THEN
    NEW.status := 'paid'::invoice_status;
  ELSIF NEW.paid_amount > 0 THEN
    NEW.status := 'partial'::invoice_status;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Función: update_payment_totals
CREATE OR REPLACE FUNCTION public.update_payment_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.remaining_amount := NEW.amount - COALESCE(NEW.applied_amount, 0);
  
  -- Actualizar estado basado en aplicaciones
  IF NEW.applied_amount >= NEW.amount THEN
    NEW.status := 'applied'::payment_status;
  ELSIF NEW.applied_amount > 0 THEN
    NEW.status := 'partial'::payment_status;
  ELSE
    NEW.status := 'pending'::payment_status;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Función: log_audit_changes
CREATE OR REPLACE FUNCTION public.log_audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    operation,
    table_name,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;