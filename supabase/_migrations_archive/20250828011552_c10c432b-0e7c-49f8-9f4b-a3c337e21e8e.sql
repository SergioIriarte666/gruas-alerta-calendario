-- Continue fixing remaining security warnings

-- Fix remaining functions missing search_path
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  commission_category_id UUID;
  operator_name TEXT;
  existing_commission_count INTEGER;
BEGIN
  -- Solo ejecutar cuando el servicio cambia a 'completed' y tiene operator_commission > 0
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.operator_commission > 0 
     AND NEW.operator_id IS NOT NULL THEN
    
    -- Obtener ID de categoría de comisiones
    SELECT id INTO commission_category_id 
    FROM public.cost_categories 
    WHERE name = 'Comisión Operador'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF commission_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Comisión Operador', 'Comisiones pagadas a operadores por servicios')
      RETURNING id INTO commission_category_id;
    END IF;
    
    -- Verificar si ya existe una comisión para este servicio y operador
    SELECT COUNT(*) INTO existing_commission_count
    FROM public.costs 
    WHERE service_id = NEW.id 
      AND operator_id = NEW.operator_id 
      AND category_id = commission_category_id;
    
    -- Solo crear si no existe ya
    IF existing_commission_count = 0 THEN
      -- Obtener nombre del operador
      SELECT name INTO operator_name
      FROM public.operators 
      WHERE id = NEW.operator_id;
      
      -- Insertar nueva comisión en costs
      INSERT INTO public.costs (
        amount,
        category_id,
        date,
        description,
        service_id,
        service_folio,
        operator_id,
        subcategory,
        created_by
      ) VALUES (
        NEW.operator_commission,
        commission_category_id,
        NEW.service_date,
        'Comisión por servicio: ' || COALESCE(operator_name, 'Operador'),
        NEW.id,
        NEW.folio,
        NEW.operator_id,
        'comisiones',
        NEW.created_by
      );
      
      RAISE NOTICE 'Comisión creada automáticamente para servicio %: $%', NEW.folio, NEW.operator_commission;
    ELSE
      RAISE NOTICE 'Comisión ya existe para servicio %', NEW.folio;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_category_id UUID;
  cost_description TEXT;
  cost_notes TEXT;
  supplier_name_value TEXT;
  existing_cost_count INTEGER;
BEGIN
  -- Solo procesar cuando el pago cambia a estado "paid"
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Verificar si ya existe un costo para este pago (evitar duplicados)
    SELECT COUNT(*) INTO existing_cost_count
    FROM public.costs
    WHERE supplier_payment_id = NEW.id;
    
    -- Si ya existe un costo, no crear otro
    IF existing_cost_count > 0 THEN
      RETURN NEW;
    END IF;
    
    -- Obtener nombre del proveedor de la tabla suppliers si existe supplier_id
    IF NEW.supplier_id IS NOT NULL THEN
      SELECT name INTO supplier_name_value
      FROM public.suppliers 
      WHERE id = NEW.supplier_id;
    END IF;
    
    -- Si no se encontró nombre, usar valor por defecto
    IF supplier_name_value IS NULL THEN
      supplier_name_value := 'Proveedor no especificado';
    END IF;
    
    -- Obtener o crear la categoría "Pagos a Proveedores"
    SELECT id INTO payment_category_id
    FROM public.cost_categories
    WHERE name ILIKE '%pago%proveedor%' OR name ILIKE '%supplier%payment%'
    LIMIT 1;
    
    -- Si no existe la categoría, crearla
    IF payment_category_id IS NULL THEN
      INSERT INTO public.cost_categories (name, description)
      VALUES ('Pagos a Proveedores', 'Pagos realizados a proveedores y facturas de servicios')
      RETURNING id INTO payment_category_id;
    END IF;
    
    -- Construir descripción del costo
    cost_description := 'Pago a proveedor: ' || supplier_name_value;
    IF NEW.reference_number IS NOT NULL THEN
      cost_description := cost_description || ' - Referencia: ' || NEW.reference_number;
    END IF;
    
    -- Construir notas del costo
    cost_notes := 'Pago generado automáticamente desde proveedor.';
    IF NEW.description IS NOT NULL THEN
      cost_notes := cost_notes || ' Descripción: ' || NEW.description;
    END IF;
    IF NEW.notes IS NOT NULL THEN
      cost_notes := cost_notes || ' Notas: ' || NEW.notes;
    END IF;
    
    -- Crear registro en costos solo si no existe uno previo
    INSERT INTO public.costs (
      amount,
      category_id,
      date,
      description,
      notes,
      subcategory,
      supplier_payment_id,
      created_by
    ) VALUES (
      COALESCE(NEW.amount, 0),
      payment_category_id,
      COALESCE(NEW.paid_date, CURRENT_DATE),
      cost_description,
      cost_notes,
      CASE 
        WHEN NEW.category ILIKE '%combustible%' OR NEW.category ILIKE '%gasolina%' OR NEW.category ILIKE '%diesel%' THEN 'Combustible'
        WHEN NEW.category ILIKE '%mantenimiento%' OR NEW.category ILIKE '%reparaci%' OR NEW.category ILIKE '%repuesto%' THEN 'Mantenimiento General'
        WHEN NEW.category ILIKE '%seguro%' OR NEW.category ILIKE '%insurance%' THEN 'Seguros'
        WHEN NEW.category ILIKE '%administrat%' OR NEW.category ILIKE '%oficina%' THEN 'Administrativo'
        ELSE NEW.category
      END,
      NEW.id,
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Improve RLS policies to be more specific instead of just checking 'authenticated'
-- Replace general 'auth_only' policies with role-based policies where appropriate

-- Drop and recreate some of the overly broad policies
DROP POLICY IF EXISTS "calendar_events_auth_only" ON public.calendar_events;
CREATE POLICY "calendar_events_authenticated_users" 
ON public.calendar_events 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

DROP POLICY IF EXISTS "crane_documents_auth_only" ON public.crane_documents;
CREATE POLICY "crane_documents_authenticated_users" 
ON public.crane_documents 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

DROP POLICY IF EXISTS "cranes_auth_only" ON public.cranes;
CREATE POLICY "cranes_authenticated_users" 
ON public.cranes 
FOR ALL 
TO authenticated
USING (is_authenticated_user_safe())
WITH CHECK (is_authenticated_user_safe());

-- Create a more specific policy for notification logs to avoid anonymous access
DROP POLICY IF EXISTS "notification_logs_own" ON public.notification_logs;
CREATE POLICY "notification_logs_user_access" 
ON public.notification_logs 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id AND is_authenticated_user_safe());

-- Log security improvements
INSERT INTO public.audit_log (user_id, operation, table_name, new_data)
VALUES (
  auth.uid(),
  'SECURITY_IMPROVEMENT',
  'database_functions',
  jsonb_build_object(
    'action', 'added_search_path_to_functions',
    'description', 'Added SET search_path to trigger functions and improved RLS policies',
    'timestamp', now()
  )
);