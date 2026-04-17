-- Corregir salidas descuadradas para folios 5245639 y 5246554
-- Las salidas usaban PrcItem (bruto) en vez de MontoItem/Qty (neto con descuento)
UPDATE inventory_movements AS exit_mov
SET unit_cost = entry_mov.unit_cost,
    total_cost = entry_mov.unit_cost * exit_mov.quantity
FROM inventory_movements AS entry_mov
WHERE exit_mov.movement_type = 'exit'
  AND entry_mov.movement_type = 'entry'
  AND exit_mov.cost_id = entry_mov.cost_id
  AND exit_mov.item_id = entry_mov.item_id
  AND exit_mov.cost_id IN (
    SELECT id FROM costs WHERE document_number IN ('5245639', '5246554')
  );