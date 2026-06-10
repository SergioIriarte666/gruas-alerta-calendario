-- Activar el movimiento de salida cancelado para que aparezca en el historial
UPDATE inventory_movements 
SET status = 'active'
WHERE id = 'ac4aa557-779f-44ff-9c98-fd1e4a1decb9'
AND movement_type = 'exit'
AND status = 'cancelled';