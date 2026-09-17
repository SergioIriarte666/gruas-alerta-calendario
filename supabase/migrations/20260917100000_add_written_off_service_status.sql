-- Castigo formal de servicios incobrables: el valor de enum, solo.
--
-- La auditoría contable encontró servicios completados que nunca se facturaron
-- al cliente y ya son incobrables (SRV-6214: la factura SII 4013 se emitió por
-- 1 de los 2 servicios de la OC 4701648666). Sin un estado propio quedaban
-- eternamente contados como "pendientes de facturar", inflando la cartera.
--
-- Va SOLO en esta migración a propósito: Postgres no permite usar un valor de
-- enum recién agregado dentro de la misma transacción que lo agregó. La
-- migración que sigue (20260917100100) ya lo puede referenciar.

ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'written_off';
