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
 * Nunca bloqueante: si el plugin falla —o no está en la plataforma actual— se
 * registra y se sigue. Quedarse sin transmitir por no poder mantener la
 * pantalla encendida sería un intercambio absurdo.
 */
export const keepAwakeSafely = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await KeepAwake.keepAwake();
    logger.debug('Pantalla mantenida encendida durante la transmisión');
  } catch (error) {
    logger.warn('No se pudo mantener la pantalla encendida', error);
  }
};

export const allowSleepSafely = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await KeepAwake.allowSleep();
    logger.debug('Pantalla liberada: la transmisión se detuvo');
  } catch (error) {
    logger.warn('No se pudo liberar la pantalla', error);
  }
};
