-- Crear registro de inventario para pago existente de "Pulmon de Suspension"
-- Payment ID: 2b252c81-d454-43b4-89b5-0c4d12826464

DO $$
DECLARE
  v_item_id UUID;
  v_location_id UUID := '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c'; -- Bodega Principal
  v_payment_id UUID := '2b252c81-d454-43b4-89b5-0c4d12826464';
  v_user_id UUID := 'c6342c12-a2b4-420a-a2c0-439d1188887b';
BEGIN
  -- Crear el item de inventario si no existe
  INSERT INTO inventory_items (
    name,
    unit_of_measure,
    unit_cost,
    created_by
  ) VALUES (
    'Pulmon de Suspension',
    'unidad',
    100790,
    v_user_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_item_id;

  -- Si ya existía, obtener su ID
  IF v_item_id IS NULL THEN
    SELECT id INTO v_item_id 
    FROM inventory_items 
    WHERE name = 'Pulmon de Suspension';
  END IF;

  -- Crear el movimiento de inventario
  INSERT INTO inventory_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    crane_id,
    supplier_id,
    movement_date,
    reason,
    observations,
    created_by
  ) VALUES (
    v_item_id,
    v_location_id,
    'entry',
    1,
    100790,
    100790,
    '56293886-d5a0-4e04-9bd2-a405e3b49cdb',
    '74e628e2-d8b3-42f2-942f-bb6f09b2b73f',
    '2025-10-29',
    'Compra desde módulo de proveedores',
    'Pago: 6051240 | Factura Electrónica N° 6051240 - Implementos S.A.',
    v_user_id
  );

END $$;