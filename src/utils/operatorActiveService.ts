import type { Service } from '@/types';

/**
 * Servicio EN CURSO del operador.
 *
 * Mismo criterio que usa el motor de guía de ruta y la edge function
 * service-tracking: el estado del servicio, nunca la tarjeta "próximo
 * servicio". `pending` es "asignado pero NO iniciado" y queda fuera a
 * propósito.
 *
 * Prueba en terreno del 25/07: la detención "Descanso" de las 21:11 se escribió
 * con el service_id de SRV-6858 —un servicio de la mañana SIGUIENTE que solo
 * estaba en la tarjeta de resumen— en vez del servicio que efectivamente estaba
 * transmitiendo. Hubo que corregirla a mano en la base de datos.
 */
export const ACTIVE_OPERATOR_SERVICE_STATUSES = ['in_progress', 'inspection_completed'] as const;

export const isActiveOperatorService = (service: Service): boolean =>
  (ACTIVE_OPERATOR_SERVICE_STATUSES as readonly string[]).includes(service.status);

/**
 * El servicio en curso, o null si no hay ninguno. `in_progress` tiene
 * precedencia sobre `inspection_completed`: si el operador ya arrancó el
 * siguiente traslado, ese es el que está ocurriendo.
 */
export const selectActiveOperatorService = (services: Service[]): Service | null =>
  services.find((service) => service.status === 'in_progress')
  ?? services.find((service) => service.status === 'inspection_completed')
  ?? null;

/**
 * Servicio al que se asocia la TRANSMISIÓN. A diferencia del anterior, aquí sí
 * cae al próximo asignado: transmitir camino a levantar un servicio pendiente es
 * legítimo (es el "tu grúa va en camino" que ve el cliente). Lo que no es
 * legítimo es colgarle a ese pendiente eventos del traslado en curso.
 */
export const selectTrackingService = (services: Service[]): Service | null => {
  const active = selectActiveOperatorService(services);
  if (active) return active;

  const pending = services
    .filter((service) => service.status === 'pending')
    .sort((a, b) => (a.serviceDate || '').localeCompare(b.serviceDate || ''));

  return pending[0] ?? null;
};
