/**
 * Etapa del viaje que ve el cliente en /track.
 *
 * Módulo puro y sin dependencias a propósito: lo usa la edge function
 * service-tracking (Deno) y lo cubren los tests del repo (vitest). La regla que
 * vive aquí es la única que no puede depender de la sesión de GPS.
 */
export type JourneyStage = "assigned" | "en_route" | "on_site" | "towing" | "last_leg" | "arrived";

export const STAGE_RANK: Record<JourneyStage, number> = {
  assigned: 0,
  en_route: 1,
  on_site: 2,
  towing: 3,
  last_leg: 4,
  arrived: 5,
};

export const rankOfStage = (stage: string | null): number =>
  stage && stage in STAGE_RANK ? STAGE_RANK[stage as JourneyStage] : -1;

export const stageOfRank = (rank: number): JourneyStage | null =>
  (Object.keys(STAGE_RANK) as JourneyStage[]).find((stage) => STAGE_RANK[stage] === rank) ?? null;

/**
 * Piso de etapa derivado del ESTADO del servicio.
 *
 * El historial de geocercos vive en la sesión de seguimiento, no en el
 * servicio: un link creado a mitad de viaje nace sin ese historial y la etapa
 * arranca en "en_route" aunque el vehículo lleve horas cargado. El 26/07 pasó
 * exactamente eso —link nuevo a las 14:13 tras revocarse el anterior— y, con el
 * ETA ya apuntando por etapa, la página del cliente mostró "Tu grúa llega en
 * 20 min · 32 km": la distancia de VUELTA a Copiapó, con el vehículo camino a
 * Viña.
 *
 * `inspection_completed` es el estado posterior a la inspección de carga: el
 * vehículo está arriba de la grúa. Ese hecho es del SERVICIO y sobrevive a
 * cualquier link nuevo, así que fija el piso en "towing".
 *
 * `in_progress` solo garantiza que el servicio arrancó (el operador puede ir
 * todavía camino al origen): su piso es "en_route", que es justamente donde ya
 * parte el cálculo por geocerco.
 */
export const STAGE_FLOOR_BY_SERVICE_STATUS: Record<string, JourneyStage> = {
  in_progress: "en_route",
  inspection_completed: "towing",
};

export const serviceStatusAllowsJourneyProgress = (
  status: string | null | undefined,
): boolean => status === "in_progress" || status === "inspection_completed";

export const stageFloorForStatus = (status: string | null | undefined): JourneyStage | null =>
  (status && STAGE_FLOOR_BY_SERVICE_STATUS[status]) || null;

/**
 * Etapa efectiva = max(piso por estado, etapa por geocerco, máximo persistido).
 *
 * Las tres son verdades parciales y ninguna puede hacer retroceder a las otras:
 * el piso viene del servicio, el geocerco de la posición y el máximo de la
 * línea de tiempo ya publicada al cliente (Fix 4, monotonía).
 */
export const resolveEffectiveStage = (
  geofenceStage: JourneyStage,
  serviceStatus: string | null | undefined,
  persistedStage: string | null,
): JourneyStage => {
  const floor = stageFloorForStatus(serviceStatus);
  const highestRank = Math.max(
    STAGE_RANK[geofenceStage],
    floor ? STAGE_RANK[floor] : -1,
    rankOfStage(persistedStage),
  );
  return stageOfRank(highestRank) ?? geofenceStage;
};
