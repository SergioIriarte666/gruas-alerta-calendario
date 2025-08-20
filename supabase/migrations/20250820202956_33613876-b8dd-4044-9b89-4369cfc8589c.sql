-- Corregir función del trigger que causa errores al actualizar pagos de proveedores
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
BEGIN
  -- Solo procesar cuando el pago cambia a estado "paid"
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
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
    
    -- Crear registro en costos
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
      COALESCE(NEW.paid_date, NEW.due_date, CURRENT_DATE),
      cost_description,
      cost_notes,
      CASE 
        WHEN NEW.category ILIKE '%combustible%' OR NEW.category ILIKE '%gasolina%' OR NEW.category ILIKE '%diesel%' THEN 'Combustible'
        WHEN NEW.category ILIKE '%mantenimiento%' OR NEW.category ILIKE '%reparaci%' OR NEW.category ILIKE '%repuesto%' THEN 'Mantenimiento'
        WHEN NEW.category ILIKE '%seguro%' OR NEW.category ILIKE '%insurance%' THEN 'Seguros'
        WHEN NEW.category ILIKE '%administrat%' OR NEW.category ILIKE '%oficina%' THEN 'Administrativo'
        ELSE COALESCE(NEW.category, 'General')
      END,
      NEW.id,
      COALESCE(NEW.created_by, auth.uid())
    );
    
    RAISE NOTICE 'Costo creado automáticamente para pago de proveedor: %', NEW.id;
  END IF;
  
  -- Si el pago se despaga (cambia de paid a otro estado), eliminar el costo asociado
  IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    DELETE FROM public.costs WHERE supplier_payment_id = NEW.id;
    RAISE NOTICE 'Costo eliminado automáticamente para pago despagado: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;