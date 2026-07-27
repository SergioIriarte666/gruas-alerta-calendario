/**
 * Decisión de QUÉ dice la tarjeta principal de /track: rótulo, objetivo y de
 * dónde sale el número.
 *
 * Vive fuera del componente porque el rótulo y el objetivo tienen que moverse
 * juntos y hasta ahora nada lo garantizaba. El objetivo del ETA lo declara el
 * servidor (`eta_target`) y quedó validado contra la función desplegada; el
 * rótulo vivía solo en el cliente, sin red. Un número correcto con la etiqueta
 * equivocada miente igual que el bug de SRV-6858 —"TU GRÚA LLEGA EN 2 min" con
 * la entrega a hora y media—, y ninguna prueba habría fallado.
 *
 * Reglas, en orden de precedencia:
 *   1. Detención declarada → ETA suspendido con leyenda del motivo.
 *   2. Recorrido cargado sin servicio iniciado → sin guía (SRV-6853).
 *   3. Multidestino → rótulo por parada objetivo.
 *   4. En el lugar → sin número: contradice el ETA-al-origen cacheado.
 *   5. Etapa pre-carga → "Tu grúa llega en" + ORIGEN.
 *   6. Etapa towing en adelante → "Entrega estimada en" + DESTINO.
 *   7. Sin destino geocodificable → "Tu carga va en camino", sin número.
 */
export type EtaTargetKind = 'origin' | 'destination' | 'stop';

export const ETA_LABEL_TO_ORIGIN = 'Tu grúa llega en';
export const ETA_LABEL_TO_DESTINATION = 'Entrega estimada en';

export interface EtaLabelInput {
  /** Etapa publicada por el servidor (ya monotónica). */
  journeyStage?: string;
  /** Estado del seguimiento: `waiting` manda sobre la etapa. */
  state?: 'active' | 'no_signal' | 'waiting' | 'finished';
  /** Hacia dónde apunta el ETA publicado. Ausente en respuestas antiguas. */
  etaTarget?: EtaTargetKind;
  /** ETA vigente, si el servidor pudo calcularlo. */
  hasEta: boolean;
  /** true cuando el objetivo existe pero Google no rutea la zona. */
  etaUnavailable?: boolean;
  /** ¿Hay posición del móvil? Sin ella la tarjeta es un esqueleto. */
  hasPosition: boolean;
  /** ¿El objetivo de la etapa tiene coordenadas para la distancia en línea recta? */
  hasTargetCoords: boolean;
  /** Detención declarada en curso. */
  isStopped: boolean;
  /** Servicio multidestino con paradas. */
  hasStops: boolean;
  /** Parada objetivo pendiente (multidestino). */
  hasNextStop: boolean;
  /** false = recorrido cargado pero servicio aún no iniciado. */
  routeArmed?: boolean;
}

export type EtaPresentation =
  /** Detención declarada: el ETA queda suspendido a propósito. */
  | { kind: 'stopped' }
  /** Recorrido programado, servicio sin iniciar. */
  | { kind: 'not_started' }
  /** Multidestino con todas las paradas alcanzadas. */
  | { kind: 'arrived' }
  /** Número de minutos, con su rótulo y su objetivo. */
  | { kind: 'eta'; label: string; target: EtaTargetKind }
  /** Zona no ruteable: distancia en línea recta al objetivo de la etapa. */
  | { kind: 'straight_line'; target: EtaTargetKind }
  /** Grúa en el punto de origen: sin número, contradiría el título. */
  | { kind: 'on_site' }
  /** En traslado hacia un destino que no se pudo geocodificar. */
  | { kind: 'in_transit_unknown_destination' }
  /** Hay posición pero todavía no hay ETA. */
  | { kind: 'calculating' }
  /** Sin posición: esqueleto. */
  | { kind: 'waiting' };

export const resolveEtaLabel = (input: EtaLabelInput): EtaPresentation => {
  if (input.isStopped) return { kind: 'stopped' };

  if (input.hasStops && input.routeArmed === false) return { kind: 'not_started' };

  // El estado SIEMPRE manda sobre journey_stage: en `waiting` la página está en
  // fase inicial aunque la etapa diga otra cosa (SRV-6853).
  if (input.hasStops && input.journeyStage === 'arrived' && input.state !== 'waiting') {
    return { kind: 'arrived' };
  }

  if (input.hasStops && input.hasNextStop) {
    if (input.hasEta) return { kind: 'eta', label: '', target: 'stop' };
    if (input.hasPosition && input.etaUnavailable && input.hasTargetCoords) {
      return { kind: 'straight_line', target: 'stop' };
    }
    return input.hasPosition ? { kind: 'calculating' } : { kind: 'waiting' };
  }

  if (input.journeyStage === 'on_site') return { kind: 'on_site' };

  // Desde que el vehículo va cargado el ETA apunta al DESTINO, y el rótulo
  // tiene que decirlo. El objetivo lo declara el servidor: el cliente no lo
  // re-deduce de la etapa, o volvería a haber dos fuentes que pueden discrepar.
  const toDestination = input.etaTarget === 'destination';
  const target: EtaTargetKind = toDestination ? 'destination' : 'origin';

  if (input.hasEta) {
    return {
      kind: 'eta',
      label: toDestination ? ETA_LABEL_TO_DESTINATION : ETA_LABEL_TO_ORIGIN,
      target,
    };
  }

  if (input.hasPosition && input.etaUnavailable && input.hasTargetCoords) {
    return { kind: 'straight_line', target };
  }

  // Traslado en curso hacia un destino que el servidor no pudo geocodificar.
  // Decir "en camino" sin número es honesto; caer al ETA-al-origen para tener
  // algo que mostrar es exactamente el bug que esto corrige.
  if (toDestination) return { kind: 'in_transit_unknown_destination' };

  return input.hasPosition ? { kind: 'calculating' } : { kind: 'waiting' };
};
