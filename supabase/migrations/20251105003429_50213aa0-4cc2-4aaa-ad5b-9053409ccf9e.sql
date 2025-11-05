
-- =========================================================================
-- CORRECCIÓN: Marcar comisiones anteriores a octubre como pagadas
-- =========================================================================
-- Las comisiones de meses anteriores a octubre ya fueron pagadas
-- Solo las de octubre y noviembre están pendientes
-- =========================================================================

-- Actualizar todas las comisiones anteriores a octubre 2025
-- Marcándolas como pagadas con su fecha de servicio como fecha de pago
UPDATE costs
SET 
  payment_date = date,
  updated_at = now()
WHERE subcategory = 'comisiones'
  AND date < '2025-10-01'
  AND payment_date IS NULL;
