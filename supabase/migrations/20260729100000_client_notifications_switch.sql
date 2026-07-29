-- Interruptor de notificaciones al cliente, POR SERVICIO.
--
-- Hasta hoy el cortafuegos contra envíos a clientes reales eran los datos: los
-- servicios de prueba llevaban teléfono y correo placeholder, y los canales
-- automáticos morían solos al no poder normalizar el destinatario. Funcionó
-- casi siempre. El 25/07 un correo salió `sent` igual hacia un dominio con
-- error de tipeo: bastó un dato menos envenenado de lo previsto.
--
-- Un cortafuegos tiene que ser de DISEÑO, no de datos. `client_notifications_enabled`
-- arranca en false para TODO servicio —existente y nuevo—: nada sale hacia el
-- cliente hasta que alguien lo encienda a mano en el detalle del servicio.
--
-- Solo cubre los canales HACIA EL CLIENTE. Las alertas internas (operadores,
-- admin, watchdog de telemetría) no consultan este flag y siguen saliendo:
-- apagar la voz hacia afuera no puede dejar ciega a la operación.
--
-- ADD COLUMN con DEFAULT es metadata-only desde PG 11 (no reescribe la tabla),
-- así que no toma un lock largo sobre `services` con un traslado en curso.

BEGIN;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS client_notifications_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.services.client_notifications_enabled IS
  'Interruptor por servicio de los canales automáticos HACIA EL CLIENTE (tracking_link, inspection_email/whatsapp, delivery_email/whatsapp). Apagado por defecto: el outbox marca skipped/client_notifications_disabled. No afecta alertas internas a operadores ni admin.';

/**
 * ¿Puede este servicio hablarle al cliente?
 *
 * Función explícita en vez de leer la columna suelta: deja el criterio en un
 * solo lugar y le da al procesador del outbox un contrato estable si mañana la
 * regla se vuelve compuesta (p. ej. un interruptor global además del de fila).
 */
CREATE OR REPLACE FUNCTION public.service_client_notifications_enabled(p_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT s.client_notifications_enabled FROM public.services s WHERE s.id = p_service_id),
    false
  );
$$;

COMMENT ON FUNCTION public.service_client_notifications_enabled(uuid) IS
  'true cuando el servicio tiene habilitados los envíos automáticos al cliente. Un servicio inexistente devuelve false: ante la duda, no se le escribe a nadie.';

REVOKE ALL ON FUNCTION public.service_client_notifications_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_client_notifications_enabled(uuid) TO authenticated, service_role;

COMMIT;
