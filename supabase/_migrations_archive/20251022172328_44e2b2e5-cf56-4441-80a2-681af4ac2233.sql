-- Corrección definitiva del trigger create_cost_from_supplier_payment
-- Maneja el cast de TEXT a UUID para la columna category

CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cost_id UUID;
  v_notes TEXT;
  v_category_name TEXT;
BEGIN
  -- Solo crear costo si el pago está marcado como 'paid'
  IF NEW.status = 'paid' AND (OLD IS NULL OR OLD.status != 'paid') THEN
    
    -- Verificar si ya existe un costo para este pago (ANTI-DUPLICADOS)
    IF EXISTS (
      SELECT 1 FROM costs WHERE supplier_payment_id = NEW.id
    ) THEN
      RAISE NOTICE 'Costo ya existe para supplier_payment_id: %', NEW.id;
      RETURN NEW;
    END IF;

    -- Obtener el nombre de la categoría con manejo robusto de tipos
    BEGIN
      -- Intentar como UUID primero (para registros nuevos)
      SELECT name INTO v_category_name
      FROM supplier_categories
      WHERE id = NEW.category::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        -- Si falla el cast a UUID, usar el valor de texto directamente (registros antiguos)
        v_category_name := NEW.category;
      WHEN OTHERS THEN
        v_category_name := NULL;
    END;

    -- Preparar notas
    v_notes := COALESCE(NEW.notes, '');
    IF NEW.reference_number IS NOT NULL THEN
      v_notes := v_notes || ' | Ref: ' || NEW.reference_number;
    END IF;

    -- Crear el costo en la tabla costs
    INSERT INTO costs (
      date,
      description,
      amount,
      category_id,
      subcategory,
      notes,
      supplier_payment_id,
      payment_date,
      created_by
    )
    VALUES (
      NEW.due_date,
      NEW.description || COALESCE(' - ' || v_category_name, ''),
      COALESCE(NEW.paid_amount, NEW.amount),
      (SELECT id FROM cost_categories 
       WHERE LOWER(name) LIKE '%proveedor%' 
          OR LOWER(name) LIKE '%compra%' 
       LIMIT 1),
      v_category_name,
      v_notes,
      NEW.id,
      NEW.paid_date,
      NEW.created_by
    )
    RETURNING id INTO v_cost_id;

    RAISE NOTICE 'Costo creado exitosamente. cost_id: %, supplier_payment_id: %', v_cost_id, NEW.id;

  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION create_cost_from_supplier_payment() IS 
  'Trigger que crea automáticamente un costo cuando un supplier_payment se marca como paid. 
   Maneja conversión de TEXT a UUID para la columna category con fallback a valor texto.
   Incluye protección anti-duplicados.';