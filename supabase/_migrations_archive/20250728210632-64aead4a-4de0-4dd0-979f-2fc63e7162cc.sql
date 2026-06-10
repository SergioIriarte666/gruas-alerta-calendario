-- Migración para corregir servicios sin service_resources
-- Esta función actualiza la tabla services para reflejar los operadores y grúas asignados

-- Función para sincronizar service_resources con la tabla services
CREATE OR REPLACE FUNCTION sync_existing_services_to_resources()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_record RECORD;
BEGIN
  -- Iterar sobre servicios que tienen operador o grúa pero no tienen service_resources
  FOR service_record IN 
    SELECT s.id, s.folio, s.crane_id, s.operator_id
    FROM services s
    WHERE (s.crane_id IS NOT NULL OR s.operator_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM service_resources sr 
      WHERE sr.service_id = s.id
    )
  LOOP
    -- Crear service_resources para operador si existe
    IF service_record.operator_id IS NOT NULL THEN
      INSERT INTO service_resources (
        service_id,
        resource_type,
        operator_id,
        is_primary,
        commission_amount,
        created_at
      ) VALUES (
        service_record.id,
        'operator',
        service_record.operator_id,
        true,
        0,
        now()
      );
      
      RAISE NOTICE 'Created operator resource for service %: %', service_record.folio, service_record.operator_id;
    END IF;
    
    -- Crear service_resources para grúa si existe
    IF service_record.crane_id IS NOT NULL THEN
      INSERT INTO service_resources (
        service_id,
        resource_type,
        crane_id,
        is_primary,
        commission_amount,
        created_at
      ) VALUES (
        service_record.id,
        'crane',
        service_record.crane_id,
        true,
        0,
        now()
      );
      
      RAISE NOTICE 'Created crane resource for service %: %', service_record.folio, service_record.crane_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Sync completed successfully';
END;
$$;