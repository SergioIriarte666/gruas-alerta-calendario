import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperatorLocationPayload } from '@/types/operatorLocation';

/** Almacenamiento nativo simulado: un Map, que es lo que Preferences es. */
const store = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      store.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      store.delete(key);
    }),
  },
}));

const saveOperatorLocationPoint = vi.fn();

class FakeUploadError extends Error {
  constructor(message: string, readonly permanent: boolean) {
    super(message);
  }
}

vi.mock('@/services/operatorLocationService', () => ({
  saveOperatorLocationPoint: (payload: OperatorLocationPayload) =>
    saveOperatorLocationPoint(payload),
  isPermanentUploadError: (error: unknown) =>
    error instanceof FakeUploadError && error.permanent,
}));

const point = (recordedAt: string): OperatorLocationPayload => ({
  sessionId: 'ses-1',
  operatorId: 'op-1',
  userId: 'user-1',
  serviceId: 'srv-1',
  latitude: -30.6,
  longitude: -71.2,
  accuracyMeters: 5,
  speedMps: 12,
  headingDegrees: 180,
  altitudeMeters: 100,
  recordedAt,
  source: 'mobile_app',
});

const QUEUE_KEY = 'operator-location-points-queue-v1';

const queued = (): unknown[] => JSON.parse(store.get(QUEUE_KEY) ?? '[]');

describe('locationUploadQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.clear();
    saveOperatorLocationPoint.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const loadQueue = async () => {
    const module = await import('@/services/locationUploadQueue');
    return module.locationUploadQueue;
  };

  it('sube el punto y lo saca de la cola', async () => {
    saveOperatorLocationPoint.mockResolvedValue(undefined);
    const uploader = await loadQueue();

    await uploader.enqueue(point('2026-07-29T14:00:00.000Z'));
    // `drain()` devuelve el barrido EN VUELO, así que esperarlo es determinista.
    // Con vi.waitFor y temporizadores falsos el test dependía de ganarle una
    // carrera al drain que enqueue dispara sin await, y bajo carga la perdía.
    await uploader.drain();

    expect(saveOperatorLocationPoint).toHaveBeenCalledTimes(1);
    expect(queued()).toHaveLength(0);
    expect(uploader.stats().pending).toBe(0);
  });

  // El corazón del Fix 8: el 28/07 una red muerta se llevó la captura por
  // delante. Encolar no puede lanzar NUNCA, pase lo que pase con la subida.
  it('una falla de red no lanza y conserva el punto en la cola', async () => {
    saveOperatorLocationPoint.mockRejectedValue(new Error('Network request failed'));
    const uploader = await loadQueue();

    await expect(uploader.enqueue(point('2026-07-29T14:00:00.000Z'))).resolves.toBeUndefined();
    await uploader.drain();

    expect(saveOperatorLocationPoint).toHaveBeenCalled();
    expect(queued()).toHaveLength(1);
    expect(uploader.stats().pending).toBe(1);
  });

  it('con la red caída no insiste punto por punto ni pierde nada', async () => {
    saveOperatorLocationPoint.mockRejectedValue(new Error('offline'));
    const uploader = await loadQueue();

    await uploader.enqueue(point('2026-07-29T14:00:00.000Z'));
    await uploader.enqueue(point('2026-07-29T14:00:20.000Z'));
    await uploader.enqueue(point('2026-07-29T14:00:40.000Z'));
    await uploader.drain();

    // Nada se pierde…
    expect(queued()).toHaveLength(3);
    // …y el primer fallo corta el barrido: nunca una petición muerta por punto,
    // que era lo que quemaba batería y red durante el corte del 28/07.
    expect(saveOperatorLocationPoint.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('al volver la red sube el lote y lo marca como sincronización tardía', async () => {
    saveOperatorLocationPoint.mockRejectedValue(new Error('offline'));
    const uploader = await loadQueue();

    await uploader.enqueue(point('2026-07-29T14:00:00.000Z'));
    await uploader.enqueue(point('2026-07-29T14:00:20.000Z'));
    await uploader.drain();
    expect(queued()).toHaveLength(2);

    saveOperatorLocationPoint.mockReset();
    saveOperatorLocationPoint.mockResolvedValue(undefined);
    await uploader.drain();

    expect(saveOperatorLocationPoint).toHaveBeenCalledTimes(2);
    // is_offline_sync es el dato forense que el 28/07 no existió: distingue
    // "llegó tarde porque no había red" de "llegó en vivo". Los DOS puntos
    // esperaron el apagón, aunque solo el primero se llegara a intentar.
    for (const call of saveOperatorLocationPoint.mock.calls) {
      expect(call[0].isOfflineSync).toBe(true);
    }
    expect(queued()).toHaveLength(0);
    expect(uploader.stats().lastSyncAt).not.toBeNull();
  });

  it('un punto que sube al primer intento no se marca como tardío', async () => {
    saveOperatorLocationPoint.mockResolvedValue(undefined);
    const uploader = await loadQueue();

    await uploader.enqueue(point('2026-07-29T14:00:00.000Z'));
    await uploader.drain();

    expect(saveOperatorLocationPoint.mock.calls[0][0].isOfflineSync).toBe(false);
  });

  it('una cola corrupta no tumba la captura', async () => {
    store.set(QUEUE_KEY, '{esto no es json');
    saveOperatorLocationPoint.mockResolvedValue(undefined);
    const uploader = await loadQueue();

    await expect(uploader.enqueue(point('2026-07-29T14:00:00.000Z'))).resolves.toBeUndefined();
    await uploader.drain();

    expect(saveOperatorLocationPoint).toHaveBeenCalledTimes(1);
  });
  // Hallazgo de la revisión: enqueue() y drain() hacían lectura-modificación-
  // escritura del mismo JSON en paralelo. Con una subida lenta, el barrido
  // volvía y escribía su versión —sin los puntos capturados mientras tanto—.
  it('un punto capturado durante una subida lenta NO se pierde', async () => {
    let releaseUpload: (() => void) | undefined;
    saveOperatorLocationPoint.mockImplementationOnce(
      () => new Promise<void>((resolve) => { releaseUpload = resolve; }),
    );
    saveOperatorLocationPoint.mockResolvedValue(undefined);
    const uploader = await loadQueue();

    await uploader.enqueue(point('2026-07-29T14:00:00.000Z'));
    const inFlight = uploader.drain();

    // La captura sigue trabajando mientras la red está ocupada.
    await uploader.enqueue(point('2026-07-29T14:00:20.000Z'));

    releaseUpload?.();
    await inFlight;

    // El segundo punto sobrevivió al barrido y termina subiendo.
    await uploader.drain();
    const subidos = saveOperatorLocationPoint.mock.calls.map((c) => c[0].recordedAt);
    expect(subidos).toContain('2026-07-29T14:00:20.000Z');
    expect(queued()).toHaveLength(0);
  });

  // Un punto que no sube por falta de cobertura NO está roto: está esperando.
  // Antes se descartaba tras 10 barridos fallidos, o sea a los ~10 minutos sin
  // señal, justo en el escenario para el que la cola existe.
  it('una red caída prolongada no descarta el punto', async () => {
    saveOperatorLocationPoint.mockRejectedValue(new FakeUploadError('offline', false));
    const uploader = await loadQueue();

    await uploader.enqueue(point('2026-07-29T14:00:00.000Z'));
    for (let i = 0; i < 25; i += 1) await uploader.drain();

    expect(queued()).toHaveLength(1);
    expect(uploader.stats().pending).toBe(1);
  });

  // En cambio, un rechazo del SERVIDOR sí es terminal: reintentarlo mil veces
  // no lo arregla y taparía la cola.
  it('un rechazo permanente del servidor termina descartando el punto', async () => {
    saveOperatorLocationPoint.mockRejectedValue(new FakeUploadError('violates RLS', true));
    const uploader = await loadQueue();

    await uploader.enqueue(point('2026-07-29T14:00:00.000Z'));
    for (let i = 0; i < 6; i += 1) await uploader.drain();

    expect(queued()).toHaveLength(0);
  });

  // Un rechazo permanente no puede llevarse por delante a los puntos sanos que
  // vienen detrás.
  it('un punto rechazado no bloquea a los que le siguen', async () => {
    // El rechazo se decide por el CONTENIDO del punto, no por el orden de
    // llamada: los barridos automáticos que dispara enqueue() hacen que
    // `mockRejectedValueOnce` caiga en una subida impredecible.
    const roto = '2026-07-29T14:00:00.000Z';
    saveOperatorLocationPoint.mockImplementation(async (payload: OperatorLocationPayload) => {
      if (payload.recordedAt === roto) throw new FakeUploadError('violates RLS', true);
    });
    const uploader = await loadQueue();

    await uploader.enqueue(point(roto));
    await uploader.enqueue(point('2026-07-29T14:00:20.000Z'));
    for (let i = 0; i < 6; i += 1) await uploader.drain();

    const subidos = saveOperatorLocationPoint.mock.calls.map((c) => c[0].recordedAt);
    expect(subidos).toContain('2026-07-29T14:00:20.000Z');
    // El sano se fue y el roto terminó descartado: la cola no queda tapada.
    expect(queued()).toHaveLength(0);
  });
});
