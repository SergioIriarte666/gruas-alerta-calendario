let loadPromise: Promise<typeof google> | null = null;

/**
 * Carga el script de Google Maps JavaScript API una sola vez por sesión
 * (múltiples componentes pueden llamar esto en paralelo sin duplicar el <script>).
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Maps solo puede cargarse en el navegador'));
      return;
    }

    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_JS_API_KEY as string | undefined;
    if (!apiKey) {
      reject(new Error('VITE_GOOGLE_MAPS_JS_API_KEY no está configurada'));
      return;
    }

    const callbackName = '__initGoogleMapsTripCalculator';
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      resolve(window.google);
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=${callbackName}&language=es&region=CL`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('No se pudo cargar Google Maps JavaScript API'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
