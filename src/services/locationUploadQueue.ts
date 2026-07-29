import { Preferences } from '@capacitor/preferences';
import { createLogger } from '@/lib/logger';
import { saveOperatorLocationPoint } from '@/services/operatorLocationService';
import { isPermanentUploadError } from '@/services/locationUploadErrors';
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
 * LÍMITE CONOCIDO: reescribe el JSON completo en cada operación. Con la cola
 * llena son unos cientos de KB por punto capturado. Es la deuda que justifica
 * migrar a SQLite o a un almacén por registros; hasta entonces, el techo y la
 * poda de abajo la mantienen dentro de lo tolerable.
 *
 * La clave se conserva de la implementación anterior a propósito: un teléfono
 * que actualiza la app con puntos pendientes los sigue viendo.
 */
const QUEUE_KEY = 'operator-location-points-queue-v1';

/**
 * Techo de la cola: ~11 horas a la cadencia de 20 s en movimiento.
 *
 * Eran 600 —unas 3,3 horas—, peligrosamente cerca de las 3 h del corte de ruta
 * que originó todo esto: una espera un poco más larga y la cola habría empezado
 * a botar el principio del traslado.
 */
const MAX_QUEUED_POINTS = 2000;

/**
 * Poda por ANTIGÜEDAD, no por intentos.
 *
 * Un punto de hace tres días ya no le sirve a nadie: ni al cliente, que vio ese
 * traslado terminar, ni a la métrica, que ya se calculó. Se descarta por viejo,
 * que es una razón honesta, y nunca por haber fracasado al subir.
 */
const MAX_QUEUED_AGE_MS = 72 * 60 * 60 * 1000;

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
 * Techo por subida individual.
 *
 * Una petición colgada —el modo de falla clásico de una red que "está" pero no
 * responde— dejaba el barrido tomado para siempre, y con él la recuperación al
 * volver a primer plano, que lo esperaba. Un timeout convierte ese cuelgue en un
 * fallo de red normal, que la cola ya sabe manejar.
 */
const UPLOAD_TIMEOUT_MS = 20000;

/**
 * Un punto que espera más que esto viaja marcado como `is_offline_sync`.
 *
 * El campo tiene valor forense: distingue "llegó tarde porque no había red" de
 * "llegó en vivo". Si al encolar TODO se marcara como offline, se perdería la
 * única señal que hoy permite decir, mirando la base al día siguiente, si lo
 * que murió fue la captura o la subida.
 */
const LATE_UPLOAD_THRESHOLD_MS = 45000;

/** Puntos que un barrido intenta antes de volver a ceder el control. */
const DRAIN_BATCH_SIZE = 50;

interface QueuedLocationPoint extends OperatorLocationPayload {
  localId: string;
  /**
   * Rechazos PERMANENTES del servidor sobre este punto (RLS, constraint…).
   *
   * Nunca cuenta fallas de red. Un punto que no sube porque no hay cobertura no
   * está roto, está esperando; contarlas acá borraba el primer punto de la cola
   * a los ~10 minutos sin señal, justo en el escenario para el que la cola
   * existe.
   */
  rejections: number;
  /** Momento en que se encoló: decide la poda por antigüedad y el marcado tardío. */
  enqueuedAt: number;
  /**
   * El punto sobrevivió a un barrido con la red caída.
   *
   * Va aparte del contador de rechazos a propósito: un punto que espera detrás
   * de otro en una cola de tres horas llegó igual de tarde aunque nunca se haya
   * intentado subir individualmente.
   */
  delayed?: boolean;
}

/** Un punto rechazado esto muchas veces por el SERVIDOR está roto de verdad. */
const MAX_REJECTIONS = 5;

export interface UploaderStats {
  /** Puntos esperando subida. */
  pending: number;
  /** Última subida CONFIRMADA por el servidor, en ISO. */
  lastSyncAt: string | null;
  /** Barridos consecutivos con error de red. Alimenta el diagnóstico del boot. */
  consecutiveFailures: number;
}

type StatsListener = (stats: UploaderStats) => void;

const withTimeout = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('La subida del punto excedió el tiempo de espera'));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

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

const writeQueue = async (points: QueuedLocationPoint[]): Promise<QueuedLocationPoint[]> => {
  const cutoff = Date.now() - MAX_QUEUED_AGE_MS;
  // Primero por edad y recién después por techo: si hay que botar algo, que sea
  // lo que ya no le sirve a nadie antes que lo que simplemente no cupo.
  const pruned = points
    .filter((point) => point.enqueuedAt >= cutoff)
    .slice(-MAX_QUEUED_POINTS);

  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(pruned) });
  return pruned;
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
  /**
   * Cerrojo de la cola.
   *
   * TODA lectura-modificación-escritura del JSON pasa por acá, encadenada. Sin
   * esto, `enqueue` y `drain` se pisaban: el barrido leía la cola, se iba a la
   * red durante segundos, y al volver escribía su versión —sin los puntos que
   * la captura había agregado mientras tanto—. Puntos capturados que
   * desaparecían sin dejar rastro, que es exactamente el fallo que este módulo
   * existe para impedir.
   */
  private lock: Promise<unknown> = Promise.resolve();

  /** Ejecuta `mutate` con acceso exclusivo a la cola persistida. */
  private withLock<T>(mutate: () => Promise<T>): Promise<T> {
    const run = this.lock.then(mutate, mutate);
    // La cadena nunca queda rechazada: un fallo en una mutación no puede dejar
    // el cerrojo envenenado para todas las siguientes.
    this.lock = run.then(() => undefined, () => undefined);
    return run;
  }

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
    this.pending = await this.withLock(async () => (await readQueue()).length);
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
    this.pending = await this.withLock(async () => {
      const queue = await readQueue();
      queue.push({
        ...payload,
        // Único aunque dos fixes compartan timestamp: el índice de la cola se
        // reutiliza tras un recorte y colisionaba.
        localId: `${payload.recordedAt}:${crypto.randomUUID().slice(0, 8)}`,
        rejections: 0,
        enqueuedAt: Date.now(),
      });
      return (await writeQueue(queue)).length;
    });
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
      // Instantánea bajo cerrojo; la red se toca FUERA de él. Mantener el
      // cerrojo durante la subida bloquearía la captura, que es lo único que no
      // se puede permitir.
      const batch = await this.withLock(async () => (await readQueue()).slice(0, DRAIN_BATCH_SIZE));

      if (batch.length === 0) {
        this.pending = await this.withLock(async () => (await readQueue()).length);
        this.consecutiveFailures = 0;
        this.emit();
        return;
      }

      const uploaded = new Set<string>();
      const rejected = new Set<string>();
      let networkDown = false;

      for (const item of batch) {
        // Con la red caída no se insiste punto por punto: el resto del lote se
        // conserva intacto y se reintenta entero en el próximo barrido.
        if (networkDown) break;

        const waitedMs = Date.now() - item.enqueuedAt;
        const isLate = item.delayed === true
          || item.rejections > 0
          || waitedMs > LATE_UPLOAD_THRESHOLD_MS;

        try {
          await withTimeout(
            (signal) => saveOperatorLocationPoint(
              { ...item, isOfflineSync: isLate },
              { signal },
            ),
            UPLOAD_TIMEOUT_MS,
          );
          uploaded.add(item.localId);
          this.lastSyncAt = new Date().toISOString();
          this.consecutiveFailures = 0;
        } catch (error) {
          if (isPermanentUploadError(error)) {
            // El servidor demostró que el CONTENIDO es inválido: constraint,
            // sesión inexistente o relación incoherente. Los demás códigos se
            // conservan porque pueden resolverse al renovar sesión o servidor.
            rejected.add(item.localId);
            logger.warn('El servidor rechazó el punto', {
              localId: item.localId,
              recordedAt: item.recordedAt,
              error,
            });
            continue;
          }

          networkDown = true;
          this.consecutiveFailures += 1;
          logger.warn('Subida de puntos fallida, se reintenta con backoff', {
            pending: this.pending,
            consecutiveFailures: this.consecutiveFailures,
            error,
          });
        }
      }

      // Reconciliación bajo cerrojo, POR IDENTIDAD y no por posición: se releen
      // los puntos actuales —que pueden incluir capturas nuevas— y se quitan
      // solo los que efectivamente subieron. Nunca se escribe un arreglo
      // calculado sobre una lectura vieja.
      this.pending = await this.withLock(async () => {
        const current = await readQueue();

        const next = current.flatMap((item) => {
          if (uploaded.has(item.localId)) return [];

          if (rejected.has(item.localId)) {
            const rejections = item.rejections + 1;
            if (rejections >= MAX_REJECTIONS) {
              logger.warn('Punto descartado tras rechazos repetidos del servidor', {
                localId: item.localId,
                recordedAt: item.recordedAt,
              });
              return [];
            }
            return [{ ...item, rejections, delayed: true }];
          }

          // Con la red caída, TODO lo que queda en la cola va a llegar tarde,
          // no solo el lote que se alcanzó a intentar. Marcar únicamente los
          // intentados dejaba sin `is_offline_sync` a los puntos que esperaron
          // el mismo apagón detrás de otro, y ese campo es la única señal
          // forense que distingue una subida caída de una captura muerta.
          if (networkDown) return [{ ...item, delayed: true }];

          return [item];
        });

        return (await writeQueue(next)).length;
      });

      this.emit();

      if (this.pending > 0) {
        if (networkDown) {
          this.scheduleRetry();
        } else {
          // Quedaron puntos y la red responde: sigue vaciando sin esperar el
          // backoff, que existe para los cortes, no para las colas largas.
          //
          // Va por setTimeout y no por llamada directa: estamos DENTRO de
          // runDrain, así que `this.draining` sigue puesto y un `drain()` acá
          // devolvería el barrido en curso —o sea, no haría nada—.
          setTimeout(() => { void this.drain(); }, 0);
        }
      }
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
