import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Tracking');

/**
 * Mantiene la pantalla encendida mientras el operador transmite.
 *
 * Fix operativo, no estructural: con la pantalla bloqueada iOS congela el
 * WebView y el hilo JS deja de procesar los fixes del plugin. Es el parche que
 * sostiene la transmisión mientras el arreglo de fondo (latido nativo, ver
 * useOperatorLocationTracking) no esté desplegado en el teléfono.
 *
 * Dos caminos:
 *  - Nativo (Capacitor): plugin keep-awake.
 *  - Web (el operador hoy usa Safari, la app nativa aún no está instalada):
 *    Screen Wake Lock API.
 *
 * Nunca bloqueante: si el sistema lo niega —Modo de Bajo Consumo activo es la
 * causa típica en iOS— se informa y se sigue transmitiendo. Quedarse sin
 * transmitir por no poder mantener la pantalla encendida sería un intercambio
 * absurdo.
 */
export type KeepAwakeOutcome = 'idle' | 'granted' | 'denied' | 'unsupported';

/** Mensaje accionable en español. El texto del navegador ("The request is not
 * allowed by the user agent...") no le dice al operador qué hacer. */
export const KEEP_AWAKE_DENIED_MESSAGE =
  'iOS impidió mantener la pantalla activa. Desactiva Modo de Bajo Consumo o fija Bloqueo automático en Nunca; la transmisión sigue funcionando.';

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

// Estado a nivel de MÓDULO, igual que el watcher de ubicación: un wake lock por
// pestaña. Un ref por componente perdería el sentinel en cada remount y nadie
// podría volver a liberarlo.
let wanted = false;
let sentinel: WakeLockSentinelLike | null = null;
let listenersBound = false;
let lastOutcome: KeepAwakeOutcome = 'idle';

const subscribers = new Set<(outcome: KeepAwakeOutcome) => void>();

const publish = (outcome: KeepAwakeOutcome) => {
  lastOutcome = outcome;
  subscribers.forEach((listener) => listener(outcome));
};

/** Estado del último intento, para que la UI pueda explicarlo sin adivinar. */
export const getKeepAwakeOutcome = (): KeepAwakeOutcome => lastOutcome;

export const subscribeKeepAwake = (listener: (outcome: KeepAwakeOutcome) => void): (() => void) => {
  subscribers.add(listener);
  listener(lastOutcome);
  return () => { subscribers.delete(listener); };
};

/**
 * Safari libera el wake lock al cambiar de pestaña, al salir de pantalla
 * completa y al volver de segundo plano. Sin re-pedirlo, la primera vez que el
 * operador mira WhatsApp la pantalla vuelve a apagarse sola y la transmisión se
 * congela con ella.
 */
const bindReacquireListeners = () => {
  if (listenersBound || typeof document === 'undefined') return;
  listenersBound = true;

  const reacquire = () => {
    if (!wanted || document.visibilityState !== 'visible') return;
    void requestWebWakeLock();
  };

  document.addEventListener('visibilitychange', reacquire);
  document.addEventListener('fullscreenchange', reacquire);
};

const requestWebWakeLock = async (): Promise<KeepAwakeOutcome> => {
  const wakeLock = (navigator as WakeLockNavigator).wakeLock;
  if (!wakeLock) {
    publish('unsupported');
    return 'unsupported';
  }

  if (sentinel && sentinel.released === false) return 'granted';

  try {
    // Primera instrucción del camino web y sin await previo a propósito: la
    // activación transitoria del gesto que enciende la transmisión tiene que
    // seguir viva cuando esto se ejecuta (el rechazo del 26/07 a las 14:13 fue
    // exactamente eso: petición fuera del gesto).
    const granted = await wakeLock.request('screen');
    sentinel = granted;
    granted.addEventListener?.('release', () => {
      if (sentinel === granted) sentinel = null;
    });
    logger.debug('Pantalla mantenida encendida durante la transmisión (web)');
    publish('granted');
    return 'granted';
  } catch (error) {
    // NotAllowedError: Bajo Consumo activo o petición fuera de gesto.
    logger.warn('El sistema negó mantener la pantalla encendida', error);
    publish('denied');
    return 'denied';
  }
};

/**
 * Pide mantener la pantalla encendida. DEBE llamarse dentro del gesto que
 * enciende la transmisión, no desde un efecto posterior.
 */
export const keepAwakeSafely = async (): Promise<KeepAwakeOutcome> => {
  wanted = true;
  bindReacquireListeners();

  if (!Capacitor.isNativePlatform()) {
    return requestWebWakeLock();
  }

  try {
    await KeepAwake.keepAwake();
    logger.debug('Pantalla mantenida encendida durante la transmisión');
    publish('granted');
    return 'granted';
  } catch (error) {
    logger.warn('No se pudo mantener la pantalla encendida', error);
    publish('denied');
    return 'denied';
  }
};

export const allowSleepSafely = async (): Promise<void> => {
  wanted = false;

  if (!Capacitor.isNativePlatform()) {
    const current = sentinel;
    sentinel = null;
    // Con la transmisión apagada el aviso de "iOS no dejó" ya no aplica: se
    // borra en vez de quedar colgado en la pantalla.
    publish('idle');
    if (!current) return;
    try {
      await current.release();
      logger.debug('Pantalla liberada: la transmisión se detuvo (web)');
    } catch (error) {
      logger.warn('No se pudo liberar la pantalla', error);
    }
    return;
  }

  try {
    await KeepAwake.allowSleep();
    logger.debug('Pantalla liberada: la transmisión se detuvo');
    publish('idle');
  } catch (error) {
    logger.warn('No se pudo liberar la pantalla', error);
  }
};
