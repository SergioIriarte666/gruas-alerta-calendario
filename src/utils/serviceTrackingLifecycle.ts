import type { Service, ServiceStatus } from '@/types';

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

/** Por qué NO se puede compartir el seguimiento de este servicio. */
export type TrackingShareBlock = 'service_closed' | 'missing_origin' | 'missing_destination';

type ShareableService = Pick<
  Service,
  'status' | 'originLat' | 'originLng' | 'destinationLat' | 'destinationLng'
>;

/**
 * ¿Hay algo que impida compartir el seguimiento, y qué?
 *
 * Espeja las precondiciones de `assert_tracking_service_coordinates`, que es
 * quien manda. Falla temprano y visible: el 31/07 el operador tocó "compartir"
 * en ruta y recibió un error por un dato que sólo se arregla desde el admin.
 *
 * La comparación es `=== null` a propósito, no un chequeo de "falsy". El
 * transformador escribe `null` cuando la coordenada realmente falta; un
 * `undefined` significa que el registro viene de la caché offline anterior a
 * que estas columnas se pidieran, y ahí NO se bloquea: sobre un dato que no
 * tenemos decide el servidor, no una suposición del teléfono.
 */
export const resolveTrackingShareBlock = (
  service?: ShareableService | null,
): TrackingShareBlock | null => {
  if (!service) return null;
  if (isFinalServiceStatus(service.status)) return 'service_closed';
  if (service.originLat === null || service.originLng === null) return 'missing_origin';
  if (service.destinationLat === null || service.destinationLng === null) return 'missing_destination';
  return null;
};

/**
 * Qué se le dice al operador en cada caso.
 *
 * `description` tiene que nombrar la ACCIÓN real. El 31/07 salió "Confirma el
 * destino exacto del servicio antes de compartir el seguimiento — Revisa tu
 * conexión e inténtalo de nuevo": el título acertaba y la descripción mentía.
 * El operador reintentó culpando a la señal por un dato que sólo se corrige
 * desde el módulo Servicios.
 */
export const TRACKING_SHARE_BLOCK_COPY: Record<
  TrackingShareBlock,
  { label: string; title: string; description: string }
> = {
  service_closed: {
    label: 'El servicio ya terminó: no hay seguimiento que compartir',
    title: 'El servicio ya terminó',
    description: 'El seguimiento en vivo se cerró junto con el servicio.',
  },
  missing_origin: {
    label: 'El origen del servicio no tiene ubicación registrada',
    title: 'El origen del servicio no tiene ubicación registrada',
    description: 'Pídele a la central que complete el origen en el módulo Servicios. No es tu señal: reintentar no lo arregla.',
  },
  missing_destination: {
    label: 'El destino del servicio no tiene ubicación registrada',
    title: 'El destino del servicio no tiene ubicación registrada',
    description: 'Pídele a la central que complete el destino en el módulo Servicios. No es tu señal: reintentar no lo arregla.',
  },
};

/**
 * SQLSTATE con el que la base rechaza un dato inválido del servicio
 * (`assert_tracking_service_coordinates` y `assert_location_matches_locked_catalog`
 * levantan todas sus validaciones con este código). Distinguirlo es lo que
 * permite no vender un problema de datos como un problema de conexión.
 */
export const INVALID_SERVICE_DATA_SQLSTATE = '22023';

export const describeTrackingShareFailure = (
  code?: string | null,
): string => {
  if (code === INVALID_SERVICE_DATA_SQLSTATE) {
    return 'Los datos de ubicación del servicio están incompletos. Hay que corregirlos en el módulo Servicios; reintentar no lo arregla.';
  }
  if (code === '42501') {
    return 'No tienes permiso para compartir el seguimiento de este servicio.';
  }
  return 'Revisa tu conexión e inténtalo de nuevo.';
};
