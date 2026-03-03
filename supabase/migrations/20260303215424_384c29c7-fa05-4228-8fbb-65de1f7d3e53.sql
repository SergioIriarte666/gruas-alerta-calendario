
-- =====================================================
-- Sincronización Triangular Definitiva
-- Costos ↔ Proveedores ↔ Bodega
-- =====================================================

-- ============ A. Mejorar trigger payment→cost ============
-- Reemplazar para que SOLO cree cost si NO tiene cost_id
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
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.cost_id IS NOT NULL THEN
      UPDATE costs 
      SET payment_date = COALESCE(NEW.paid_date, CURRENT_DATE)
      WHERE id = NEW.cost_id;
      RAISE NOTICE '[Payment→Cost] Updated payment_date on cost % from payment %', NEW.cost_id, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger para INSERT y UPDATE
DROP TRIGGER IF EXISTS create_cost_from_supplier_payment_trigger ON public.supplier_payments;
CREATE TRIGGER create_cost_from_supplier_payment_trigger
  AFTER INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_from_supplier_payment();


-- ============ B. Nuevo trigger: sync cost UPDATE → payment ============
CREATE OR REPLACE FUNCTION public.sync_cost_update_to_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo sincronizar si tiene supplier_payment_id
  IF NEW.supplier_payment_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar si cambió algo relevante
  IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
     (OLD.supplier_id IS DISTINCT FROM NEW.supplier_id) OR
     (OLD.description IS DISTINCT FROM NEW.description) OR
     (OLD.payment_date IS DISTINCT FROM NEW.payment_date) THEN
    
    UPDATE supplier_payments SET
      amount = NEW.amount,
      supplier_id = COALESCE(NEW.supplier_id, supplier_id),
      description = NEW.description,
      paid_date = COALESCE(NEW.payment_date, paid_date),
      due_date = COALESCE(NEW.payment_date, NEW.date, due_date),
      updated_at = now()
    WHERE id = NEW.supplier_payment_id;
    
    RAISE NOTICE '[Cost→Payment UPDATE] Synced cost % → payment %', NEW.id, NEW.supplier_payment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_cost_update_to_payment_trigger ON public.costs;
CREATE TRIGGER sync_cost_update_to_payment_trigger
  AFTER UPDATE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cost_update_to_payment();


-- ============ C. Mejorar trigger DELETE cost → elimina payment + cancela inventory ============
CREATE OR REPLACE FUNCTION public.sync_cost_deletion_cascade()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Eliminar supplier_payment asociado (si existe)
  IF OLD.supplier_payment_id IS NOT NULL THEN
    DELETE FROM supplier_payments WHERE id = OLD.supplier_payment_id;
    RAISE NOTICE '[Cost DELETE] Deleted supplier_payment % for cost %', OLD.supplier_payment_id, OLD.id;
  END IF;
  
  -- También eliminar payments que referencien este cost via cost_id
  DELETE FROM supplier_payments WHERE cost_id = OLD.id;
  
  -- 2. Cancelar movimientos de inventario vinculados
  UPDATE inventory_movements 
  SET status = 'cancelled', 
      observations = COALESCE(observations, '') || ' [Cancelado por eliminación de costo ' || OLD.id || ']'
  WHERE cost_id = OLD.id AND status != 'cancelled';
  
  RAISE NOTICE '[Cost DELETE] Cascade completed for cost %', OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reemplazar el trigger de eliminación existente
DROP TRIGGER IF EXISTS sync_cost_supplier_payment_deletion ON public.costs;
DROP TRIGGER IF EXISTS sync_cost_deletion_cascade_trigger ON public.costs;
CREATE TRIGGER sync_cost_deletion_cascade_trigger
  BEFORE DELETE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cost_deletion_cascade();


-- ============ D. Nuevo trigger: DELETE payment → desvincula cost ============
CREATE OR REPLACE FUNCTION public.on_supplier_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Desvincular el cost (no eliminarlo, puede tener otros usos)
  IF OLD.cost_id IS NOT NULL THEN
    UPDATE costs SET supplier_payment_id = NULL WHERE id = OLD.cost_id;
    RAISE NOTICE '[Payment DELETE] Unlinked cost % from payment %', OLD.cost_id, OLD.id;
  END IF;
  
  -- También desvincular costs que referencien este payment via supplier_payment_id
  UPDATE costs SET supplier_payment_id = NULL WHERE supplier_payment_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_supplier_payment_delete_trigger ON public.supplier_payments;
CREATE TRIGGER on_supplier_payment_delete_trigger
  BEFORE DELETE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_supplier_payment_delete();
