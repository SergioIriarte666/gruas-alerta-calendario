import type { ServiceStatus } from '@/types';

/**
 * Qué ve un operador en su portal.
 *
 * Regla de negocio, textual del dueño (09-08-2026):
 *   "si el servicio está en etapa de cotizado u OC, con fecha futura, se debe ver".
 *
 * O sea: el estado comercial no esconde el servicio, pero tampoco lo deja
 * colgado para siempre. Un servicio operacional se ve pase lo que pase con la
 * fecha; uno comercial solo mientras siga por delante.
 *
 * Incidente que originó esta constante (08-09 ago 2026): 32 servicios en
 * 'quoted' invisibles para su operador asignado. Para poder operar se
 * eliminaron 3 servicios reales —uno EN VUELO con journey_stage 'towing', otro
 * con inspección firmada— y se recrearon, reutilizando el folio SRV-6887.
 *
 * Todo filtro de estado del portal operador se construye desde acá. Un literal
 * suelto es un bug esperando a repetirse: el bloqueo original vivía en TRES
 * capas a la vez (fetcher, tarjeta y RPC).
 */

/** Trabajo real en curso o ya hecho: se ven SIEMPRE, sin condición de fecha. */
export const OPERATOR_OPERATIONAL_SERVICE_STATUSES = [
  'pending',
  'in_progress',
  'inspection_completed',
  'completed',
] as const satisfies readonly ServiceStatus[];

/**
 * Etapa comercial (cotización u orden de compra): se ven SOLO si la fecha del
 * servicio es hoy o futura. Una cotización de junio que nunca se concretó no
 * tiene por qué seguir ocupando la jornada del operador.
 *
 * 'purchase_order_pending' entra acá por la misma frase de la regla ("u OC"):
 * esperar la OC es una etapa de OC igual que tenerla.
 */
export const OPERATOR_COMMERCIAL_SERVICE_STATUSES = [
  'quoted',
  'purchase_order_pending',
  'with_purchase_order',
] as const satisfies readonly ServiceStatus[];

/**
 * Cerrados: nunca se ven. Se listan explícitamente para dejar constancia, pero
 * la visibilidad es una lista BLANCA: cualquier estado que no esté en
 * operacionales ni en comerciales tampoco se muestra (hoy, 'partially_invoiced').
 */
export const OPERATOR_HIDDEN_SERVICE_STATUSES = [
  'invoiced',
  'cancelled',
  'failed',
] as const satisfies readonly ServiceStatus[];

const OPERATIONAL = OPERATOR_OPERATIONAL_SERVICE_STATUSES as readonly string[];
const COMMERCIAL = OPERATOR_COMMERCIAL_SERVICE_STATUSES as readonly string[];

/**
 * Cláusula para `.or()` de PostgREST:
 *   (status operacional) OR (status comercial AND service_date >= hoy)
 *
 * `today` va en formato YYYY-MM-DD y en TZ del negocio (getBusinessToday()):
 * comparar contra el día del navegador adelanta o atrasa el corte según dónde
 * esté el teléfono.
 */
export const buildOperatorVisibilityFilter = (today: string): string =>
  [
    `status.in.(${OPERATIONAL.join(',')})`,
    `and(status.in.(${COMMERCIAL.join(',')}),service_date.gte.${today})`,
  ].join(',');

/**
 * Mismo criterio para filtrar en memoria (caché offline, listas ya cargadas).
 * `serviceDate` en YYYY-MM-DD; sin fecha, un servicio comercial no se muestra
 * —no hay con qué decidir que sigue vigente—.
 */
export const isVisibleToOperator = (
  status: string | null | undefined,
  serviceDate?: string | null,
  today: string = '',
): boolean => {
  if (!status) return false;
  if (OPERATIONAL.includes(status)) return true;
  if (!COMMERCIAL.includes(status)) return false;
  return !!serviceDate && !!today && serviceDate >= today;
};

/**
 * Estados desde los que el operador puede ARRANCAR el servicio.
 *
 * Espejo cliente de `public.operator_startable_statuses()`; si cambia uno,
 * cambia el otro. Que el servicio se vea no basta: la tarjeta tiene que ofrecer
 * "Iniciar Servicio" y el RPC `advance_operator_service_status` tiene que
 * aceptar la transición.
 */
export const OPERATOR_STARTABLE_SERVICE_STATUSES = [
  'pending',
  ...OPERATOR_COMMERCIAL_SERVICE_STATUSES,
] as const satisfies readonly ServiceStatus[];

/** true si el operador puede iniciar el servicio desde este estado. */
export const isStartableByOperator = (status: string | null | undefined): boolean =>
  !!status && (OPERATOR_STARTABLE_SERVICE_STATUSES as readonly string[]).includes(status);
