// App entry point
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { createLogger } from '@/lib/logger'
import './index.css'

const logger = createLogger('Boot')

// ── Benign browser warnings ────────────────────────────────────
// ResizeObserver's own loop-detection notice. Chrome/Safari/Radix all
// surface this as a window 'error'/'unhandledrejection' event even though
// nothing actually failed — it must never be treated as a fatal boot error.
const BENIGN_ERRORS = [/ResizeObserver loop (completed with undelivered notifications|limit exceeded)/];

function isBenignError(value: unknown): boolean {
  const message = typeof value === 'string' ? value : value instanceof Error ? value.message : '';
  return typeof message === 'string' && BENIGN_ERRORS.some((rx) => rx.test(message));
}

// ── Chunk-load error recovery ──────────────────────────────────
// After a deploy, browsers may still hold a cached index.html that
// references JS chunks that no longer exist (hash changed).
// Detect these errors and do ONE hard reload per session.
const CHUNK_RELOAD_KEY = 'tms_chunk_reload';

function isChunkError(e: unknown): boolean {
  const msg = (typeof e === 'string' ? e : e instanceof Error ? e.message : '').toLowerCase();
  return (
    msg.includes('importing a module script failed') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk')
  );
}

function reloadOnce() {
  // Only try once per page-load session to avoid loops
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  // Force a fresh page load bypassing cache
  window.location.reload();
}

/**
 * Un Error no tiene propiedades enumerables, así que el logger lo serializaba
 * como `{}`: en el iPhone quedaba constancia de que ALGO falló y nada más. Esto
 * lo desarma a mano para que el log de terreno diga qué fue y dónde.
 */
function describeError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (value && typeof value === 'object' && Object.keys(value).length === 0) {
    return { raw: String(value) };
  }
  return value;
}

function formatBootError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown startup error';
  }
}

// ── Boot-error scope ────────────────────────────────────────────
// This listener exists to catch FATAL startup failures on the operator
// portal (mobile app), not runtime mutation/query rejections in the
// admin desktop panel — each area already has its own ErrorBoundary and
// toasts for that. So the full-screen "Error al iniciar" only applies
// while (a) we're still in the boot phase and (b) the route is under
// the operator portal.
let bootCompleted = false;

function isOperatorPortalRoute(): boolean {
  return /^\/operator(\/|$)/.test(window.location.pathname);
}

function shouldShowBootError(): boolean {
  return !bootCompleted && isOperatorPortalRoute();
}

function markBootCompleted() {
  bootCompleted = true;
}

function showBootError(error: unknown) {
  const root = document.getElementById('root');
  if (!root) return;

  const message = formatBootError(error);
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:hsl(var(--background));padding:1.5rem;font-family:system-ui,-apple-system,sans-serif;color:hsl(var(--foreground));">
      <div style="max-width:35rem;width:100%;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:var(--radius);padding:1.25rem;box-shadow:var(--shadow-lg);">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.2;">Error al iniciar TMS Operador</h1>
        <p style="margin:0 0 0.75rem;color:hsl(var(--muted-foreground));font-size:0.875rem;">La app no pudo completar el arranque. Si este mensaje aparece en iPhone, comparte el texto con soporte.</p>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;background:hsl(var(--muted));color:hsl(var(--foreground));padding:0.75rem;border-radius:var(--radius);font-size:0.75rem;line-height:1.45;">${message}</pre>
      </div>
    </div>
  `;
}

window.addEventListener('unhandledrejection', (ev) => {
  if (isBenignError(ev.reason?.message ?? ev.reason)) {
    logger.warn('Aviso benigno ignorado', { reason: describeError(ev.reason) });
    return;
  }
  if (isChunkError(ev.reason)) {
    reloadOnce();
    return;
  }
  if (!shouldShowBootError()) {
    logger.error('Unhandled promise rejection (post-boot o fuera del portal operador)', { reason: describeError(ev.reason) });
    return;
  }
  showBootError(ev.reason);
});
window.addEventListener('error', (ev) => {
  if (isBenignError(ev.message) || isBenignError(ev.error)) {
    logger.warn('Aviso benigno ignorado', { message: ev.message });
    return;
  }
  if (isChunkError(ev.message) || isChunkError(ev.error)) {
    reloadOnce();
    return;
  }
  if (!shouldShowBootError()) {
    logger.error('Error global (post-boot o fuera del portal operador)', { message: ev.message, error: describeError(ev.error) });
    return;
  }
  showBootError(ev.error || ev.message);
});

// App booted fine → clear the flag so future deploys can retry
sessionStorage.removeItem(CHUNK_RELOAD_KEY);

if (Capacitor.isNativePlatform()) {
  void CapacitorUpdater.notifyAppReady();
}

// ── Render ─────────────────────────────────────────────────────
const rootElement = document.getElementById('root')!;

// Boot finishes the moment the app actually paints something into #root
// (past any top-level Suspense fallback). After that, unhandledrejection
// / error events are runtime issues, not startup failures.
const bootObserver = new MutationObserver(() => {
  markBootCompleted();
  bootObserver.disconnect();
});
bootObserver.observe(rootElement, { childList: true, subtree: true });

try {
  ReactDOM.createRoot(rootElement).render(
    <ErrorBoundary name="RootApp">
      <App />
    </ErrorBoundary>
  );
} catch (error) {
  showBootError(error);
  throw error;
}
