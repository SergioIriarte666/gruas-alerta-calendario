import { Preferences } from '@capacitor/preferences';

/**
 * Último error fatal, guardado en almacenamiento NATIVO.
 *
 * No se sube en el momento a propósito: cuando la app muere en terreno, muchas
 * veces el error ES que no hay red. Se persiste local y viaja en el arranque
 * siguiente (ver `recordAppBoot`), que es cuando hay una conexión que lo pueda
 * llevar.
 */
const LAST_ERROR_KEY = 'operator-last-fatal-error-v1';

/** Recorte del stack: lo que importa es el marco de arriba, no la novela. */
const MAX_ERROR_LENGTH = 4000;

export interface StoredFatalError {
  at?: string;
  detail?: string;
}

export const describeFatalError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ''}`.slice(0, MAX_ERROR_LENGTH);
  }
  if (typeof error === 'string') return error.slice(0, MAX_ERROR_LENGTH);
  try {
    return JSON.stringify(error).slice(0, MAX_ERROR_LENGTH);
  } catch {
    return String(error).slice(0, MAX_ERROR_LENGTH);
  }
};

/**
 * Deja constancia local de un error fatal. Fire-and-forget: quien lo llama está
 * en medio de un fallo y no puede esperar a un await ni recibir otro error.
 *
 * Este módulo NO importa nada pesado —ni el cliente de Supabase, ni el
 * uploader— porque lo carga `main.tsx` en el camino crítico del arranque. La
 * app operador ya se cayó una vez por una excepción en esa fase; el mecanismo
 * que registra los fallos no puede ser una fuente de fallos.
 */
export const rememberFatalError = (error: unknown): void => {
  void Preferences.set({
    key: LAST_ERROR_KEY,
    value: JSON.stringify({ at: new Date().toISOString(), detail: describeFatalError(error) }),
  }).catch(() => {
    // Si ni el almacenamiento local responde, no hay nada más que intentar.
  });
};

/** Lee y BORRA el error guardado: se sube una vez y no se repite. */
export const takeLastFatalError = async (): Promise<string | null> => {
  const { value } = await Preferences.get({ key: LAST_ERROR_KEY });
  if (!value) return null;

  await Preferences.remove({ key: LAST_ERROR_KEY });
  const parsed = JSON.parse(value) as StoredFatalError;
  return `[${parsed.at ?? 'sin fecha'}] ${parsed.detail ?? value}`.slice(0, MAX_ERROR_LENGTH);
};
