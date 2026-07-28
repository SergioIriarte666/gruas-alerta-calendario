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

/** Servicios "en vuelo": los que la jornada puede confundir entre sí. */
export const IN_FLIGHT_OPERATOR_SERVICE_STATUSES = [
  'pending',
  'in_progress',
  'inspection_completed',
] as const;

/**
 * ¿Es SUYO el servicio, o solo está autorizado en él?
 *
 * Un servicio tiene muchos operadores autorizados —el principal más los
 * adicionales de service_resources— pero UNA sola grúa transmitiendo. Para
 * decidir de quién es la POSICIÓN del servicio, "estar asignado" es la pregunta
 * equivocada: el 28/07, tras el relevo Sergio -> Jesús, el teléfono de Sergio
 * seguía etiquetando puntos al folio 3262047-1 porque seguía figurando como
 * Adicional. La página del cliente alternaba entre el punto más fresco de cada
 * teléfono y la grúa saltaba 430 km entre el corte y Grúas 5 Norte.
 *
 * Sin `operatorId` no se filtra, por compatibilidad con los llamadores que no
 * lo tienen. La guarda de verdad vive en la base
 * (enforce_principal_operator_service_binding): la app del operador es
 * Capacitor y las versiones viejas siguen en terreno indefinidamente.
 */
export const isPrincipalOperatorOfService = (
  service: Service,
  operatorId?: string | null,
): boolean => !operatorId || service.operator?.id === operatorId;

export interface OperatorServiceSelection {
  /** Servicios en vuelo, en orden de prioridad operativa. */
  candidates: Service[];
  /** true cuando hay más de uno y el operador todavía no eligió. */
  requiresSelection: boolean;
  /** Servicio en curso resuelto, o null si es ambiguo. */
  activeService: Service | null;
  /** Servicio al que se asocia la transmisión, o null si es ambiguo. */
  trackingService: Service | null;
}

/**
 * Resolución ÚNICA del servicio del portal operador, para todos los flujos
 * (transmisión, detenciones, compartir link, entrega).
 *
 * Con un solo servicio en vuelo se resuelve solo. Con dos o más NO SE ADIVINA:
 * el sistema exige una elección explícita y, mientras no la haya, no cuelga nada
 * de ningún servicio. La noche del 25/07 el operador tenía TEST-TRACK-01 en
 * curso y SRV-6858 asignado para la mañana siguiente, y "el primero de la lista"
 * se llevó una detención que no era suya.
 */
export const resolveOperatorServiceSelection = (
  services: Service[],
  selectedServiceId?: string | null,
  /** Operador que mira. Sin él, `trackingService` no se filtra por titularidad. */
  operatorId?: string | null,
): OperatorServiceSelection => {
  const candidates = services
    .filter((service) =>
      (IN_FLIGHT_OPERATOR_SERVICE_STATUSES as readonly string[]).includes(service.status))
    .sort((a, b) => {
      const rank = (service: Service) =>
        service.status === 'in_progress' ? 0 : service.status === 'inspection_completed' ? 1 : 2;
      const byRank = rank(a) - rank(b);
      return byRank !== 0 ? byRank : (a.serviceDate || '').localeCompare(b.serviceDate || '');
    });

  // La transmisión solo puede colgar de un servicio PROPIO. El resto de la
  // resolución no cambia: un adicional sigue viendo el servicio en su jornada,
  // sigue pudiendo inspeccionar y declarar detenciones. Lo único que no hace es
  // teñir la posición del traslado con la de su camión.
  const bindable = (service: Service | null): Service | null =>
    service && isPrincipalOperatorOfService(service, operatorId) ? service : null;

  const selected = selectedServiceId
    ? candidates.find((service) => service.id === selectedServiceId) ?? null
    : null;

  if (selected) {
    return {
      candidates,
      requiresSelection: false,
      activeService: isActiveOperatorService(selected) ? selected : null,
      trackingService: bindable(selected),
    };
  }

  if (candidates.length > 1) {
    return { candidates, requiresSelection: true, activeService: null, trackingService: null };
  }

  return {
    candidates,
    requiresSelection: false,
    activeService: selectActiveOperatorService(candidates),
    trackingService: bindable(selectTrackingService(candidates)),
  };
};
