import { Capacitor, registerPlugin } from '@capacitor/core';
import { createLogger } from '@/lib/logger';

const logger = createLogger('OperatorRelaunch');

export interface RelaunchLaunchInfo {
  /** La vigilancia de cambios significativos está activa. */
  armed: boolean;
  /** Epoch ms del relanzamiento por ubicación, si este arranque lo fue. */
  launchedByLocationAt?: number;
  /** Epoch ms del último despertar entregado por el sistema. */
  lastWakeAt?: number;
}

interface OperatorRelaunchPlugin {
  arm(): Promise<{ armed: boolean }>;
  disarm(): Promise<{ armed: boolean }>;
  getLaunchInfo(): Promise<RelaunchLaunchInfo>;
  consumeLaunchReason(): Promise<void>;
}

const OperatorRelaunch = registerPlugin<OperatorRelaunchPlugin>('OperatorRelaunch');

const isSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/**
 * Enciende el despertador: iOS relanzará la app al detectar movimiento aunque
 * haya terminado el proceso.
 *
 * Se arma junto con la sesión de transmisión y se desarma SOLO cuando el
 * operador corta a mano. Mientras haya un traslado en curso, el relanzamiento
 * tiene que sobrevivir a todo —incluido que el sistema mate la app por memoria,
 * que es lo que se sospecha del 28/07—.
 *
 * Nunca lanza: es una red de seguridad, y una red que rompe el flujo normal
 * cuando falla es peor que no tenerla.
 */
export const armRelaunchOnMovement = async (): Promise<void> => {
  if (!isSupported()) return;
  try {
    const { armed } = await OperatorRelaunch.arm();
    logger.debug('Relanzamiento por movimiento armado', { armed });
  } catch (error) {
    logger.warn('No se pudo armar el relanzamiento por movimiento', error);
  }
};

export const disarmRelaunchOnMovement = async (): Promise<void> => {
  if (!isSupported()) return;
  try {
    await OperatorRelaunch.disarm();
    logger.debug('Relanzamiento por movimiento desarmado');
  } catch (error) {
    logger.warn('No se pudo desarmar el relanzamiento por movimiento', error);
  }
};

/**
 * Cómo empezó este proceso, según el sistema.
 *
 * Es la respuesta a la pregunta que el 28/07 no se pudo contestar: ¿la app
 * llegó a relanzarse? Se consume una sola vez para que el motivo no tiña los
 * arranques siguientes.
 */
export const readRelaunchLaunchInfo = async (): Promise<RelaunchLaunchInfo | null> => {
  if (!isSupported()) return null;
  try {
    const info = await OperatorRelaunch.getLaunchInfo();
    if (info.launchedByLocationAt) {
      void OperatorRelaunch.consumeLaunchReason().catch(() => {});
    }
    return info;
  } catch (error) {
    logger.warn('No se pudo leer el motivo del arranque', error);
    return null;
  }
};
