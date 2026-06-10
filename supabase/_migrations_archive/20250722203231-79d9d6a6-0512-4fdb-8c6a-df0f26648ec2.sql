-- Arreglar trigger de comisiones y generar comisiones retroactivas

-- Verificar si existe el trigger y eliminarlo si es necesario
DROP TRIGGER IF EXISTS generate_commission_on_service_completion ON public.services;

-- Recrear la función con mejor logging
CREATE OR REPLACE FUNCTION public.generate_commission_for_service()
RETURNS TRIGGER AS $$
DECLARE
  commission_rate NUMERIC;
  fixed_amount NUMERIC;
  calculated_amount NUMERIC;
  existing_commission_id UUID;
BEGIN
  -- Log para debugging
  RAISE NOTICE 'Trigger ejecutado: servicio %, estado OLD: %, estado NEW: %', NEW.id, COALESCE(OLD.status, 'NULL'), NEW.status;
  
  -- Solo generar comisión si el servicio se marca como completado
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Verificar si ya existe una comisión para este servicio
    SELECT id INTO existing_commission_id
    FROM public.commissions 
    WHERE service_id = NEW.id;
    
    IF existing_commission_id IS NOT NULL THEN
      RAISE NOTICE 'Ya existe comisión para servicio %: %', NEW.id, existing_commission_id;
      RETURN NEW;
    END IF;
    
    -- Obtener la tasa de comisión para el operador y tipo de servicio
    SELECT 
      COALESCE(ocr.percentage, 10.0),
      COALESCE(ocr.fixed_amount, 0)
    INTO commission_rate, fixed_amount
    FROM public.operator_commission_rates ocr
    WHERE ocr.operator_id = NEW.operator_id
      AND (ocr.service_type_id = NEW.service_type_id OR ocr.service_type_id IS NULL)
      AND ocr.is_active = true
      AND ocr.effective_from <= NEW.service_date
      AND (ocr.effective_to IS NULL OR ocr.effective_to >= NEW.service_date)
    ORDER BY ocr.service_type_id NULLS LAST, ocr.effective_from DESC
    LIMIT 1;
    
    -- Si no hay configuración específica, usar tasa por defecto del 10%
    IF commission_rate IS NULL THEN
      commission_rate := 10.0;
      fixed_amount := 0;
    END IF;
    
    -- Calcular monto de comisión
    calculated_amount := (NEW.value * commission_rate / 100) + fixed_amount;
    
    RAISE NOTICE 'Generando comisión: servicio %, operador %, valor %, rate %, monto %', 
      NEW.id, NEW.operator_id, NEW.value, commission_rate, calculated_amount;
    
    -- Insertar comisión
    INSERT INTO public.commissions (
      service_id,
      operator_id,
      amount,
      percentage,
      base_amount,
      status,
      period_year,
      period_month
    ) VALUES (
      NEW.id,
      NEW.operator_id,
      calculated_amount,
      commission_rate,
      NEW.value,
      'pending',
      EXTRACT(YEAR FROM NEW.service_date),
      EXTRACT(MONTH FROM NEW.service_date)
    );
    
    RAISE NOTICE 'Comisión creada exitosamente para servicio %', NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Recrear el trigger
CREATE TRIGGER generate_commission_on_service_completion
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commission_for_service();

-- Generar comisiones retroactivas para servicios completados que no tienen comisión
DO $$
DECLARE
  service_record RECORD;
  commission_rate NUMERIC;
  fixed_amount NUMERIC;
  calculated_amount NUMERIC;
  generated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Iniciando generación retroactiva de comisiones...';
  
  -- Iterar sobre servicios completados sin comisión
  FOR service_record IN 
    SELECT s.*
    FROM public.services s
    WHERE s.status = 'completed'
    AND s.operator_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.commissions c WHERE c.service_id = s.id
    )
    ORDER BY s.service_date DESC
  LOOP
    -- Obtener tasa de comisión
    SELECT 
      COALESCE(ocr.percentage, 10.0),
      COALESCE(ocr.fixed_amount, 0)
    INTO commission_rate, fixed_amount
    FROM public.operator_commission_rates ocr
    WHERE ocr.operator_id = service_record.operator_id
      AND (ocr.service_type_id = service_record.service_type_id OR ocr.service_type_id IS NULL)
      AND ocr.is_active = true
      AND ocr.effective_from <= service_record.service_date
      AND (ocr.effective_to IS NULL OR ocr.effective_to >= service_record.service_date)
    ORDER BY ocr.service_type_id NULLS LAST, ocr.effective_from DESC
    LIMIT 1;
    
    -- Usar tasa por defecto si no hay configuración
    IF commission_rate IS NULL THEN
      commission_rate := 10.0;
      fixed_amount := 0;
    END IF;
    
    -- Calcular monto
    calculated_amount := (service_record.value * commission_rate / 100) + fixed_amount;
    
    -- Insertar comisión retroactiva
    INSERT INTO public.commissions (
      service_id,
      operator_id,
      amount,
      percentage,
      base_amount,
      status,
      period_year,
      period_month,
      generated_at
    ) VALUES (
      service_record.id,
      service_record.operator_id,
      calculated_amount,
      commission_rate,
      service_record.value,
      'pending',
      EXTRACT(YEAR FROM service_record.service_date),
      EXTRACT(MONTH FROM service_record.service_date),
      service_record.service_date::timestamptz
    );
    
    generated_count := generated_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Generación retroactiva completada: % comisiones creadas', generated_count;
END $$;

-- Verificar resultado
DO $$
DECLARE
  total_commissions INTEGER;
  pending_commissions INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_commissions FROM public.commissions;
  SELECT COUNT(*) INTO pending_commissions FROM public.commissions WHERE status = 'pending';
  
  RAISE NOTICE 'RESULTADO: % comisiones totales, % pendientes', total_commissions, pending_commissions;
END $$;