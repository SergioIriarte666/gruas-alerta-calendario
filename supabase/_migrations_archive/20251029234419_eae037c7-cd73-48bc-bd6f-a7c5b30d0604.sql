
-- Eliminar el costo duplicado de "Mantenimiento" 
-- Este fue creado automáticamente cuando se marcó el pago como "paid"
-- pero no tiene inventory_movement_id asociado

DELETE FROM costs
WHERE id = '06c25524-8eb0-4c85-850d-631eef5481c0'
  AND description = 'Factura Electrónica N° 6051240 - Implementos S.A.'
  AND amount = 100790
  AND inventory_movement_id IS NULL;
