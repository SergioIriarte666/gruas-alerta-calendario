/**
 * Detenciones declaradas durante un traslado. Distinto de `service_stops`, que
 * son las paradas PLANIFICADAS de un recorrido multidestino.
 */
export type StopReason =
  | 'combustible'
  | 'alimentacion'
  | 'descanso'
  | 'peaje'
  | 'ruta_cortada'
  | 'falla_mecanica'
  | 'otro';

export interface ServiceStopEvent {
  id: string;
  service_id: string;
  operator_id: string | null;
  reason: StopReason;
  note: string | null;
  started_at: string;
  ended_at: string | null;
  ended_by_source: 'manual' | 'auto_speed' | 'service_closed' | null;
}

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  combustible: 'Combustible',
  alimentacion: 'Alimentación',
  descanso: 'Descanso',
  peaje: 'Peaje',
  ruta_cortada: 'Ruta cortada',
  falla_mecanica: 'Falla mecánica',
  otro: 'Otro',
};

export const STOP_REASON_ORDER: StopReason[] = [
  'combustible',
  'alimentacion',
  'descanso',
  'peaje',
  // Los dos motivos serios de la Ruta 5 van antes de "Otro": son los que el
  // operador busca con prisa y con una mano.
  'ruta_cortada',
  'falla_mecanica',
  'otro',
];

/**
 * Umbrales de duración típica por motivo, definidos en terreno. Son señales de
 * posible anomalía para el admin, NO límites duros: nada se bloquea al pasarlos.
 *
 * Combustible: estanques de 200 L, llenado ~5 min → 15-20 min es lo normal.
 * Alimentación: similar.
 * Descanso: duración libre por diseño — `null` = nunca alertar.
 * Peaje: minutos.
 * Ruta cortada / Falla mecánica: `null` a propósito. Una carretera cortada por
 * un sistema frontal o una grúa en panne duran lo que duran —el 26/07 la Ruta 5
 * estuvo cortada horas—; alertar por duración ahí sería alertar siempre.
 */
export const STOP_REASON_ALERT_MINUTES: Record<StopReason, number | null> = {
  combustible: 30,
  alimentacion: 30,
  descanso: null,
  peaje: 15,
  ruta_cortada: null,
  falla_mecanica: null,
  otro: 60,
};

/**
 * Motivos que son un INCIDENTE, no una parada de rutina: algo impidió seguir.
 *
 * Se distinguen en el mapa de Ubicaciones porque, al no tener umbral de
 * duración, nunca se pintan como "excedida" y quedarían indistinguibles de un
 * café. Un corte de la Ruta 5 y una panne no son un café.
 */
export const INCIDENT_STOP_REASONS: readonly StopReason[] = ['ruta_cortada', 'falla_mecanica'];

export const isIncidentStopReason = (reason: StopReason): boolean =>
  INCIDENT_STOP_REASONS.includes(reason);

/** Inicial del marcador de detención en el mapa de recorrido (círculo de 1.5rem). */
export const STOP_REASON_MARKER_GLYPH: Record<StopReason, string> = {
  combustible: 'C',
  alimentacion: 'A',
  descanso: 'D',
  peaje: 'P',
  ruta_cortada: 'R',
  falla_mecanica: 'M',
  otro: 'O',
};

/** Constantes de reanudación automática, compartidas con el auto-encendido (3.6). */
export const AUTO_RESUME_SPEED_KMH = 10;
export const AUTO_RESUME_SUSTAIN_SECONDS = 60;

/**
 * ¿Esta detención excede lo típico de su motivo? El descanso nunca alerta.
 * Devuelve false para eventos abiertos de duración aún razonable.
 */
export const isStopEventOverdue = (
  reason: StopReason,
  minutes: number,
): boolean => {
  const threshold = STOP_REASON_ALERT_MINUTES[reason];
  return threshold !== null && minutes > threshold;
};

/** Duración en minutos; para eventos abiertos, contra `now`. */
export const stopEventMinutes = (
  event: Pick<ServiceStopEvent, 'started_at' | 'ended_at'>,
  now: Date,
): number => {
  const end = event.ended_at ? new Date(event.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.round((end - new Date(event.started_at).getTime()) / 60000));
};
