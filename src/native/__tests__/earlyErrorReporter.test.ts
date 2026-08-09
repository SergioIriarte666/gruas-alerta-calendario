import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const prefsStore = new Map<string, string>();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}));

vi.mock('@capacitor/app', () => ({
  App: { getInfo: vi.fn().mockResolvedValue({ version: '1.0.1', build: '9' }) },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefsStore.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      prefsStore.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      prefsStore.delete(key);
    }),
  },
}));

const MIRROR_KEY = 'tms.earlyErrors.v1';
const BACKLOG_KEY = 'operator-early-errors-v1';

/** El módulo lleva un flag de "ya volcado" por proceso: hay que reimportarlo. */
const loadReporter = async () => {
  vi.resetModules();
  return (await import('../earlyErrorReporter')).flushEarlyErrors;
};

describe('volcado de errores tempranos', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ error: null });
    prefsStore.clear();
    window.localStorage.clear();
    window.__earlyErrors = [];
  });

  it('sube el error del bundle con prefijo [early] y su stack', async () => {
    window.__earlyErrors = [
      {
        kind: 'early',
        type: 'javascript_error',
        message: "null is not an object (evaluating 'x.y')",
        stack: 'at boot (index-abc.js:1:2)',
        source: 'capacitor://localhost/assets/index-abc.js',
        line: '1',
        column: '2',
        at: '2026-08-09T12:00:00.000Z',
        userAgent: 'iPhone',
        href: 'capacitor://localhost/operator',
      },
    ];

    const flush = await loadReporter();
    await flush();

    expect(invoke).toHaveBeenCalledTimes(1);
    const [fnName, options] = invoke.mock.calls[0] as [string, { body: Record<string, string> }];
    expect(fnName).toBe('log-frontend-error');
    expect(options.body.componentName).toBe('BootEarlyError');
    expect(options.body.errorMessage).toBe(
      "[early] javascript_error: null is not an object (evaluating 'x.y')",
    );
    expect(options.body.errorStack).toContain('at boot (index-abc.js:1:2)');
    expect(options.body.errorStack).toContain('capacitor://localhost/assets/index-abc.js:1:2');
    expect(options.body.errorStack).toContain('app: 1.0.1 (9)');
    expect(options.body.url).toBe('capacitor://localhost/operator');
  });

  it('marca con [capgo] lo que reporta el plugin del updater', async () => {
    window.__earlyErrors = [
      {
        kind: 'capgo',
        type: 'webview_unclean_restart',
        message: 'WebView restarted without a clean page unload',
        extra: '{"type":"webview_unclean_restart"}',
      },
    ];

    const flush = await loadReporter();
    await flush();

    const [, options] = invoke.mock.calls[0] as [string, { body: Record<string, string> }];
    expect(options.body.componentName).toBe('CapgoWebViewError');
    expect(options.body.errorMessage).toMatch(/^\[capgo\] webview_unclean_restart: /);
    expect(options.body.errorStack).toContain('payload: {"type":"webview_unclean_restart"}');
  });

  it('recupera lo que quedó en el espejo de localStorage tras un crash', async () => {
    window.localStorage.setItem(
      MIRROR_KEY,
      JSON.stringify([{ kind: 'early', type: 'javascript_error', message: 'murió antes de montar' }]),
    );

    const flush = await loadReporter();
    await flush();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(MIRROR_KEY)).toBeNull();
  });

  it('no duplica el mismo error capturado en memoria y en el espejo', async () => {
    const entry = { kind: 'early' as const, type: 'javascript_error', message: 'uno solo' };
    window.__earlyErrors = [entry];
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify([entry]));

    const flush = await loadReporter();
    await flush();

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('sin red deja el error en Preferences para el arranque siguiente', async () => {
    invoke.mockResolvedValue({ error: new Error('Failed to fetch') });
    window.__earlyErrors = [{ kind: 'early', type: 'javascript_error', message: 'sin red' }];

    const flush = await loadReporter();
    await flush();

    const backlog = JSON.parse(prefsStore.get(BACKLOG_KEY) ?? '[]');
    expect(backlog).toHaveLength(1);
    expect(backlog[0].message).toBe('sin red');
    // El espejo se limpia igual: la copia viva ahora es el backlog.
    expect(window.localStorage.getItem(MIRROR_KEY)).toBeNull();
  });

  it('el backlog se vacía cuando el envío por fin funciona', async () => {
    prefsStore.set(
      BACKLOG_KEY,
      JSON.stringify([{ kind: 'early', type: 'javascript_error', message: 'de ayer' }]),
    );

    const flush = await loadReporter();
    await flush();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(prefsStore.get(BACKLOG_KEY)).toBeUndefined();
  });

  it('respeta el límite de la edge function y guarda el resto', async () => {
    window.__earlyErrors = Array.from({ length: 12 }, (_, index) => ({
      kind: 'early' as const,
      type: 'javascript_error',
      message: `error ${index}`,
    }));

    const flush = await loadReporter();
    await flush();

    // La función limita a 10 por minuto por IP.
    expect(invoke).toHaveBeenCalledTimes(8);
    expect(JSON.parse(prefsStore.get(BACKLOG_KEY) ?? '[]')).toHaveLength(4);
  });

  it('nunca lanza, aunque el almacenamiento esté roto', async () => {
    const spy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    const flush = await loadReporter();
    await expect(flush()).resolves.toBeUndefined();

    spy.mockRestore();
  });
});

describe('script inline de captura temprana', () => {
  const html = () => readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  /** Sin comentarios: el patrón prohibido se documenta ahí a propósito. */
  const code = () => html().replace(/<!--[\s\S]*?-->/g, '');

  it('se registra antes que cualquier otro script de la página', () => {
    const source = html();
    // El de apariencia también es inline; el de errores tiene que ir primero o
    // no vería una excepción lanzada por aquél.
    expect(source.indexOf('__earlyErrors')).toBeLessThan(source.indexOf('tms.appearance.device'));
    expect(source.indexOf('__earlyErrors')).toBeLessThan(source.indexOf('src/main.tsx'));
  });

  it('escucha en fase de captura y no se traga los errores', () => {
    const source = code();
    expect(source).toContain("window.addEventListener('error', function (event) {");
    expect(source).toContain("window.addEventListener('unhandledrejection', function (event) {");
    // Sin preventDefault: el comportamiento actual no cambia.
    expect(source).not.toContain('preventDefault');
  });

  it('envuelve reportWebViewError delegando siempre en el original', () => {
    const source = html();
    expect(source).toContain('reportWebViewError');
    expect(source).toContain('return original(payload);');
  });

  it('espeja la cola en la misma llave que lee el volcado', () => {
    expect(html()).toContain(MIRROR_KEY);
  });
});

/**
 * Se EJECUTA el script inline tal como está en index.html y se le disparan
 * eventos reales. Es lo más cerca del dispositivo que se puede llegar sin el
 * dispositivo: si esto no encola, en el iPhone tampoco.
 */
describe('script inline en ejecución', () => {
  const runInlineScript = () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const start = html.indexOf('<script>');
    const body = html.slice(start + '<script>'.length, html.indexOf('</script>', start));
    // El script se autoprotege con `if (window.__earlyErrors) return`, y el
    // describe anterior deja esa marca puesta: hay que borrarla o no registra
    // ningún listener.
    delete (window as { __earlyErrors?: unknown }).__earlyErrors;
    new Function(body)();
  };

  /**
   * El capturador va en fase de captura y NO llama a preventDefault, que es la
   * propiedad que se quiere: el error sigue su curso. Para que ese curso no
   * termine en un "unhandled error" del runner, el test lo absorbe con un
   * listener propio en fase de burbuja, que corre DESPUÉS del capturador.
   */
  const dispatchErrorEvent = (event: Event) => {
    const absorb = (e: Event) => e.preventDefault();
    window.addEventListener('error', absorb);
    try {
      window.dispatchEvent(event);
    } finally {
      window.removeEventListener('error', absorb);
    }
  };

  // UNA sola vez: jsdom conserva el window entre tests y volver a ejecutarlo
  // dejaría dos listeners encolando el mismo error dos veces.
  beforeAll(() => {
    runInlineScript();
  });

  beforeEach(() => {
    if (window.__earlyErrors) window.__earlyErrors.length = 0;
    window.localStorage.clear();
  });

  it('encola una excepción del bundle con archivo, línea y columna', () => {
    const event = new Event('error', { cancelable: true }) as Event & Record<string, unknown>;
    Object.assign(event, {
      message: "null is not an object (evaluating 'te.latitude')",
      filename: 'capacitor://localhost/assets/index-abc.js',
      lineno: 42,
      colno: 7,
      error: Object.assign(new Error('boom'), { stack: 'Error: boom\n at index-abc.js:42:7' }),
    });
    dispatchErrorEvent(event);

    const queued = window.__earlyErrors ?? [];
    expect(queued).toHaveLength(1);
    expect(queued[0].kind).toBe('early');
    expect(queued[0].type).toBe('javascript_error');
    expect(queued[0].message).toContain('te.latitude');
    expect(queued[0].source).toBe('capacitor://localhost/assets/index-abc.js');
    expect(queued[0].line).toBe('42');
    expect(queued[0].column).toBe('7');
    expect(queued[0].stack).toContain('index-abc.js:42:7');
  });

  it('espeja lo encolado en localStorage al instante', () => {
    const event = new Event('error', { cancelable: true }) as Event & Record<string, unknown>;
    Object.assign(event, { message: 'crash antes de montar' });
    dispatchErrorEvent(event);

    const mirrored = JSON.parse(window.localStorage.getItem(MIRROR_KEY) ?? '[]');
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0].message).toBe('crash antes de montar');
  });

  it('captura el payload que el plugin le pasa al nativo y lo delega', async () => {
    const original = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { Capacitor: unknown }).Capacitor = {
      Plugins: { CapacitorUpdater: { reportWebViewError: original } },
    };

    // El envoltorio se instala por sondeo (100 ms).
    await new Promise((r) => setTimeout(r, 250));

    const payload = {
      type: 'webview_unclean_restart',
      message: 'WebView restarted without a clean page unload',
    };
    const plugin = (window as unknown as {
      Capacitor: { Plugins: { CapacitorUpdater: { reportWebViewError: (p: unknown) => unknown } } };
    }).Capacitor.Plugins.CapacitorUpdater;
    plugin.reportWebViewError(payload);

    expect(original).toHaveBeenCalledWith(payload);
    const queued = (window.__earlyErrors ?? []).filter((e) => e.kind === 'capgo');
    expect(queued).toHaveLength(1);
    expect(queued[0].type).toBe('webview_unclean_restart');
  });

  it('un error dentro del propio capturador no rompe la página', () => {
    const event = new Event('error', { cancelable: true });
    // defineProperty y no Object.assign: assign dispararía el getter aquí
    // mismo, antes de que el capturador llegue a verlo.
    Object.defineProperty(event, 'message', {
      get() {
        throw new Error('getter hostil');
      },
    });
    expect(() => dispatchErrorEvent(event)).not.toThrow();
  });
});
