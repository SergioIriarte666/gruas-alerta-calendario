// App entry point
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'

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

function formatBootError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown startup error';
  }
}

function showBootError(error: unknown) {
  const root = document.getElementById('root');
  if (!root) return;

  const message = formatBootError(error);
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:24px;font-family:system-ui,-apple-system,sans-serif;color:#fff;">
      <div style="max-width:560px;width:100%;background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.35);">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.2;">Error al iniciar TMS Operador</h1>
        <p style="margin:0 0 12px;color:#cbd5e1;font-size:14px;">La app no pudo completar el arranque. Si este mensaje aparece en iPhone, comparte el texto con soporte.</p>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;background:#020617;color:#f8fafc;padding:12px;border-radius:12px;font-size:12px;line-height:1.45;">${message}</pre>
      </div>
    </div>
  `;
}

window.addEventListener('unhandledrejection', (ev) => {
  if (isChunkError(ev.reason)) {
    reloadOnce();
    return;
  }
  showBootError(ev.reason);
});
window.addEventListener('error', (ev) => {
  if (isChunkError(ev.message) || isChunkError(ev.error)) {
    reloadOnce();
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
try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary name="RootApp">
      <App />
    </ErrorBoundary>
  );
} catch (error) {
  showBootError(error);
  throw error;
}
