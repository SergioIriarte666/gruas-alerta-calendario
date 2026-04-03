
-- Eliminar el pago de proveedor huérfano
DELETE FROM supplier_payments WHERE id = '3bbbbb69-3524-4e56-84d7-8dc347e96723';

-- Eliminar el costo huérfano
DELETE FROM costs WHERE id = '99bca4d8-dd9d-4421-8e24-27cd1ccebe2d';
