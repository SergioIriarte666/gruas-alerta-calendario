// App entry point
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
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

window.addEventListener('unhandledrejection', (ev) => {
  if (isChunkError(ev.reason)) reloadOnce();
});
window.addEventListener('error', (ev) => {
  if (isChunkError(ev.message) || isChunkError(ev.error)) reloadOnce();
});

// App booted fine → clear the flag so future deploys can retry
sessionStorage.removeItem(CHUNK_RELOAD_KEY);

// ── Render ─────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.Fragment>
    <App />
  </React.Fragment>,
)
