-- Control independiente para decidir qué tipos de servicio pueden solicitar
-- los clientes. La activación general sigue gobernando su uso en TMS.

ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS available_in_client_portal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.service_types.available_in_client_portal IS
  'Permite ofrecer el tipo de servicio en el formulario del Portal Clientes.';

-- Los servicios operacionales propios existentes continúan disponibles.
-- Tercerizados, excedentes y tipos creados para pruebas quedan ocultos.
UPDATE public.service_types
SET available_in_client_portal = (
  service_category IN ('in_situ', 'traslado')
  AND NOT is_outsourced
  AND name NOT IN ('Test', 'Servicio Test App Review')
);

ALTER TABLE public.service_types
  ADD CONSTRAINT service_types_client_portal_availability_check
  CHECK (
    NOT available_in_client_portal
    OR (
      service_category IN ('in_situ', 'traslado')
      AND NOT is_outsourced
    )
  );
