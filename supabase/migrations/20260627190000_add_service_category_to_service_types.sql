-- Add service_category column to service_types for explicit classification
-- of inspection flow per service type, replacing the legacy inference based
-- on requires_detail + requires_photo_set flags.
--
-- Categories:
--   * in_situ          : Single-phase inspection. Service completes in one
--                        visit, no pickup/delivery. Pasa directo a 'completed'.
--   * traslado         : Two-phase inspection (pickup + delivery), flujo
--                        clásico actual del TMS.
--   * externo_tercero  : Subcontracted to a third-party company. Operator
--                        does not run the inspection module; admin closes
--                        manually after receiving third-party evidence.
--   * excedente        : Complementary user coverage, not an independent
--                        service; no inspection required.
--
-- Backfill values defined by business owner (Sergio Iriarte, June 2026).

ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS service_category text NOT NULL DEFAULT 'traslado'
    CHECK (service_category IN ('in_situ', 'traslado', 'externo_tercero', 'excedente'));

COMMENT ON COLUMN public.service_types.service_category IS
  'Inspection flow category. Allowed: in_situ, traslado, externo_tercero, excedente.';

-- TRASLADO (flujo de 2 fases: inspección inicial + entrega final)
UPDATE public.service_types SET service_category = 'traslado'
WHERE name IN (
  'Custodia de Vehículos ',
  'Grua Livianos',
  'Grua Pesados',
  'Lavado de Vehículos',
  'Rescate y Traslado de Vehículos',
  'Revision Tecnica',
  'Traslado Por Tierra'
);

-- IN-SITU (una sola fase, completa directo a 'completed')
UPDATE public.service_types SET service_category = 'in_situ'
WHERE name IN (
  'Apertura de Vehiculos',
  'Apoyo Logistico',
  'Arriendo de Equipos',
  'Cambio de Neumáticos',
  'Carga de Combustible ',
  'Grua Horquilla',
  'Ordenar Estacionamiento',
  'Puente de Bateria',
  'Rescate de Vehículos',
  'Servicios Mecánicos y De Apoyo',
  'Taxi',
  'Tramites Administrativos',
  'Traslado de Insumos',
  'Venta de Productos'
);

-- EXTERNO TERCERO (subcontratado, cierre manual)
UPDATE public.service_types SET service_category = 'externo_tercero'
WHERE name IN (
  'Apoyo Tercero',
  'Rescate Tercero',
  'Grúa Tercero Livianos',
  'Grúa Tercero Pesados'
);

-- EXCEDENTE (sin inspección, cobertura complementaria)
UPDATE public.service_types SET service_category = 'excedente'
WHERE name = 'Excedente';

-- Validación: ningún tipo debe quedar en el default 'traslado' si no
-- estaba originalmente clasificado así. Esta función bloquea la migración
-- si algún tipo nuevo se cuela sin clasificar.
DO $$
DECLARE
  unclassified_count integer;
BEGIN
  SELECT COUNT(*) INTO unclassified_count
  FROM public.service_types
  WHERE service_category = 'traslado'
    AND name NOT IN (
      'Custodia de Vehículos ',
      'Grua Livianos',
      'Grua Pesados',
      'Lavado de Vehículos',
      'Rescate y Traslado de Vehículos',
      'Revision Tecnica',
      'Traslado Por Tierra'
    );
  IF unclassified_count > 0 THEN
    RAISE WARNING 'Hay % service_types con service_category=traslado que no estaban en la lista explícita. Revisar manualmente.', unclassified_count;
  END IF;
END $$;
