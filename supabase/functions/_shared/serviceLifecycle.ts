/**
 * Estados en los que un servicio ya no admite seguimiento en vivo.
 *
 * Espejo exacto de la lista que usan `get_or_create_tracking_token` y el
 * trigger `reject_tracking_link_on_closed_service` (migracion 20260731120000),
 * y del util del front `src/utils/serviceTrackingLifecycle.ts`. La base es la
 * que gana la carrera; estas listas solo evitan llegar hasta ella.
 */
export const FINAL_SERVICE_STATUSES: readonly string[] = [
  "completed",
  "cancelled",
  "failed",
  "invoiced",
  "partially_invoiced",
];

export const isFinalServiceStatus = (status: string | null | undefined): boolean =>
  !!status && FINAL_SERVICE_STATUSES.includes(status);
