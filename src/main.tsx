// App entry point
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const CHUNK_RELOAD_KEY = 'tms_chunk_reload_attempted';

const isChunkLoadError = (value: unknown): boolean => {
  const message =
    typeof value === 'string'
      ? value
      : value instanceof Error
      ? value.message
      : '';

  const normalized = message.toLowerCase();

  return (
    normalized.includes('importing a module script failed') ||
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('loading chunk')
  );
};

const reloadWithCacheBustOnce = () => {
  const alreadyTried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
  if (alreadyTried) return;

  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.replace(url.toString());
};

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    reloadWithCacheBustOnce();
  }
});

window.addEventListener('error', (event) => {
  if (isChunkLoadError(event.message) || isChunkLoadError((event as ErrorEvent).error)) {
    reloadWithCacheBustOnce();
  }
});

// If app booted correctly, clear retry flag for future deploys
sessionStorage.removeItem(CHUNK_RELOAD_KEY);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.Fragment>
    <App />
  </React.Fragment>,
)
