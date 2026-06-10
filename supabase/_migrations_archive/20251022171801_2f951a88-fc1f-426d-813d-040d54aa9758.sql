-- Corrección del trigger create_cost_from_supplier_payment
-- Elimina referencias a columnas inexistentes (part_name, part_quantity, part_unit_price, crane_id)
-- que causaban errores al marcar pagos de proveedores como pagados

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

    -- Obtener el nombre de la categoría
    SELECT name INTO v_category_name
    FROM supplier_categories
    WHERE id = NEW.category;

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

    -- NOTA: La creación de crane_parts se maneja en el código de aplicación
    -- mediante markPaymentAsPaid con partDetails cuando sea necesario

  END IF;

  RETURN NEW;
END;
$function$;

-- Verificar que el trigger esté activo
COMMENT ON FUNCTION create_cost_from_supplier_payment() IS 
  'Trigger que crea automáticamente un costo cuando un supplier_payment se marca como paid. 
   La creación de crane_parts se maneja en la aplicación mediante partDetails.
   Incluye protección anti-duplicados.';