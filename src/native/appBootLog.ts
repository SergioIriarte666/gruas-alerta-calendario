import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { locationUploadQueue } from '@/services/locationUploadQueue';
import { takeLastFatalError } from '@/native/fatalErrorStore';
import { readRelaunchLaunchInfo } from '@/native/operatorRelaunch';

const logger = createLogger('AppBootLog');

export type LaunchReason = 'cold_start' | 'background' | 'url_open' | 'significant_location';

/**
 * Cómo empezó ESTE proceso, capturado al importar el módulo.
 *
 * Se lee antes de que nada pueda cambiar la visibilidad de la página. Con la
 * app arrancando oculta, el sistema la despertó en segundo plano; visible, la
 * abrió una persona. La distinción es la que va a decir, en el próximo
 * episodio, si el relanzamiento automático llegó a ocurrir.
 */
const initialLaunchReason: LaunchReason =
  typeof document !== 'undefined' && document.visibilityState === 'hidden'
    ? 'background'
    : 'cold_start';

let bootRecorded = false;

const readLastFatalError = async (): Promise<string | null> => {
  try {
    return await takeLastFatalError();
  } catch (error) {
    logger.warn('No se pudo leer el error del arranque anterior', error);
    return null;
  }
};

const resolveAppVersion = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const info = await CapacitorApp.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    // getInfo no está implementado en todas las plataformas; no vale un fallo.
    return null;
  }
};

/**
 * Registra el arranque. Una vez por proceso, aunque el portal se remonte.
 *
 * Se traga cualquier error: es un registro de diagnóstico y no puede ser la
 * razón por la que un operador no logra abrir la app.
 */
export const recordAppBoot = async (
  operatorId: string | null | undefined,
  userId: string | null | undefined,
): Promise<void> => {
  if (bootRecorded || !userId) return;
  bootRecorded = true;

  try {
    const [lastError, appVersion, relaunch] = await Promise.all([
      readLastFatalError(),
      resolveAppVersion(),
      readRelaunchLaunchInfo(),
    ]);

    // El sistema manda sobre la heurística: `significant_location` significa que
    // iOS revivió un proceso muerto, que es exactamente el hecho que el 28/07
    // no se pudo comprobar. La visibilidad del documento solo distingue
    // "alguien la abrió" de "despertó sola" cuando el sistema no dice nada.
    const launchReason: LaunchReason = relaunch?.launchedByLocationAt
      ? 'significant_location'
      : initialLaunchReason;

    const { error } = await supabase.from('app_boot_log').insert({
      operator_id: operatorId ?? null,
      user_id: userId,
      launch_reason: launchReason,
      app_version: appVersion,
      platform: Capacitor.getPlatform(),
      last_error: lastError,
      // Cola heredada del arranque anterior: con puntos pendientes murió la
      // SUBIDA; con la cola vacía y un hueco en el recorrido, murió la CAPTURA.
      pending_points: locationUploadQueue.stats().pending,
      // NULL a propósito cuando no hay plugin: distingue "no está armado" de
      // "este binario ni siquiera puede armarlo". Averiguar eso costó una tarde
      // de leer el log de Xcode buscando una llamada que no aparecía.
      // `monitoring` existe también en el plugin anterior, cuyo `armed` en
      // getLaunchInfo significaba sólo "solicitado". Leer el campo operativo
      // mantiene correcto el diagnóstico incluso durante una actualización
      // gradual del bundle web sobre binarios nativos antiguos.
      relaunch_armed: relaunch ? (relaunch.monitoring ?? false) : null,
    } as never);

    if (error) throw new Error(error.message);

    logger.debug('Arranque registrado', {
      launchReason,
      relaunchArmed: relaunch ? (relaunch.monitoring ?? false) : null,
      hadError: Boolean(lastError),
    });
  } catch (error) {
    // Reintentar en el próximo arranque; no se desmarca `bootRecorded` para no
    // insistir en bucle contra una base que no responde.
    logger.warn('No se pudo registrar el arranque', error);
  }
};
