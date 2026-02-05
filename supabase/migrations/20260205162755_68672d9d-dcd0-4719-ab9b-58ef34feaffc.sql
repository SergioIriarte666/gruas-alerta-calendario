-- =====================================================
-- Sincronización Bidireccional: Costs → Supplier Payments
-- =====================================================

-- 1. Agregar columna cost_id en supplier_payments si no existe
ALTER TABLE public.supplier_payments 
ADD COLUMN IF NOT EXISTS cost_id UUID REFERENCES public.costs(id);

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_supplier_payments_cost_id 
ON public.supplier_payments(cost_id);

-- 2. Función trigger: Crear pago a proveedor cuando se inserta un costo
CREATE OR REPLACE FUNCTION public.create_supplier_payment_from_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  -- Solo procesar si tiene supplier_id
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- No crear si ya fue creado desde un payment (evitar ciclo)
  IF NEW.supplier_payment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar si ya existe un payment para este costo
  IF EXISTS (SELECT 1 FROM supplier_payments WHERE cost_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Crear el pago a proveedor
  INSERT INTO supplier_payments (
    supplier_id,
    amount,
    due_date,
    paid_date,
    description,
    status,
    cost_id,
    category,
    created_by
  ) VALUES (
    NEW.supplier_id,
    NEW.amount,
    COALESCE(NEW.payment_date, NEW.date),
    CASE WHEN NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE THEN NEW.payment_date ELSE NULL END,
    NEW.description,
    CASE 
      WHEN NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE THEN 'paid'
      ELSE 'pending'
    END,
    NEW.id,
    NEW.category_id::TEXT,
    NEW.created_by
  ) RETURNING id INTO v_payment_id;
  
  -- Actualizar el costo con la referencia al pago creado
  UPDATE costs 
  SET supplier_payment_id = v_payment_id 
  WHERE id = NEW.id;
  
  RAISE NOTICE '[Cost→SupplierPayment] Pago creado: % para costo: %', v_payment_id, NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear trigger AFTER INSERT
DROP TRIGGER IF EXISTS create_supplier_payment_from_cost_trigger ON public.costs;
CREATE TRIGGER create_supplier_payment_from_cost_trigger
  AFTER INSERT ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_supplier_payment_from_cost();