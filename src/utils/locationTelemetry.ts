const DEFAULT_HIGH_SPEED_THRESHOLD_KMH = 80;

/**
 * Los puntos normales se persisten con una cadencia conservadora para cuidar
 * batería y datos. Un nuevo máximo sobre el umbral operativo es una excepción:
 * si la UI lo recibió, debe quedar guardado aunque todavía no venza la cadencia.
 */
export const isNewHighSpeedPeak = (
  speedMps: number | null,
  highestPersistedSpeedMps: number | null,
  thresholdKmh = DEFAULT_HIGH_SPEED_THRESHOLD_KMH,
): boolean => {
  if (typeof speedMps !== 'number' || !Number.isFinite(speedMps) || speedMps < 0) {
    return false;
  }

  if (speedMps * 3.6 <= thresholdKmh) {
    return false;
  }

  return highestPersistedSpeedMps === null || speedMps > highestPersistedSpeedMps;
};
