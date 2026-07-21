let loadPromise: Promise<typeof google> | null = null;

/**
 * Errores de autorización de la API key (RefererNotAllowedMapError,
 * InvalidKeyMapError, ApiNotActivatedMapError, etc.) NO lanzan excepción: Google
 * los reporta de forma asíncrona vía el callback global `gm_authFailure` y pinta
 * su propio cuadro de error gris dentro del contenedor. Sin este hook el
 * componente creería que el mapa cargó bien. Latcheamos el fallo y notificamos a
 * los suscriptores para que la UI muestre la razón real en vez de un mapa en blanco.
 */
let authFailed = false;
type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();

function installAuthFailureHandler() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { gm_authFailure?: () => void };
  if (w.gm_authFailure) return;
  w.gm_authFailure = () => {
    authFailed = true;
    authFailureListeners.forEach((listener) => listener());
  };
}

/**
 * Suscribe un listener al fallo de autorización de Google Maps. Si el fallo ya
 * ocurrió, se invoca de inmediato. Devuelve una función para desuscribirse.
 */
export function onGoogleMapsAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener);
  if (authFailed) listener();
  return () => authFailureListeners.delete(listener);
}

export function hasGoogleMapsAuthFailed(): boolean {
  return authFailed;
}

/**
 * Carga el script de Google Maps JavaScript API una sola vez por sesión
 * (múltiples componentes pueden llamar esto en paralelo sin duplicar el <script>).
 */
export function loadGoogleMaps(): Promise<typeof google> {
  installAuthFailureHandler();

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
