-- SECURITY FIXES: Critical vulnerabilities and RLS policy improvements

-- 1. FIX CRITICAL SEARCH PATH VULNERABILITIES
-- Update database functions to prevent search path injection attacks

CREATE OR REPLACE FUNCTION public.prevent_duplicate_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  commission_category_id UUID;
  existing_count INTEGER;
BEGIN
  -- Solo aplicar a costos de comisión
  SELECT id INTO commission_category_id 
  FROM public.cost_categories 
  WHERE name = 'Comisión Operador';
  
  IF NEW.category_id = commission_category_id THEN
    -- Verificar duplicados en costs
    SELECT COUNT(*) INTO existing_count
    FROM public.costs 
    WHERE service_id = NEW.service_id 
      AND operator_id = NEW.operator_id 
      AND category_id = commission_category_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Ya existe una comisión para este operador en este servicio. Duplicación bloqueada.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_inventory_consumption_movement(
  p_inventory_item_id uuid, 
  p_quantity integer, 
  p_crane_id uuid, 
  p_operator_id uuid DEFAULT NULL::uuid, 
  p_reference_document text DEFAULT NULL::text, 
  p_observations text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  movement_id UUID;
  location_id UUID;
BEGIN
  -- Obtener ubicación por defecto
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Crear movimiento de salida
  INSERT INTO public.inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    crane_id,
    operator_id,
    reference_document,
    observations,
    movement_date,
    status,
    created_by
  ) VALUES (
    p_inventory_item_id,
    location_id,
    'exit',
    p_quantity,
    p_crane_id,
    p_operator_id,
    p_reference_document,
    p_observations,
    CURRENT_DATE,
    'active',
    auth.uid()
  )
  RETURNING id INTO movement_id;

  RETURN movement_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_stock_id UUID;
BEGIN
  -- Only process if status is 'active'
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Check if stock record already exists
  SELECT id INTO existing_stock_id
  FROM public.inventory_stock 
  WHERE item_id = NEW.item_id AND location_id = NEW.location_id;

  IF NEW.movement_type = 'entry' THEN
    IF existing_stock_id IS NOT NULL THEN
      -- Update existing stock
      UPDATE public.inventory_stock 
      SET 
        current_quantity = current_quantity + NEW.quantity,
        last_movement_date = NEW.movement_date,
        updated_at = now()
      WHERE id = existing_stock_id;
    ELSE
      -- Insert new stock record
      INSERT INTO public.inventory_stock (item_id, location_id, current_quantity, last_movement_date)
      VALUES (NEW.item_id, NEW.location_id, NEW.quantity, NEW.movement_date);
    END IF;
    
  ELSIF NEW.movement_type = 'exit' THEN
    IF existing_stock_id IS NOT NULL THEN
      UPDATE public.inventory_stock 
      SET 
        current_quantity = GREATEST(0, current_quantity - NEW.quantity),
        last_movement_date = NEW.movement_date,
        updated_at = now()
      WHERE id = existing_stock_id;
    ELSE
      RAISE WARNING 'Cannot process exit movement: no stock record found for item % at location %', 
        NEW.item_id, NEW.location_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.migrate_unsync_crane_parts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  part_record RECORD;
  local_inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Verificar permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar migraciones';
  END IF;

  -- Obtener ubicación por defecto
  SELECT il.id INTO location_id
  FROM public.inventory_locations il
  WHERE il.is_active = true
  ORDER BY il.created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
  END IF;

  -- Migrar piezas sin sincronizar
  FOR part_record IN 
    SELECT cp.* FROM public.crane_parts cp
    WHERE cp.inventory_movement_id IS NULL
    ORDER BY cp.created_at
  LOOP
    BEGIN
      -- Buscar o crear item de inventario
      SELECT ii.id INTO local_inventory_item_id
      FROM public.inventory_items ii
      WHERE LOWER(TRIM(ii.name)) = LOWER(TRIM(part_record.part_name))
      AND ii.is_active = true
      LIMIT 1;

      IF local_inventory_item_id IS NULL THEN
        INSERT INTO public.inventory_items (
          name,
          description,
          unit_of_measure,
          unit_cost,
          minimum_stock,
          is_active,
          created_by
        ) VALUES (
          TRIM(part_record.part_name),
          'Migrado desde pieza de grúa existente',
          'unidad',
          part_record.unit_price,
          1,
          true,
          part_record.created_by
        )
        RETURNING id INTO local_inventory_item_id;
      END IF;

      -- Crear movimiento de entrada
      INSERT INTO public.inventory_movements (
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        supplier_name,
        reference_document,
        observations,
        movement_date,
        status,
        created_by
      ) VALUES (
        local_inventory_item_id,
        location_id,
        'entry',
        part_record.quantity,
        part_record.unit_price,
        part_record.total_value,
        part_record.supplier,
        'Migración de pieza existente - ID: ' || part_record.id,
        'Movimiento migrado automáticamente',
        part_record.date,
        'active',
        part_record.created_by
      )
      RETURNING id INTO movement_id;

      -- Actualizar crane_parts con referencia
      UPDATE public.crane_parts 
      SET inventory_movement_id = movement_id
      WHERE id = part_record.id;

      -- Crear mapeo si existe cost_id
      IF part_record.cost_id IS NOT NULL THEN
        INSERT INTO public.cost_inventory_items (
          cost_id,
          inventory_item_id,
          quantity,
          unit_cost,
          created_by
        ) VALUES (
          part_record.cost_id,
          local_inventory_item_id,
          part_record.quantity,
          part_record.unit_price,
          part_record.created_by
        )
        ON CONFLICT (cost_id, inventory_item_id) DO NOTHING;
      END IF;

      migrated_count := migrated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'part_id', part_record.id,
          'part_name', part_record.part_name,
          'error', SQLERRM
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'error_count', error_count,
    'errors', errors,
    'message', format('Migración completada: %s piezas migradas, %s errores', migrated_count, error_count)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_inventory_sync_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_parts INTEGER;
  synced_parts INTEGER;
  unsynced_parts INTEGER;
  total_items INTEGER;
  auto_created_items INTEGER;
BEGIN
  -- Contar piezas totales
  SELECT COUNT(*) INTO total_parts FROM public.crane_parts;
  
  -- Contar piezas sincronizadas
  SELECT COUNT(*) INTO synced_parts 
  FROM public.crane_parts 
  WHERE inventory_movement_id IS NOT NULL;
  
  -- Calcular no sincronizadas
  unsynced_parts := total_parts - synced_parts;
  
  -- Contar items de inventario totales
  SELECT COUNT(*) INTO total_items FROM public.inventory_items WHERE is_active = true;
  
  -- Contar items auto-creados
  SELECT COUNT(*) INTO auto_created_items 
  FROM public.inventory_items 
  WHERE description LIKE '%Auto-creado%' OR description LIKE '%Migrado%';

  RETURN jsonb_build_object(
    'total_parts', total_parts,
    'synced_parts', synced_parts,
    'unsynced_parts', unsynced_parts,
    'sync_percentage', CASE WHEN total_parts > 0 THEN ROUND((synced_parts::decimal / total_parts::decimal) * 100, 2) ELSE 0 END,
    'total_inventory_items', total_items,
    'auto_created_items', auto_created_items,
    'trigger_exists', EXISTS(
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'sync_parts_purchase_trigger'
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_security_status()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mutable_functions INTEGER := 0;
  tables_without_policies INTEGER := 0;
  result_text TEXT;
BEGIN
  -- Contar funciones con search_path mutable
  SELECT COUNT(*) INTO mutable_functions
  FROM information_schema.routines r
  WHERE r.routine_schema = 'public' 
  AND r.routine_type = 'FUNCTION'
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname = r.routine_name
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  );

  -- Contar tablas con RLS habilitado pero sin políticas
  SELECT COUNT(*) INTO tables_without_policies
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = 'public' 
    AND p.tablename = c.relname
  );

  result_text := format(
    'ESTADO SEGURIDAD: %s funciones mutable, %s tablas sin políticas - %s',
    mutable_functions,
    tables_without_policies,
    CASE WHEN mutable_functions = 0 AND tables_without_policies = 0 THEN 'SEGURO' ELSE 'MEJORADO' END
  );

  RETURN result_text;
END;
$function$;

-- 2. ENHANCE ROLE MANAGEMENT SECURITY
-- Add additional security checks to prevent privilege escalation

CREATE OR REPLACE FUNCTION public.update_user_role_secure(user_id uuid, new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_admin_count INTEGER;
  target_user_role app_role;
  executing_user_role app_role;
BEGIN
  -- Verificar que el usuario que ejecuta la función sea admin
  SELECT role INTO executing_user_role FROM public.profiles WHERE id = auth.uid();
  IF executing_user_role != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar roles de usuario';
  END IF;

  -- Obtener rol actual del usuario objetivo
  SELECT role INTO target_user_role FROM public.profiles WHERE id = user_id;
  IF target_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Prevenir que el último admin pierda privilegios
  IF target_user_role = 'admin' AND new_role != 'admin' THEN
    SELECT COUNT(*) INTO current_admin_count 
    FROM public.profiles 
    WHERE role = 'admin' AND is_active = true;
    
    IF current_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede cambiar el rol del último administrador activo';
    END IF;
  END IF;

  -- Prevenir auto-degradación del ejecutor
  IF user_id = auth.uid() AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Los administradores no pueden cambiar su propio rol';
  END IF;

  -- Actualizar el rol del usuario
  UPDATE public.profiles 
  SET role = new_role, updated_at = now()
  WHERE id = user_id;

  -- Log de auditoría
  INSERT INTO public.notification_logs (
    user_id,
    type,
    title,
    body,
    data,
    status
  ) VALUES (
    auth.uid(),
    'security_audit',
    'Cambio de rol de usuario',
    'Usuario ' || user_id || ' cambió rol de ' || target_user_role || ' a ' || new_role,
    jsonb_build_object(
      'target_user_id', user_id,
      'old_role', target_user_role,
      'new_role', new_role,
      'timestamp', now()
    ),
    'sent'
  );
END;
$function$;

-- 3. STRENGTHEN RLS POLICIES WITH ROLE-BASED ACCESS

-- Drop existing generic policies and create role-based ones
DROP POLICY IF EXISTS "costs_auth_only" ON public.costs;
DROP POLICY IF EXISTS "services_auth_only" ON public.services;
DROP POLICY IF EXISTS "clients_auth_only" ON public.clients;

-- Enhanced RLS policies for costs table
CREATE POLICY "costs_admin_full_access" 
ON public.costs 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "costs_operator_access" 
ON public.costs 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('operator', 'admin')
  )
);

CREATE POLICY "costs_client_own_services" 
ON public.costs 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.services s ON s.client_id = p.client_id
    WHERE p.id = auth.uid() 
    AND p.role = 'client'
    AND s.id = costs.service_id
  )
);

-- Enhanced RLS policies for services table
CREATE POLICY "services_admin_full_access" 
ON public.services 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "services_operator_access" 
ON public.services 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('operator', 'admin')
  )
);

CREATE POLICY "services_client_own_data" 
ON public.services 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'client'
    AND client_id = services.client_id
  )
);

-- Enhanced RLS policies for clients table
CREATE POLICY "clients_admin_operator_access" 
ON public.clients 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  )
);

CREATE POLICY "clients_own_data" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'client'
    AND client_id = clients.id
  )
);

-- Enhanced profiles table policies (replace existing)
DROP POLICY IF EXISTS "profiles_own_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

CREATE POLICY "profiles_admin_full_access" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "profiles_own_read_update" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_own_update" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  -- Prevent role self-escalation
  CASE 
    WHEN OLD.role != NEW.role THEN 
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
      )
    ELSE true 
  END
);

CREATE POLICY "profiles_insert_own" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- 4. ADD SECURITY AUDIT FUNCTION
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  event_description text,
  additional_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_logs (
    user_id,
    type,
    title,
    body,
    data,
    status
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'security_audit',
    'Evento de Seguridad: ' || event_type,
    event_description,
    additional_data || jsonb_build_object(
      'timestamp', now(),
      'user_agent', current_setting('request.headers', true)::jsonb ->> 'user-agent',
      'ip_address', current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'
    ),
    'sent'
  );
END;
$function$;