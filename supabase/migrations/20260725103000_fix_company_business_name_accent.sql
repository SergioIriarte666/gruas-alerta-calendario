-- El encabezado de todos los PDF toma company_data.business_name, que estaba
-- guardado sin tilde ("Gruas 5 Norte"). El acta de inspección sale así al
-- cliente y al asegurador. Corrección de dato, no de código.
--
-- Condicionado al valor exacto sin tilde: si alguien ya lo corrigió a mano o
-- cambió la razón social, esta migración no toca nada.

BEGIN;

UPDATE public.company_data
SET business_name = 'Grúas 5 Norte',
    updated_at = now()
WHERE business_name = 'Gruas 5 Norte';

COMMIT;
