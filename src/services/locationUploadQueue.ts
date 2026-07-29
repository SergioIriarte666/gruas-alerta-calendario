import { Preferences } from '@capacitor/preferences';
import { createLogger } from '@/lib/logger';
import { saveOperatorLocationPoint } from '@/services/operatorLocationService';
import type { OperatorLocationPayload } from '@/types/operatorLocation';

const logger = createLogger('LocationUploader');

/**
 * Cola persistente de puntos, en almacenamiento NATIVO.
 *
 * `@capacitor/preferences` escribe en UserDefaults (iOS) / SharedPreferences
 * (Android): sobrevive a que el sistema mate el proceso, que es exactamente el
 * escenario que hay que cubrir. Una cola en memoria JS se evapora con la app y
 * deja el mismo agujero que se quiere cerrar.
 *
 * La clave se conserva de la implementación anterior a propósito: un teléfono
 * que actualiza la app con puntos pendientes los sigue viendo.
 */
const QUEUE_KEY = 'operator-location-points-queue-v1';

/**
 * Techo de la cola. Con la cadencia de 20 s en movimiento son ~3 horas de
 * traslado; con latidos de 2 min, más de medio día detenido. Al desbordar se
 * descartan los MÁS VIEJOS: en un recorrido, el tramo reciente vale más que el
 * que ya nadie va a mirar.
 */
const MAX_QUEUED_POINTS = 600;

/** Un punto que fracasa esto muchas veces está roto, no incomunicado. */
const MAX_ATTEMPTS = 10;

/**
 * Backoff exponencial entre barridos fallidos: 2 s, 4 s, 8 s… hasta 2 minutos.
 *
 * Sin esto, cada punto capturado disparaba un reintento de TODA la cola contra
 * una red caída. En el corte del 28/07 eso significaba cientos de peticiones
 * muertas por minuto, quemando batería y tapando el log del error real.
 */
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 2 * 60 * 1000;

/**
 * Un punto que espera más que esto viaja marcado como `is_offline_sync`.
 *
 * El campo tiene valor forense: distingue "llegó tarde porque no había red" de
 * "llegó en vivo". Si al encolar TODO se marcara como offline, se perdería la
 * única señal que hoy permite decir, mirando la base al día siguiente, si lo
 * que murió fue la captura o la subida.
 */
const LATE_UPLOAD_THRESHOLD_MS = 45000;

interface QueuedLocationPoint extends OperatorLocationPayload {
  localId: string;
  /** Intentos de subida FALLIDOS sobre este punto. Solo decide el descarte. */
  attempts: number;
  /** Momento en que se encoló, para decidir si el punto llegó tarde. */
  enqueuedAt: number;
  /**
   * El punto sobrevivió a un barrido con la red caída.
   *
   * Va aparte de `attempts` a propósito: un punto que espera detrás de otro en
   * una cola de tres horas llegó igual de tarde aunque nunca se haya intentado
   * subir individualmente. Y `attempts` no puede crecer con la espera, porque
   * es el contador que descarta puntos y un apagón largo los borraría todos.
   */
  delayed?: boolean;
}

export interface UploaderStats {
  /** Puntos esperando subida. */
  pending: number;
  /** Última subida CONFIRMADA por el servidor, en ISO. */
  lastSyncAt: string | null;
  /** Barridos consecutivos con error de red. Alimenta el diagnóstico del boot. */
  consecutiveFailures: number;
}

type StatsListener = (stats: UploaderStats) => void;

const readQueue = async (): Promise<QueuedLocationPoint[]> => {
  try {
    const { value } = await Preferences.get({ key: QUEUE_KEY });
    if (!value) return [];
    const parsed = JSON.parse(value) as QueuedLocationPoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // Una cola corrupta no puede tumbar la captura: se descarta y se sigue.
    logger.warn('Cola de puntos ilegible, se descarta', error);
    return [];
  }
};

const writeQueue = async (points: QueuedLocationPoint[]): Promise<void> => {
  await Preferences.set({
    key: QUEUE_KEY,
    value: JSON.stringify(points.slice(-MAX_QUEUED_POINTS)),
  });
};

/**
 * Uploader independiente de la captura.
 *
 * REGLA CENTRAL, y la razón de que este módulo exista: **una falla de red jamás
 * debe matar la captura**. El watcher entrega el punto, este módulo lo pone en
 * la cola persistente y devuelve el control de inmediato. La subida ocurre en
 * un barrido propio, con reintento y backoff. Un error HTTP aquí se loguea y se
 * reintenta; nunca sube por la pila hasta el watcher.
 *
 * Singleton de módulo, igual que el watcher: dos barridos concurrentes se
 * pelearían la misma cola y subirían los mismos puntos dos veces.
 */
class LocationUploadQueue {
  private draining: Promise<void> | null = null;
  private consecutiveFailures = 0;
  private lastSyncAt: string | null = null;
  private pending = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<StatsListener>();

  subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    listener(this.stats());
    return () => { this.listeners.delete(listener); };
  }

  stats(): UploaderStats {
    return {
      pending: this.pending,
      lastSyncAt: this.lastSyncAt,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private emit(): void {
    const snapshot = this.stats();
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Recalcula el pendiente desde disco. Se llama al arrancar la app. */
  async refresh(): Promise<void> {
    this.pending = (await readQueue()).length;
    this.emit();
  }

  /**
   * Entrega un punto al uploader. NO espera a la red: encola y agenda.
   *
   * Devuelve una promesa que resuelve al terminar de ESCRIBIR en la cola —una
   * operación local de milisegundos—, no al subir. El llamador nunca queda
   * bloqueado por la conectividad.
   */
  async enqueue(payload: OperatorLocationPayload): Promise<void> {
    const queue = await readQueue();
    queue.push({
      ...payload,
      // Único aunque dos fixes compartan timestamp: el índice de la cola se
      // reutiliza tras un recorte y colisionaba.
      localId: `${payload.recordedAt}:${crypto.randomUUID().slice(0, 8)}`,
      attempts: 0,
      enqueuedAt: Date.now(),
    });
    await writeQueue(queue);
    this.pending = Math.min(queue.length, MAX_QUEUED_POINTS);
    this.emit();

    void this.drain();
  }

  /**
   * Vacía la cola en orden. Idempotente y a prueba de reentradas.
   *
   * Nunca lanza: quien la invoca —el watcher, el evento `online`, el regreso a
   * primer plano— no tiene nada que hacer con el error y no debe morir por él.
   */
  async drain(): Promise<void> {
    // Con un barrido en vuelo, el llamador espera ESE barrido en vez de irse
    // creyendo que ya se intentó. `flushQueue()` significa "la cola se intentó",
    // y devolver antes de tiempo convertía esa promesa en una mentira.
    if (this.draining) return this.draining;

    this.draining = this.runDrain().finally(() => { this.draining = null; });
    return this.draining;
  }

  private async runDrain(): Promise<void> {
    try {
      const queue = await readQueue();
      if (queue.length === 0) {
        this.pending = 0;
        this.consecutiveFailures = 0;
        this.emit();
        return;
      }

      const remaining: QueuedLocationPoint[] = [];
      let networkDown = false;

      for (const item of queue) {
        // Con la red caída no se insiste punto por punto: el resto de la cola
        // se conserva intacto y se reintenta entera en el próximo barrido.
        if (networkDown) {
          remaining.push({ ...item, delayed: true });
          continue;
        }

        const waitedMs = Date.now() - item.enqueuedAt;
        const isLate = item.delayed === true
          || item.attempts > 0
          || waitedMs > LATE_UPLOAD_THRESHOLD_MS;

        try {
          await saveOperatorLocationPoint({ ...item, isOfflineSync: isLate });
          this.lastSyncAt = new Date().toISOString();
          this.consecutiveFailures = 0;
        } catch (error) {
          const attempts = item.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            logger.warn('Punto descartado tras agotar reintentos', {
              localId: item.localId,
              recordedAt: item.recordedAt,
              error,
            });
            continue;
          }
          remaining.push({ ...item, attempts, delayed: true });
          networkDown = true;
          this.consecutiveFailures += 1;
          logger.warn('Subida de puntos fallida, se reintenta con backoff', {
            pending: queue.length,
            consecutiveFailures: this.consecutiveFailures,
            error,
          });
        }
      }

      await writeQueue(remaining);
      this.pending = remaining.length;
      this.emit();

      if (remaining.length > 0) this.scheduleRetry();
    } catch (error) {
      // Fallo del propio almacenamiento local. Se traga: la captura sigue.
      logger.warn('El barrido de la cola falló entero', error);
    }
  }

  /** Reintento con backoff exponencial acotado. Un solo temporizador vivo. */
  private scheduleRetry(): void {
    if (this.retryTimer !== null) return;

    const delay = Math.min(
      MAX_BACKOFF_MS,
      BASE_BACKOFF_MS * 2 ** Math.min(this.consecutiveFailures, 6),
    );

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.drain();
    }, delay);
  }
}

export const locationUploadQueue = new LocationUploadQueue();
