-- Crear función para registrar automáticamente los pagos de proveedores en costos
CREATE OR REPLACE FUNCTION create_cost_from_supplier_payment()
RETURNS TRIGGER AS $$
DECLARE
  payment_category_id UUID;
  cost_description TEXT;
  cost_notes TEXT;
BEGIN
  -- Solo procesar cuando el pago cambia a estado "paid"
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
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
    cost_description := 'Pago a proveedor: ' || NEW.supplier_name;
    IF NEW.invoice_number IS NOT NULL THEN
      cost_description := cost_description || ' - Factura: ' || NEW.invoice_number;
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
      NEW.paid_amount,
      payment_category_id,
      NEW.payment_date,
      cost_description,
      cost_notes,
      CASE 
        WHEN NEW.category ILIKE '%combustible%' OR NEW.category ILIKE '%gasolina%' OR NEW.category ILIKE '%diesel%' THEN 'Combustible'
        WHEN NEW.category ILIKE '%mantenimiento%' OR NEW.category ILIKE '%reparaci%' OR NEW.category ILIKE '%repuesto%' THEN 'Mantenimiento'
        WHEN NEW.category ILIKE '%seguro%' OR NEW.category ILIKE '%insurance%' THEN 'Seguros'
        WHEN NEW.category ILIKE '%administrat%' OR NEW.category ILIKE '%oficina%' THEN 'Administrativo'
        ELSE NEW.category
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Crear trigger para la función
DROP TRIGGER IF EXISTS supplier_payment_to_cost_trigger ON public.supplier_payments;
CREATE TRIGGER supplier_payment_to_cost_trigger
  AFTER UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_cost_from_supplier_payment();

-- También crear trigger para INSERT en caso de que se cree directamente como pagado
CREATE TRIGGER supplier_payment_to_cost_insert_trigger
  AFTER INSERT ON public.supplier_payments
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION create_cost_from_supplier_payment();

-- Crear función para sincronizar pagos existentes con costos (uso manual por admin)
CREATE OR REPLACE FUNCTION sync_existing_supplier_payments_to_costs()
RETURNS jsonb AS $$
DECLARE
  synced_count INTEGER := 0;
  payment_record RECORD;
  payment_category_id UUID;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden ejecutar esta función de sincronización';
  END IF;

  -- Obtener o crear la categoría "Pagos a Proveedores"
  SELECT id INTO payment_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%pago%proveedor%' OR name ILIKE '%supplier%payment%'
  LIMIT 1;
  
  IF payment_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Pagos a Proveedores', 'Pagos realizados a proveedores y facturas de servicios')
    RETURNING id INTO payment_category_id;
  END IF;

  -- Sincronizar pagos existentes que están pagados pero no tienen costo asociado
  FOR payment_record IN 
    SELECT sp.*
    FROM public.supplier_payments sp
    WHERE sp.status = 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM public.costs c WHERE c.supplier_payment_id = sp.id
    )
  LOOP
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
      payment_record.paid_amount,
      payment_category_id,
      payment_record.payment_date,
      'Pago a proveedor: ' || payment_record.supplier_name || 
      CASE WHEN payment_record.invoice_number IS NOT NULL THEN ' - Factura: ' || payment_record.invoice_number ELSE '' END,
      'Pago sincronizado automáticamente desde proveedor. ' ||
      CASE WHEN payment_record.description IS NOT NULL THEN 'Descripción: ' || payment_record.description || '. ' ELSE '' END ||
      CASE WHEN payment_record.notes IS NOT NULL THEN 'Notas: ' || payment_record.notes ELSE '' END,
      CASE 
        WHEN payment_record.category ILIKE '%combustible%' OR payment_record.category ILIKE '%gasolina%' OR payment_record.category ILIKE '%diesel%' THEN 'Combustible'
        WHEN payment_record.category ILIKE '%mantenimiento%' OR payment_record.category ILIKE '%reparaci%' OR payment_record.category ILIKE '%repuesto%' THEN 'Mantenimiento'
        WHEN payment_record.category ILIKE '%seguro%' OR payment_record.category ILIKE '%insurance%' THEN 'Seguros'
        WHEN payment_record.category ILIKE '%administrat%' OR payment_record.category ILIKE '%oficina%' THEN 'Administrativo'
        ELSE payment_record.category
      END,
      payment_record.id,
      payment_record.created_by
    );
    
    synced_count := synced_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'synced_payments', synced_count,
    'message', format('Sincronizados %s pagos existentes con sus costos correspondientes', synced_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';