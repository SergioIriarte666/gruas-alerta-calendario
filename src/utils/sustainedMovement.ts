import { AUTO_RESUME_SPEED_KMH, AUTO_RESUME_SUSTAIN_SECONDS } from '@/types/serviceStopEvent';

/**
 * Detector de "está rodando", compartido por la reanudación automática de una
 * detención (3.4) y el auto-encendido de transmisión por movimiento (3.6).
 *
 * El umbral es deliberadamente bajo (10 km/h): en faenas y caminos por
 * comunidades hay restricciones de hasta 15 km/h, y en un atasco se avanza
 * lento — rodar a 12-15 km/h ES rodar. Exigir velocidad de carretera dejaría al
 * cliente viendo "en descanso" mientras la grúa avanza.
 *
 * Requiere velocidad SOSTENIDA: un solo fix rápido (o un salto de GPS) no
 * alcanza. Cualquier muestra bajo el umbral reinicia el contador.
 */
export interface MovementSample {
  /** m/s del fix GPS. null cuando el dispositivo no la reporta. */
  speedMps: number | null;
  latitude: number;
  longitude: number;
  /** Instante del fix, en ms. */
  atMs: number;
}

const EARTH_RADIUS_METERS = 6371000;

const metersBetween = (a: MovementSample, b: MovementSample): number => {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

export class SustainedMovementTracker {
  private movingSinceMs: number | null = null;
  private previous: MovementSample | null = null;
  private triggered = false;

  constructor(
    private readonly speedKmh: number = AUTO_RESUME_SPEED_KMH,
    private readonly sustainSeconds: number = AUTO_RESUME_SUSTAIN_SECONDS,
  ) {}

  reset(): void {
    this.movingSinceMs = null;
    this.previous = null;
    this.triggered = false;
  }

  /** Segundos que lleva rodando de forma continua; 0 si está detenido. */
  sustainedSeconds(nowMs: number): number {
    if (this.movingSinceMs === null) return 0;
    return Math.max(0, (nowMs - this.movingSinceMs) / 1000);
  }

  /**
   * Alimenta una muestra. Devuelve true cuando se cumple la condición de
   * movimiento sostenido — y solo la primera vez, hasta que haya un `reset()`
   * o el operador se detenga: quien llama actúa una vez, no en cada fix.
   */
  push(sample: MovementSample): boolean {
    const kmh = this.resolveKmh(sample);
    this.previous = sample;

    if (kmh < this.speedKmh) {
      // Detenerse rearma el detector: el próximo tramo puede volver a disparar.
      this.movingSinceMs = null;
      this.triggered = false;
      return false;
    }

    if (this.movingSinceMs === null) {
      this.movingSinceMs = sample.atMs;
      return false;
    }

    if (this.triggered) return false;

    if ((sample.atMs - this.movingSinceMs) / 1000 >= this.sustainSeconds) {
      this.triggered = true;
      return true;
    }

    return false;
  }

  /**
   * km/h del fix. Si el dispositivo no reporta velocidad (pasa en iOS con
   * fixes de baja precisión), se deriva de la distancia recorrida entre fixes.
   */
  private resolveKmh(sample: MovementSample): number {
    if (typeof sample.speedMps === 'number' && sample.speedMps >= 0) {
      return sample.speedMps * 3.6;
    }

    const previous = this.previous;
    if (!previous) return 0;

    const elapsedSeconds = (sample.atMs - previous.atMs) / 1000;
    if (elapsedSeconds <= 0) return 0;

    return (metersBetween(previous, sample) / elapsedSeconds) * 3.6;
  }
}
