-- Migración: Crear pagos a proveedores para costos históricos que no los tienen
-- Esta es una corrección única para datos existentes

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
)
SELECT 
  c.supplier_id,
  c.amount,
  COALESCE(c.payment_date, c.date),
  CASE WHEN c.payment_date IS NOT NULL THEN c.payment_date ELSE NULL END,
  c.description,
  CASE 
    WHEN c.payment_date IS NOT NULL THEN 'paid'
    ELSE 'pending'
  END,
  c.id,
  c.category_id::TEXT,
  c.created_by
FROM costs c
WHERE c.supplier_id IS NOT NULL 
  AND c.supplier_payment_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM supplier_payments sp WHERE sp.cost_id = c.id
  );

-- Actualizar los costos con la referencia al pago creado
UPDATE costs c
SET supplier_payment_id = sp.id
FROM supplier_payments sp
WHERE sp.cost_id = c.id
  AND c.supplier_payment_id IS NULL;