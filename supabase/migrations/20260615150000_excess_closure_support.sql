BEGIN;

-- 1. Agregar value_type a closure_services para diferenciar qué monto aporta cada servicio
ALTER TABLE closure_services
  ADD COLUMN IF NOT EXISTS value_type text NOT NULL DEFAULT 'covered'
    CHECK (value_type IN ('covered', 'excess')),
  ADD COLUMN IF NOT EXISTS amount numeric;
-- amount almacena el monto específico que aporta este servicio al cierre
-- (client_covered_amount si covered, excess_amount si excess)

-- 2. Restricción: un mismo service_id no puede aparecer dos veces con el mismo value_type
--    en el mismo cierre (pero SÍ puede aparecer una vez como covered y otra como excess
--    en dos cierres distintos)
ALTER TABLE closure_services
  DROP CONSTRAINT IF EXISTS closure_services_unique_service_type;
ALTER TABLE closure_services
  ADD CONSTRAINT closure_services_unique_service_type
    UNIQUE (service_id, value_type);

-- 3. Agregar closure_type a service_closures para saber de qué tipo es el cierre
--    (redundante con client_id pero útil para queries rápidas)
ALTER TABLE service_closures
  ADD COLUMN IF NOT EXISTS closure_type text NOT NULL DEFAULT 'covered'
    CHECK (closure_type IN ('covered', 'excess'));

-- 4. Índices de soporte
CREATE INDEX IF NOT EXISTS idx_closure_services_value_type
  ON closure_services(value_type);
CREATE INDEX IF NOT EXISTS idx_service_closures_closure_type
  ON service_closures(closure_type);

COMMIT;
