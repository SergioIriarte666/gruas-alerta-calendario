-- =========================================================================
-- ELIMINACIÓN COMPLETA DEL MÓDULO DE FACTURACIÓN DIFERIDA
-- =========================================================================
-- Este script elimina todas las estructuras de base de datos relacionadas
-- con el módulo de facturación diferida que ya no se utilizará.
-- =========================================================================

-- 1. Eliminar vista de servicios listos para facturación diferida
DROP VIEW IF EXISTS services_ready_for_deferred_billing;

-- 2. Eliminar función para calcular fecha de facturación
DROP FUNCTION IF EXISTS calculate_billing_date(date, integer, integer);

-- 3. Eliminar función para obtener resumen de servicios diferidos
DROP FUNCTION IF EXISTS get_deferred_services_summary();

-- 4. Eliminar índice de ciclo de facturación
DROP INDEX IF EXISTS idx_clients_billing_cycle;

-- 5. Eliminar columnas relacionadas con facturación diferida de la tabla clients
ALTER TABLE clients 
  DROP COLUMN IF EXISTS billing_cycle_type,
  DROP COLUMN IF EXISTS billing_delay_days,
  DROP COLUMN IF EXISTS billing_cycle_day,
  DROP COLUMN IF EXISTS auto_invoice_generation,
  DROP COLUMN IF EXISTS billing_notes;