import { Capacitor, registerPlugin } from '@capacitor/core';
import { createLogger } from '@/lib/logger';

const logger = createLogger('OperatorRelaunch');

export type LocationAuthorization =
  | 'always' | 'whenInUse' | 'denied' | 'restricted' | 'notDetermined' | 'unknown';

export type BackgroundRefreshStatus = 'available' | 'denied' | 'restricted' | 'unknown';

export interface RelaunchLaunchInfo {
  /** La vigilancia está realmente corriendo. */
  armed: boolean;
  /** Se pidió la vigilancia y la decisión sobrevivirá al proceso. */
  requested?: boolean;
  /** Alias explícito del estado operativo para diagnósticos detallados. */
  monitoring?: boolean;
  /** Permiso de ubicación. Solo `always` permite que iOS relance. */
  authorizationStatus?: LocationAuthorization;
  /** Sin `available`, iOS no relanza por ubicación por más permiso que haya. */
  backgroundRefreshStatus?: BackgroundRefreshStatus;
  /** El dispositivo soporta cambios significativos de ubicación. */
  available?: boolean;
  /** Epoch ms del relanzamiento por ubicación, si este arranque lo fue. */
  launchedByLocationAt?: number;
  /** Epoch ms del último despertar entregado por el sistema. */
  lastWakeAt?: number;
}

/**
 * Los tres requisitos del relanzamiento, evaluados juntos.
 *
 * Son independientes y se arreglan en lugares distintos de los Ajustes, así que
 * un booleano suelto no sirve: hay que poder decirle al operador CUÁL le falta.
 * Y "protegido" solo se afirma cuando la vigilancia está corriendo de verdad,
 * no cuando se pidió.
 */
export const isRelaunchProtected = (info: RelaunchLaunchInfo | null): boolean =>
  Boolean(
    info?.monitoring
    && info.authorizationStatus === 'always'
    && info.backgroundRefreshStatus === 'available',
  );

interface OperatorRelaunchPlugin {
  arm(): Promise<RelaunchLaunchInfo>;
  disarm(): Promise<RelaunchLaunchInfo>;
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
export const armRelaunchOnMovement = async (): Promise<RelaunchLaunchInfo | null> => {
  if (!isSupported()) return null;
  try {
    const info = await OperatorRelaunch.arm();
    // Se loguea el estado COMPLETO: si el relanzamiento no va a funcionar, el
    // motivo tiene que estar escrito en alguna parte antes de que haga falta.
    logger.debug('Relanzamiento por movimiento armado', info);
    return info;
  } catch (error) {
    logger.warn('No se pudo armar el relanzamiento por movimiento', error);
    return null;
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
  const info = await readRelaunchStatus();
  if (info?.launchedByLocationAt) {
    void OperatorRelaunch.consumeLaunchReason().catch(() => {});
  }
  return info;
};

/**
 * Igual que la anterior pero SIN consumir el motivo del arranque.
 *
 * La distinción importa: el motivo se consume una sola vez y le pertenece a
 * `app_boot_log`. Si la UI lo leyera consumiéndolo, ganaría la carrera y la
 * autopsia registraría "cold_start" en el arranque que precisamente sí fue un
 * relanzamiento.
 */
export const readRelaunchStatus = async (): Promise<RelaunchLaunchInfo | null> => {
  if (!isSupported()) return null;
  try {
    return await OperatorRelaunch.getLaunchInfo();
  } catch (error) {
    logger.warn('No se pudo leer el estado del relanzamiento', error);
    return null;
  }
};
