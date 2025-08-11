-- Mejorar el trigger para manejar actualizaciones de comisiones existentes
CREATE OR REPLACE FUNCTION public.generate_commission_cost()
RETURNS TRIGGER AS $$
DECLARE
  service_record RECORD;
  category_id_commission UUID;
  existing_cost_id UUID;
BEGIN
  -- Solo procesar recursos de tipo operator con comisión > 0
  IF NEW.resource_type = 'operator' AND NEW.commission_amount > 0 AND NEW.operator_id IS NOT NULL THEN
    
    -- Obtener datos del servicio
    SELECT s.*, o.name as operator_name
    INTO service_record
    FROM public.services s
    LEFT JOIN public.operators o ON NEW.operator_id = o.id
    WHERE s.id = NEW.service_id;
    
    -- Obtener el category_id de comisiones
    SELECT id INTO category_id_commission
    FROM public.cost_categories
    WHERE name = 'Comisión Operador'
    LIMIT 1;
    
    -- Verificar si ya existe un costo de comisión para este servicio y operador
    SELECT c.id INTO existing_cost_id
    FROM public.costs c
    JOIN public.cost_categories cc ON c.category_id = cc.id
    WHERE cc.name = 'Comisión Operador'
      AND c.service_id = NEW.service_id
      AND c.operator_id = NEW.operator_id;
    
    IF existing_cost_id IS NOT NULL THEN
      -- Actualizar el costo existente con el nuevo monto
      UPDATE public.costs 
      SET 
        amount = NEW.commission_amount,
        updated_at = now(),
        description = 'Comisión por servicio ' || service_record.folio || ' - ' || service_record.operator_name
      WHERE id = existing_cost_id;
      
      RAISE NOTICE 'Updated existing commission cost: % for operator: %', NEW.commission_amount, service_record.operator_name;
    ELSE
      -- Insertar nuevo costo de comisión
      INSERT INTO public.costs (
        amount,
        category_id,
        service_id,
        operator_id,
        service_folio,
        date,
        description,
        subcategory,
        notes,
        created_by
      ) VALUES (
        NEW.commission_amount,
        category_id_commission,
        NEW.service_id,
        NEW.operator_id,
        service_record.folio,
        service_record.service_date,
        'Comisión por servicio ' || service_record.folio || ' - ' || service_record.operator_name,
        'comisiones',
        'Comisión generada automáticamente',
        service_record.created_by
      );
      
      RAISE NOTICE 'Created new commission cost: % for operator: %', NEW.commission_amount, service_record.operator_name;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear función para sincronizar comisiones legacy con service_resources
CREATE OR REPLACE FUNCTION public.sync_legacy_operator_commission()
RETURNS TRIGGER AS $$
DECLARE
  existing_resource_id UUID;
BEGIN
  -- Solo procesar si hay operador y comisión
  IF NEW.operator_id IS NOT NULL AND NEW.operator_commission > 0 THEN
    
    -- Verificar si ya existe un resource para este operador en este servicio
    SELECT id INTO existing_resource_id
    FROM public.service_resources
    WHERE service_id = NEW.id
      AND operator_id = NEW.operator_id
      AND resource_type = 'operator';
    
    IF existing_resource_id IS NOT NULL THEN
      -- Actualizar el resource existente
      UPDATE public.service_resources
      SET 
        commission_amount = NEW.operator_commission,
        updated_at = now()
      WHERE id = existing_resource_id;
      
      RAISE NOTICE 'Updated existing service_resource commission: % for service: %', NEW.operator_commission, NEW.folio;
    ELSE
      -- Crear nuevo resource
      INSERT INTO public.service_resources (
        service_id,
        resource_type,
        operator_id,
        commission_amount,
        is_primary,
        created_by
      ) VALUES (
        NEW.id,
        'operator',
        NEW.operator_id,
        NEW.operator_commission,
        true,
        NEW.created_by
      );
      
      RAISE NOTICE 'Created new service_resource commission: % for service: %', NEW.operator_commission, NEW.folio;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para sincronizar comisiones legacy en services
DROP TRIGGER IF EXISTS trigger_sync_legacy_operator_commission ON public.services;
CREATE TRIGGER trigger_sync_legacy_operator_commission
  AFTER INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_legacy_operator_commission();