
-- =========================================================================
-- CORRECCIÓN DEFINITIVA: payment_date para comisiones_pagadas
-- =========================================================================
-- Problema: comisiones con subcategory='comisiones_pagadas' tienen payment_date NULL
-- Solución: Establecer payment_date = date para todas las comisiones ya pagadas
-- =========================================================================

-- Actualizar TODAS las comisiones que tienen subcategory='comisiones_pagadas'
-- pero no tienen payment_date establecido
UPDATE costs
SET 
  payment_date = date,
  updated_at = now()
WHERE subcategory = 'comisiones_pagadas'
  AND payment_date IS NULL;

-- Actualizar también las comisiones anteriores a octubre que tengan subcategory='comisiones'
UPDATE costs
SET 
  payment_date = date,
  updated_at = now()
WHERE subcategory = 'comisiones'
  AND date < '2025-10-01'
  AND payment_date IS NULL;
