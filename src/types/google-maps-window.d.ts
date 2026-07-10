// @types/google.maps solo declara el namespace `google.maps`; esta
// augmentación permite tipar `window.google` cuando el script se carga
// dinámicamente en runtime (ver src/lib/googleMapsLoader.ts).
declare global {
  interface Window {
    google: typeof google;
  }
}

export {};
