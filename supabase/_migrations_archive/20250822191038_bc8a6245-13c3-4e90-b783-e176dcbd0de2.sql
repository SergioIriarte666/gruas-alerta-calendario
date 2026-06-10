-- Restaurar el sistema de comisiones original
-- 1. Rehabilitar el trigger automático para crear comisiones en costs
-- 2. Agregar campo payment_date para gestión de pagos
-- 3. Asegurar que el trigger funcione correctamente

-- Primero, verificar y actualizar la función del trigger
CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que el trigger esté activo
DROP TRIGGER IF EXISTS generate_commission_on_service_completion_trigger ON public.services;
CREATE TRIGGER generate_commission_on_service_completion_trigger
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_on_service_completion();

-- Crear función para actualizar payment_date en comisiones
CREATE OR REPLACE FUNCTION public.update_commission_payment_date(
  p_commission_ids UUID[],
  p_payment_date DATE,
  p_payment_batch_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  updated_count INTEGER := 0;
  commission_id UUID;
BEGIN
  -- Verificar permisos
  IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'No tienes permisos para actualizar fechas de pago de comisiones';
  END IF;

  -- Actualizar cada comisión
  FOREACH commission_id IN ARRAY p_commission_ids
  LOOP
    UPDATE public.costs
    SET 
      payment_date = p_payment_date,
      payment_batch_id = p_payment_batch_id,
      subcategory = CASE 
        WHEN p_payment_date IS NOT NULL THEN 'comisiones_pagadas'
        ELSE 'comisiones'
      END,
      updated_at = NOW()
    WHERE id = commission_id
      AND category_id = (SELECT id FROM public.cost_categories WHERE name = 'Comisión Operador' LIMIT 1);
    
    IF FOUND THEN
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'payment_date', p_payment_date,
    'payment_batch_id', p_payment_batch_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;