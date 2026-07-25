/**
 * Detenciones declaradas durante un traslado. Distinto de `service_stops`, que
 * son las paradas PLANIFICADAS de un recorrido multidestino.
 */
export type StopReason = 'combustible' | 'alimentacion' | 'descanso' | 'peaje' | 'otro';

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
  otro: 'Otro',
};

export const STOP_REASON_ORDER: StopReason[] = ['combustible', 'alimentacion', 'descanso', 'peaje', 'otro'];

/**
 * Umbrales de duración típica por motivo, definidos en terreno. Son señales de
 * posible anomalía para el admin, NO límites duros: nada se bloquea al pasarlos.
 *
 * Combustible: estanques de 200 L, llenado ~5 min → 15-20 min es lo normal.
 * Alimentación: similar.
 * Descanso: duración libre por diseño — `null` = nunca alertar.
 * Peaje: minutos.
 */
export const STOP_REASON_ALERT_MINUTES: Record<StopReason, number | null> = {
  combustible: 30,
  alimentacion: 30,
  descanso: null,
  peaje: 15,
  otro: 60,
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
