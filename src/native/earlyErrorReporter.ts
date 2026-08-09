import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('EarlyErrorReporter');

/** Misma llave que usa el script inline de index.html. */
const MIRROR_KEY = 'tms.earlyErrors.v1';
/** Cola que sobrevive al cierre de la app cuando el envío falla. */
const BACKLOG_KEY = 'operator-early-errors-v1';

/**
 * La edge function limita a 10 por minuto por IP. Se manda de a poco y lo que
 * sobra queda para el arranque siguiente: perder el envío por rate limit sería
 * exactamente el fallo que esto viene a evitar.
 */
const MAX_PER_BOOT = 8;
const MAX_BACKLOG = 30;
const MAX_TEXT = 4000;

/** Lo que encola el script inline de index.html. */
export interface EarlyErrorEntry {
  kind?: 'early' | 'capgo';
  type?: string;
  message?: string;
  stack?: string;
  source?: string;
  line?: string;
  column?: string;
  extra?: string;
  at?: string;
  userAgent?: string;
  href?: string;
}

declare global {
  interface Window {
    __earlyErrors?: EarlyErrorEntry[];
  }
}

let flushed = false;

const cut = (value: unknown): string => {
  try {
    return value == null ? '' : String(value).slice(0, MAX_TEXT);
  } catch {
    return '';
  }
};

const parseList = (raw: string | null | undefined): EarlyErrorEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EarlyErrorEntry[]) : [];
  } catch {
    return [];
  }
};

/** Dos capturas del mismo fallo (espejo + memoria) no valen dos filas. */
const dedupeKey = (entry: EarlyErrorEntry): string =>
  [entry.kind, entry.type, entry.message, entry.source, entry.line, entry.column].join('|');

const readBacklog = async (): Promise<EarlyErrorEntry[]> => {
  try {
    const { value } = await Preferences.get({ key: BACKLOG_KEY });
    return parseList(value);
  } catch {
    return [];
  }
};

const writeBacklog = async (entries: EarlyErrorEntry[]): Promise<void> => {
  try {
    if (entries.length === 0) {
      await Preferences.remove({ key: BACKLOG_KEY });
      return;
    }
    await Preferences.set({
      key: BACKLOG_KEY,
      value: JSON.stringify(entries.slice(-MAX_BACKLOG)),
    });
  } catch {
    // Sin almacenamiento no hay reintento posible; no vale un fallo.
  }
};

const resolveAppVersion = async (): Promise<string> => {
  if (!Capacitor.isNativePlatform()) return 'web';
  try {
    const info = await CapacitorApp.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    return 'unknown';
  }
};

/**
 * El prefijo es el que se busca en la consulta de diagnóstico:
 *   select ... from frontend_error_logs where error_message like '[early]%'
 */
const buildMessage = (entry: EarlyErrorEntry): string => {
  const prefix = entry.kind === 'capgo' ? '[capgo]' : '[early]';
  const type = entry.type || 'error';
  const message = entry.message || '(sin mensaje)';
  return `${prefix} ${type}: ${message}`.slice(0, MAX_TEXT);
};

const buildStack = (entry: EarlyErrorEntry, appVersion: string): string => {
  const where = [entry.source, entry.line, entry.column].filter(Boolean).join(':');
  return [
    entry.stack ? `stack:\n${entry.stack}` : 'stack: (no disponible)',
    where ? `origen: ${where}` : null,
    `capturado: ${entry.at || 'sin fecha'}`,
    `app: ${appVersion} · ${Capacitor.getPlatform()}`,
    entry.userAgent ? `ua: ${entry.userAgent}` : null,
    entry.extra ? `payload: ${entry.extra}` : null,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_TEXT);
};

/**
 * Vuelca a `frontend_error_logs` los errores capturados antes de que React
 * montara.
 *
 * Se manda por la edge function `log-frontend-error` y no por un insert
 * directo: `authenticated` solo tiene SELECT sobre esa tabla, así que un
 * insert desde el cliente se rechaza. La función corre con service_role y
 * `verify_jwt = false`, o sea que también sirve antes de iniciar sesión —
 * justo el momento en que ocurre este error.
 *
 * Se traga todo: es diagnóstico y no puede ser la razón por la que un operador
 * no logra abrir la app.
 */
export const flushEarlyErrors = async (): Promise<void> => {
  if (flushed) return;
  flushed = true;

  try {
    const inMemory = Array.isArray(window.__earlyErrors) ? window.__earlyErrors : [];

    let mirrored: EarlyErrorEntry[] = [];
    try {
      mirrored = parseList(window.localStorage.getItem(MIRROR_KEY));
    } catch {
      mirrored = [];
    }

    const backlog = await readBacklog();

    const seen = new Set<string>();
    const pending: EarlyErrorEntry[] = [];
    for (const entry of [...backlog, ...mirrored, ...inMemory]) {
      const key = dedupeKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      pending.push(entry);
    }

    // El espejo se limpia ya: lo que no se alcance a mandar queda en el backlog
    // de Preferences. Dejar ambas copias duplicaría en el próximo arranque.
    try {
      window.localStorage.removeItem(MIRROR_KEY);
    } catch {
      /* ignorado */
    }
    if (Array.isArray(window.__earlyErrors)) window.__earlyErrors.length = 0;

    if (pending.length === 0) {
      await writeBacklog([]);
      return;
    }

    const appVersion = await resolveAppVersion();
    const toSend = pending.slice(0, MAX_PER_BOOT);
    const deferred = pending.slice(MAX_PER_BOOT);
    const failed: EarlyErrorEntry[] = [];

    for (const entry of toSend) {
      try {
        const { error } = await supabase.functions.invoke('log-frontend-error', {
          body: {
            componentName: entry.kind === 'capgo' ? 'CapgoWebViewError' : 'BootEarlyError',
            errorMessage: buildMessage(entry),
            errorStack: buildStack(entry, appVersion),
            url: cut(entry.href) || undefined,
          },
        });
        if (error) throw error;
      } catch (sendError) {
        logger.warn('No se pudo subir un error temprano; queda para el próximo arranque', sendError);
        failed.push(entry);
      }
    }

    await writeBacklog([...failed, ...deferred]);

    const sent = toSend.length - failed.length;
    if (sent > 0) {
      logger.info(`Errores tempranos subidos: ${sent}`, { pendientes: failed.length + deferred.length });
    }
  } catch (error) {
    logger.warn('El volcado de errores tempranos falló por completo', error);
  }
};
