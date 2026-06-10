-- Eliminar registro huérfano de invoice_closures para CIE-109
-- Este cierre pertenecía a una factura anulada (FACT-4068) y debe quedar disponible para re-facturación
DELETE FROM invoice_closures 
WHERE id = '285f3ffa-1dbc-4c67-9eb1-a323d9a3255e';