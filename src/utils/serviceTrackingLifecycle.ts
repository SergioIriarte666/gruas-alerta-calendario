import type { ServiceStatus } from '@/types';

/**
 * Estados en los que un servicio ya no admite seguimiento en vivo.
 *
 * Espejo exacto de la lista que usan `get_or_create_tracking_token` y el
 * trigger `reject_tracking_link_on_closed_service` (migración
 * 20260731120000). La base es la que gana la carrera —el front sólo evita
 * llegar hasta ella—, pero las dos listas tienen que decir lo mismo.
 *
 * El bug: el 31/07 a las 16:59:34 la cascada de cierre revocó el link del
 * servicio y ocho segundos después se creó uno NUEVO sobre un servicio ya
 * 'completed'. Token público vivo, válido 7 días, jamás compartido.
 */
export const FINAL_SERVICE_STATUSES: readonly ServiceStatus[] = [
  'completed',
  'cancelled',
  'failed',
  'invoiced',
  'partially_invoiced',
];

export const isFinalServiceStatus = (status?: ServiceStatus | string | null): boolean =>
  !!status && (FINAL_SERVICE_STATUSES as readonly string[]).includes(status);
