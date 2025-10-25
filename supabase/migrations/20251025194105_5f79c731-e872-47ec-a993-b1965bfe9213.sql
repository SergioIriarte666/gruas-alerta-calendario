-- Eliminar pago accidental que se creó sin querer
-- Cliente: Salinas y Fabres - Autycam
-- Monto: $2,189,600.00
-- Fecha: 2025-10-25 19:37:58

DELETE FROM payments 
WHERE id = 'b3b30623-8bcd-4be2-8c94-07172859ea32'
  AND status = 'pending'
  AND created_at > NOW() - INTERVAL '1 hour';