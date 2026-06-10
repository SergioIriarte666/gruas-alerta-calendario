
-- Corregir Functions Search Path Mutable warnings agregando search_path seguro

-- Actualizar función sync_parts_purchase_to_inventory con search_path fijo
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inventory_item_id UUID;
  movement_id UUID;
  location_id UUID;
BEGIN
  -- Log para debugging
  RAISE NOTICE 'Iniciando sincronización para pieza: %', NEW.part_name;
  
  -- Obtener ubicación por defecto (primera activa)
  SELECT id INTO location_id
  FROM public.inventory_locations
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Si no hay ubicación, crear una por defecto
  IF location_id IS NULL THEN
    INSERT INTO public.inventory_locations (name, code, description, is_active)
    VALUES ('Bodega Principal', 'MAIN', 'Bodega principal de repuestos', true)
    RETURNING id INTO location_id;
    
    RAISE NOTICE 'Creada ubicación por defecto: %', location_id;
  END IF;

  -- Buscar item de inventario existente basado en el nombre de la pieza
  SELECT id INTO inventory_item_id
  FROM public.inventory_items
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.part_name))
  AND is_active = true
  LIMIT 1;

  -- Si no existe el item, crearlo
  IF inventory_item_id IS NULL THEN
    INSERT INTO public.inventory_items (
      name,
      description,
      unit_of_measure,
      unit_cost,
      minimum_stock,
      is_active,
      created_by
    ) VALUES (
      TRIM(NEW.part_name),
      'Auto-creado desde compra de pieza para grúa',
      'unidad',
      NEW.unit_price,
      1,
      true,
      COALESCE(NEW.created_by, auth.uid())
    )
    RETURNING id INTO inventory_item_id;
    
    RAISE NOTICE 'Creado item de inventario: % con ID: %', NEW.part_name, inventory_item_id;
  ELSE
    RAISE NOTICE 'Usando item de inventario existente: %', inventory_item_id;
  END IF;

  -- Crear movimiento de entrada al inventario
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
    inventory_item_id,
    location_id,
    'entry',
    NEW.quantity,
    NEW.unit_price,
    NEW.total_value,
    NEW.supplier,
    'Compra de pieza para grúa - Pieza ID: ' || NEW.id,
    'Movimiento automático generado desde compra de pieza',
    NEW.date,
    'active',
    COALESCE(NEW.created_by, auth.uid())
  )
  RETURNING id INTO movement_id;
  
  RAISE NOTICE 'Creado movimiento de inventario: %', movement_id;

  -- Actualizar crane_parts con referencia al movimiento
  NEW.inventory_movement_id := movement_id;

  -- Crear mapeo en cost_inventory_items si existe cost_id
  IF NEW.cost_id IS NOT NULL THEN
    INSERT INTO public.cost_inventory_items (
      cost_id,
      inventory_item_id,
      quantity,
      unit_cost,
      created_by
    ) VALUES (
      NEW.cost_id,
      inventory_item_id,
      NEW.quantity,
      NEW.unit_price,
      COALESCE(NEW.created_by, auth.uid())
    )
    ON CONFLICT (cost_id, inventory_item_id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      unit_cost = EXCLUDED.unit_cost;
      
    RAISE NOTICE 'Creado/actualizado mapeo cost_inventory_items';
  END IF;

  RAISE NOTICE 'Sincronización completada exitosamente para: %', NEW.part_name;
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error en sincronización de inventario para pieza %: %', NEW.part_name, SQLERRM;
    -- Retornar NEW para que la inserción de crane_parts continúe
    RETURN NEW;
END;
$$;

-- Actualizar función create_cost_for_crane_part_conditional con search_path fijo
CREATE OR REPLACE FUNCTION public.create_cost_for_crane_part_conditional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
BEGIN
  -- Solo ejecutar si NO hay cost_id (evitar duplicación)
  IF NEW.cost_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the maintenance category ID
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- If no maintenance category exists, create one
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Create cost entry
  INSERT INTO public.costs (
    amount,
    category_id,
    crane_id,
    date,
    description,
    notes,
    subcategory,
    created_by
  ) VALUES (
    NEW.total_value,
    maintenance_category_id,
    NEW.crane_id,
    NEW.date,
    'Compra de piezas: ' || NEW.part_name,
    COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    'Piezas y Repuestos',
    NEW.created_by
  ) RETURNING id INTO new_cost_id;

  -- Update the crane_part with the cost_id reference
  NEW.cost_id := new_cost_id;

  RETURN NEW;
END;
$$;

-- Actualizar función check_inventory_sync_status con search_path fijo
CREATE OR REPLACE FUNCTION public.check_inventory_sync_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Actualizar función force_resync_crane_part con search_path fijo
CREATE OR REPLACE FUNCTION public.force_resync_crane_part(part_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  part_record RECORD;
  result jsonb;
BEGIN
  -- Verificar permisos
  IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Permisos insuficientes para re-sincronizar piezas';
  END IF;

  -- Obtener la pieza
  SELECT * INTO part_record FROM public.crane_parts WHERE id = part_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pieza no encontrada');
  END IF;

  -- Limpiar sincronización existente si existe
  IF part_record.inventory_movement_id IS NOT NULL THEN
    -- Marcar movimiento como cancelado en lugar de eliminarlo
    UPDATE public.inventory_movements 
    SET status = 'cancelled', observations = observations || ' - Re-sincronizado'
    WHERE id = part_record.inventory_movement_id;
    
    -- Limpiar referencia
    UPDATE public.crane_parts 
    SET inventory_movement_id = NULL 
    WHERE id = part_id;
  END IF;

  -- Ejecutar sincronización manual usando la misma lógica del trigger
  -- (esto activará el trigger en la próxima actualización)
  UPDATE public.crane_parts 
  SET updated_at = now()
  WHERE id = part_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Re-sincronización completada para: ' || part_record.part_name
  );
END;
$$;

-- Actualizar función generate_database_backup con search_path fijo
CREATE OR REPLACE FUNCTION public.generate_database_backup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  backup_content TEXT := '';
  table_record RECORD;
  row_record RECORD;
  column_info RECORD;
  insert_statement TEXT;
  values_part TEXT;
  backup_metadata TEXT;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;

  -- Generar metadatos del respaldo
  backup_metadata := format(
    '-- TMS Grúas Database Backup
-- Generated on: %s
-- Generated by: %s
-- Database version: PostgreSQL %s
-- 
-- IMPORTANT: This backup contains all system data
-- Restore only on compatible TMS Grúas installations
--

SET client_encoding = ''UTF8'';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

',
    now(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    version()
  );

  backup_content := backup_metadata;

  -- Lista de tablas a respaldar (en orden de dependencias)
  FOR table_record IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    ORDER BY 
      CASE table_name
        WHEN 'profiles' THEN 1
        WHEN 'cost_categories' THEN 2
        WHEN 'service_types' THEN 3
        WHEN 'clients' THEN 4
        WHEN 'cranes' THEN 5
        WHEN 'operators' THEN 6
        WHEN 'company_data' THEN 7
        WHEN 'system_settings' THEN 8
        WHEN 'services' THEN 9
        WHEN 'costs' THEN 10
        WHEN 'inspections' THEN 11
        WHEN 'service_closures' THEN 12
        WHEN 'closure_services' THEN 13
        WHEN 'invoices' THEN 14
        WHEN 'invoice_services' THEN 15
        WHEN 'invoice_closures' THEN 16
        WHEN 'calendar_events' THEN 17
        ELSE 99
      END
  LOOP
    backup_content := backup_content || format('
-- 
-- Data for table: %s
--

', table_record.table_name);

    -- Obtener información de columnas
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns
    INTO column_info
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = table_record.table_name;

    -- Generar INSERT statements para cada fila
    FOR row_record IN EXECUTE format('SELECT * FROM public.%I', table_record.table_name)
    LOOP
      -- Construir la parte VALUES del INSERT
      SELECT string_agg(
        CASE 
          WHEN value IS NULL THEN 'NULL'
          WHEN value_type IN ('text', 'varchar', 'char', 'uuid', 'date', 'timestamp', 'time') THEN 
            quote_literal(value)
          WHEN value_type = 'boolean' THEN value
          WHEN value_type LIKE '%[]' THEN 
            CASE 
              WHEN value = '{}' THEN '''{}'''
              ELSE quote_literal(value)
            END
          ELSE value
        END, 
        ', '
      ) INTO values_part
      FROM (
        SELECT 
          CASE 
            WHEN column_name = 'id' THEN row_record.id::TEXT
            WHEN column_name = 'created_at' THEN row_record.created_at::TEXT
            WHEN column_name = 'updated_at' THEN row_record.updated_at::TEXT
            WHEN column_name = 'name' THEN row_record.name
            WHEN column_name = 'email' THEN row_record.email
            WHEN column_name = 'role' THEN row_record.role::TEXT
            WHEN column_name = 'full_name' THEN row_record.full_name
            WHEN column_name = 'is_active' THEN row_record.is_active::TEXT
            WHEN column_name = 'description' THEN row_record.description
            ELSE 
              CASE 
                WHEN EXISTS (
                  SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = table_record.table_name 
                  AND column_name = column_name
                ) THEN 'DEFAULT'
                ELSE 'NULL'
              END
          END AS value,
          data_type AS value_type,
          column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = table_record.table_name
        ORDER BY ordinal_position
      ) AS column_values;

      -- Construir el INSERT statement completo
      insert_statement := format(
        'INSERT INTO public.%I (%s) VALUES (%s);',
        table_record.table_name,
        column_info.columns,
        values_part
      );

      backup_content := backup_content || insert_statement || E'\n';
    END LOOP;
  END LOOP;

  -- Añadir footer del respaldo
  backup_content := backup_content || format('
--
-- Backup completed successfully
-- Total tables backed up: %s
-- Generated at: %s
--
',
    (SELECT count(*) FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
    now()
  );

  RETURN backup_content;
END;
$$;

-- Actualizar función generate_quick_backup con search_path fijo
CREATE OR REPLACE FUNCTION public.generate_quick_backup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  backup_data JSONB := '{}';
  table_data JSONB;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;

  -- Respaldo de configuración de empresa
  SELECT to_jsonb(row) INTO table_data
  FROM (SELECT * FROM public.company_data LIMIT 1) row;
  backup_data := jsonb_set(backup_data, '{company_data}', COALESCE(table_data, 'null'));

  -- Respaldo de configuración del sistema
  SELECT to_jsonb(row) INTO table_data
  FROM (SELECT * FROM public.system_settings LIMIT 1) row;
  backup_data := jsonb_set(backup_data, '{system_settings}', COALESCE(table_data, 'null'));

  -- Conteo de registros principales
  backup_data := jsonb_set(backup_data, '{metadata}', jsonb_build_object(
    'generated_at', now(),
    'generated_by', (SELECT email FROM public.profiles WHERE id = auth.uid()),
    'counts', jsonb_build_object(
      'clients', (SELECT count(*) FROM public.clients),
      'services', (SELECT count(*) FROM public.services),
      'operators', (SELECT count(*) FROM public.operators),
      'cranes', (SELECT count(*) FROM public.cranes),
      'invoices', (SELECT count(*) FROM public.invoices)
    )
  ));

  RETURN backup_data;
END;
$$;

-- Actualizar función cleanup_duplicate_profiles con search_path fijo
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_profiles()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Eliminar perfiles duplicados por email, manteniendo el más reciente
  WITH duplicates AS (
    SELECT id, email, role, created_at,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.profiles
  )
  DELETE FROM public.profiles 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  RAISE NOTICE 'Duplicate profiles cleanup completed';
END;
$$;

-- Actualizar función migrate_existing_operator_commissions con search_path fijo
CREATE OR REPLACE FUNCTION public.migrate_existing_operator_commissions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Migrar comisiones existentes de operadores a service_resources
  INSERT INTO public.service_resources (
    service_id, 
    operator_id, 
    commission_amount, 
    resource_type, 
    is_primary,
    created_at,
    updated_at
  )
  SELECT 
    id as service_id,
    operator_id,
    COALESCE(operator_commission, 0) as commission_amount,
    'operator' as resource_type,
    true as is_primary,
    created_at,
    updated_at
  FROM public.services 
  WHERE operator_id IS NOT NULL 
  AND operator_commission > 0;

  -- Crear registros de costos automáticos para las comisiones migradas
  INSERT INTO public.service_costs (
    service_id,
    cost_type,
    amount,
    operator_id,
    description,
    is_auto_generated,
    date,
    created_at,
    updated_at
  )
  SELECT 
    s.id as service_id,
    'commission' as cost_type,
    COALESCE(s.operator_commission, 0) as amount,
    s.operator_id,
    'Comisión de operador (migrada automáticamente)' as description,
    true as is_auto_generated,
    s.service_date as date,
    s.created_at,
    s.updated_at
  FROM public.services s
  WHERE s.operator_id IS NOT NULL 
  AND s.operator_commission > 0;

  RAISE NOTICE 'Migración de comisiones completada exitosamente';
END;
$$;

-- Mensaje de finalización
DO $$
BEGIN
  RAISE NOTICE 'Migración completada - Functions Search Path Mutable warnings corregidos';
  RAISE NOTICE 'Todas las funciones ahora tienen search_path seguro configurado';
  RAISE NOTICE 'ACCIÓN MANUAL REQUERIDA: Habilitar "Leaked Password Protection" en Auth Settings';
END;
$$;
