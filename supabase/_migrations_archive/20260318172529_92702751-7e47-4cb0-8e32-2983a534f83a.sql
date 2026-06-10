
-- =====================================================
-- Fix: Sincronización payment_date cuando cost_id es NULL
-- =====================================================

-- 1. Vincular cost_id en payments huérfanos que ya tienen relación vía supplier_payment_id
UPDATE supplier_payments sp
SET cost_id = c.id
FROM costs c
WHERE c.supplier_payment_id = sp.id
  AND sp.cost_id IS NULL;

-- 2. Corregir payment_date del costo de Entel 52897759 (pagado hoy 2026-03-18)
UPDATE costs 
SET payment_date = '2026-03-18'
WHERE id = '0fa8df72-1c69-4a9c-ac86-5d93494437a2';

-- 3. Mejorar trigger: buscar también por supplier_payment_id cuando cost_id es NULL
CREATE OR REPLACE FUNCTION public.create_cost_from_supplier_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_cost_id UUID;
  v_maintenance_cat_id UUID;
BEGIN
  -- Solo procesar en INSERT (no en UPDATE)
  IF TG_OP = 'INSERT' THEN
    -- Si ya viene con cost_id, fue creado desde un costo → no crear otro
    IF NEW.cost_id IS NOT NULL THEN
      RAISE NOTICE '[Payment→Cost] Payment % ya tiene cost_id %, skip', NEW.id, NEW.cost_id;
      RETURN NEW;
    END IF;
    
    -- Verificar si ya existe un cost con supplier_payment_id = NEW.id
    IF EXISTS (SELECT 1 FROM costs WHERE supplier_payment_id = NEW.id) THEN
      RAISE NOTICE '[Payment→Cost] Ya existe cost para payment %, skip', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Obtener categoría de Mantenimiento como default
    SELECT id INTO v_maintenance_cat_id 
    FROM cost_categories 
    WHERE name = 'Mantenimiento' 
    LIMIT 1;
    
    -- Si no hay categoría, usar la primera disponible
    IF v_maintenance_cat_id IS NULL THEN
      SELECT id INTO v_maintenance_cat_id FROM cost_categories LIMIT 1;
    END IF;
    
    -- Crear el costo
    INSERT INTO costs (
      amount,
      category_id,
      date,
      description,
      supplier_id,
      supplier_payment_id,
      payment_date,
      created_by
    ) VALUES (
      NEW.amount,
      COALESCE(NEW.category::uuid, v_maintenance_cat_id),
      COALESCE(NEW.due_date, CURRENT_DATE),
      COALESCE(NEW.description, 'Pago a proveedor'),
      NEW.supplier_id,
      NEW.id,
      NEW.paid_date,
      NEW.created_by
    ) RETURNING id INTO v_cost_id;
    
    -- Vincular el payment con el cost creado
    UPDATE supplier_payments SET cost_id = v_cost_id WHERE id = NEW.id;
    
    RAISE NOTICE '[Payment→Cost] Cost % creado para payment %', v_cost_id, NEW.id;
  END IF;
  
  -- En UPDATE: si se marca como paid, actualizar payment_date en el cost vinculado
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
      -- Buscar cost_id directamente o por supplier_payment_id
      v_cost_id := NEW.cost_id;
      
      IF v_cost_id IS NULL THEN
        SELECT id INTO v_cost_id FROM costs WHERE supplier_payment_id = NEW.id LIMIT 1;
      END IF;
      
      IF v_cost_id IS NOT NULL THEN
        UPDATE costs 
        SET payment_date = COALESCE(NEW.paid_date, CURRENT_DATE)
        WHERE id = v_cost_id;
        
        -- También vincular cost_id si faltaba
        IF NEW.cost_id IS NULL THEN
          UPDATE supplier_payments SET cost_id = v_cost_id WHERE id = NEW.id;
        END IF;
        
        RAISE NOTICE '[Payment→Cost] Updated payment_date on cost % from payment %', v_cost_id, NEW.id;
      ELSE
        RAISE NOTICE '[Payment→Cost] No cost found for payment % (cost_id NULL, no supplier_payment_id match)', NEW.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recrear trigger
DROP TRIGGER IF EXISTS create_cost_from_supplier_payment_trigger ON public.supplier_payments;
CREATE TRIGGER create_cost_from_supplier_payment_trigger
  AFTER INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_from_supplier_payment();
