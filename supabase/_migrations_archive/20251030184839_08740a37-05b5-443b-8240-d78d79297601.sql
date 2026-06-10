-- Corregir el trigger que crea costos desde pagos de proveedores
-- El campo correcto es paid_date, no payment_date

CREATE OR REPLACE FUNCTION create_cost_from_supplier_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_category_id UUID;
  v_supplier_category_name TEXT;
  v_existing_cost_id UUID;
BEGIN
  -- Solo procesar si el pago está marcado como 'paid'
  IF NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un costo asociado a este supplier_payment_id para evitar duplicados
  SELECT id INTO v_existing_cost_id
  FROM costs
  WHERE supplier_payment_id = NEW.id
  LIMIT 1;

  IF v_existing_cost_id IS NOT NULL THEN
    -- Ya existe un costo para este pago, no crear duplicado
    RETURN NEW;
  END IF;

  -- Si tiene part_name, siempre usar categoría "Mantenimiento"
  IF NEW.part_name IS NOT NULL AND NEW.part_name <> '' THEN
    SELECT id INTO v_cost_category_id
    FROM cost_categories
    WHERE name ILIKE '%mantenimiento%'
    LIMIT 1;
  ELSE
    -- Intentar mapear la categoría del supplier a cost_categories
    BEGIN
      -- Primero intentar obtener el nombre de la categoría de supplier
      SELECT name INTO v_supplier_category_name
      FROM supplier_categories
      WHERE id = NEW.category::uuid;
      
      -- Buscar una categoría similar en cost_categories
      IF v_supplier_category_name IS NOT NULL THEN
        -- Intentar match exacto o similar
        SELECT id INTO v_cost_category_id
        FROM cost_categories
        WHERE name ILIKE v_supplier_category_name
           OR name ILIKE '%' || v_supplier_category_name || '%'
           OR v_supplier_category_name ILIKE '%' || name || '%'
        LIMIT 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Si hay error en el cast o búsqueda, continuar
        NULL;
    END;
  END IF;

  -- Si no se encontró categoría, usar "Gastos de Proveedores" por defecto
  IF v_cost_category_id IS NULL THEN
    SELECT id INTO v_cost_category_id
    FROM cost_categories
    WHERE name ILIKE '%proveedor%' OR name ILIKE '%gastos%proveedor%'
    ORDER BY name
    LIMIT 1;
  END IF;

  -- Si aún no hay categoría, usar la primera disponible
  IF v_cost_category_id IS NULL THEN
    SELECT id INTO v_cost_category_id
    FROM cost_categories
    WHERE name NOT ILIKE '%comision%'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Solo crear el costo si NO tiene part_name (los costos con part_name se crean desde el frontend)
  IF NEW.part_name IS NULL OR NEW.part_name = '' THEN
    INSERT INTO costs (
      description,
      amount,
      date,
      category_id,
      supplier_id,
      supplier_payment_id,
      payment_date,
      notes,
      created_by
    ) VALUES (
      COALESCE(NEW.description, 'Pago a proveedor'),
      NEW.amount,
      NEW.paid_date,  -- CORREGIDO: antes decía payment_date
      v_cost_category_id,
      NEW.supplier_id,
      NEW.id,
      NEW.paid_date,  -- CORREGIDO: antes decía payment_date
      NEW.notes,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;