import type { ServiceStatus } from '@/types';

/**
 * Estados que SACAN un servicio del portal del operador.
 *
 * Regla: la visibilidad operacional NO la decide el estado comercial. Un
 * servicio 'quoted' o 'purchase_order_pending' ya tiene grúa, operador y hora
 * asignados — que la cotización siga abierta con el cliente es un asunto de
 * administración, no del operador que tiene que salir a la calle.
 *
 * Incidente que originó esta constante (08-09 ago 2026): había 32 servicios en
 * 'quoted' invisibles para su operador asignado. Para poder operar se
 * eliminaron 3 servicios reales —uno EN VUELO con journey_stage 'towing', otro
 * con inspección firmada— y se recrearon, reutilizando el folio SRV-6887.
 *
 * Solo se excluye lo que ya no se puede trabajar:
 *   - 'invoiced'  → cerrado y facturado.
 *   - 'cancelled' → anulado.
 *   - 'failed'    → servicio fallido, cerrado.
 *
 * Todo lo demás (incluidos 'quoted', 'purchase_order_pending',
 * 'with_purchase_order', 'partially_invoiced') es visible para su operador.
 *
 * Cualquier filtro de estado del portal operador se construye desde acá. Si
 * aparece un literal suelto, es un bug esperando a repetirse.
 */
export const OPERATOR_HIDDEN_SERVICE_STATUSES = [
  'invoiced',
  'cancelled',
  'failed',
] as const satisfies readonly ServiceStatus[];

export type OperatorHiddenServiceStatus = (typeof OPERATOR_HIDDEN_SERVICE_STATUSES)[number];

/** Predicado equivalente para filtrar en memoria (caché offline, listas ya cargadas). */
export const isVisibleToOperator = (status: string | null | undefined): boolean =>
  !!status && !(OPERATOR_HIDDEN_SERVICE_STATUSES as readonly string[]).includes(status);

/**
 * Cláusula PostgREST para `.not('status', 'in', ...)`.
 * PostgREST espera la lista entre paréntesis: `(invoiced,cancelled,failed)`.
 */
export const OPERATOR_HIDDEN_STATUSES_POSTGREST = `(${OPERATOR_HIDDEN_SERVICE_STATUSES.join(',')})`;

/**
 * Estados desde los que el operador todavía puede ARRANCAR el servicio.
 *
 * Ver que el servicio esté en la lista no basta: la tarjeta tiene que ofrecer
 * "Iniciar Servicio" y el RPC `advance_operator_service_status` tiene que
 * aceptar la transición. Este arreglo es el espejo cliente de
 * `public.operator_startable_statuses()`; si cambia uno, cambian los dos.
 *
 * Queda fuera 'partially_invoiced': ya se facturó parte, no es trabajo nuevo.
 */
export const OPERATOR_STARTABLE_SERVICE_STATUSES = [
  'pending',
  'quoted',
  'purchase_order_pending',
  'with_purchase_order',
] as const satisfies readonly ServiceStatus[];

/** true si el operador puede iniciar el servicio desde este estado. */
export const isStartableByOperator = (status: string | null | undefined): boolean =>
  !!status && (OPERATOR_STARTABLE_SERVICE_STATUSES as readonly string[]).includes(status);
