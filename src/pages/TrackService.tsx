import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MapPin, Phone, TriangleAlert } from 'lucide-react';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';
import { getCraneTypeLabel } from '@/utils/craneType';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const logger = createLogger('PublicTracking');

const POLL_INTERVAL_MS = 15000;
const RELATIVE_TIME_TICK_MS = 10000;
const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const DEFAULT_ZOOM = 13;
// Distancia grua-origen mas alla de la cual el dato de origen se considera
// sospechoso (p.ej. geocoding de baja calidad que devolvio un centroide lejano)
// y se ignora en el encuadre del mapa.
const MAX_PLAUSIBLE_ORIGIN_DISTANCE_KM = 300;

const EARTH_RADIUS_KM = 6371;

const LOGO_SRC = '/logo-gruas-5-norte.png';
const COMPANY_NAME = 'Grúas 5 Norte';
const COMPANY_LOCATION = 'Copiapó';
// Fallback si Configuracion > Empresa > "Contacto operativo" esta vacio: el
// backend (service-tracking) manda ese valor como support_phone; este es
// solo el respaldo para que el boton nunca quede roto/sin numero.
const DEFAULT_COMPANY_PHONE_E164 = '+56962380627';

// El valor guardado en Configuracion trae formato "+56 9 1234 5678" (ver
// PhoneInput): quitar espacios para armar un href tel: valido.
const toTelHref = (phone: string): string => `tel:${phone.replace(/\s+/g, '')}`;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PULSE_STYLE_ID = 'tm-marker-pulse-style';

// Inyectado una sola vez: Mapbox renderiza los marcadores como elementos DOM
// planos, no hay forma de usar CSS-in-JS/modulos aqui.
const ensurePulseStyleInjected = () => {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes tm-pulse-ring {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
};

// Trazos de lucide-react (Truck / MapPin) embebidos a mano: los marcadores de
// Mapbox son elementos DOM crudos, fuera del arbol de React.
const TRUCK_ICON_PATHS = `
  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
  <path d="M15 18H9" />
  <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
  <circle cx="17" cy="18" r="2" />
  <circle cx="7" cy="18" r="2" />
`;

const MAP_PIN_ICON_PATH = `
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
  <circle cx="12" cy="10" r="3" />
`;

const CRANE_MARKER_SIZE = 48;
const CRANE_ICON_SIZE = 28;
const GRAY_MUTED = '#6b7280';

const createCraneMarkerElement = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = `${CRANE_MARKER_SIZE}px`;
  wrapper.style.height = `${CRANE_MARKER_SIZE}px`;

  const ring = document.createElement('div');
  ring.className = 'tm-crane-pulse';
  ring.style.position = 'absolute';
  ring.style.inset = '0';
  ring.style.borderRadius = '9999px';

  const circle = document.createElement('div');
  circle.className = 'tm-crane-circle';
  circle.style.position = 'absolute';
  circle.style.inset = '0';
  circle.style.borderRadius = '9999px';
  circle.style.backgroundColor = '#ffffff';
  circle.style.boxShadow = '0 4px 12px rgba(15,23,42,0.35)';
  circle.style.display = 'flex';
  circle.style.alignItems = 'center';
  circle.style.justifyContent = 'center';

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'tm-crane-icon';
  iconWrapper.style.width = `${CRANE_ICON_SIZE}px`;
  iconWrapper.style.height = `${CRANE_ICON_SIZE}px`;
  iconWrapper.style.transition = 'transform 0.3s ease';
  iconWrapper.innerHTML = `<svg width="${CRANE_ICON_SIZE}" height="${CRANE_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRUCK_ICON_PATHS}</svg>`;

  circle.appendChild(iconWrapper);
  wrapper.appendChild(ring);
  wrapper.appendChild(circle);

  return { wrapper, ring, circle, iconWrapper };
};

const updateCraneMarkerElement = (
  refs: ReturnType<typeof createCraneMarkerElement>,
  heading: number | null,
  isActive: boolean,
) => {
  const color = isActive ? 'hsl(var(--primary))' : GRAY_MUTED;
  refs.circle.style.border = `2px solid ${color}`;
  const svg = refs.iconWrapper.querySelector('svg');
  if (svg) svg.setAttribute('stroke', color);

  if (typeof heading === 'number') {
    refs.iconWrapper.style.transform = `rotate(${heading}deg)`;
  }

  const animate = isActive && !prefersReducedMotion();
  refs.ring.style.backgroundColor = animate ? 'hsl(var(--primary))' : 'transparent';
  refs.ring.style.animation = animate ? 'tm-pulse-ring 2s ease-out infinite' : 'none';
};

const ORIGIN_LABEL_MAX_CHARS = 24;

// El texto de origen viene tal como se tipeo en el formulario (p.ej.
// "salares norte"): se capitaliza solo para mostrar, sin tocar el dato.
const toTitleCase = (text: string): string =>
  text.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

const truncateLabel = (text: string): string =>
  text.length > ORIGIN_LABEL_MAX_CHARS ? `${text.slice(0, ORIGIN_LABEL_MAX_CHARS).trimEnd()}…` : text;

const createOriginMarkerElement = () => {
  // Ancla de tamano cero: el pin se dibuja hacia arriba desde este punto (su
  // punta queda exactamente en la coordenada) y la etiqueta se posiciona
  // debajo, sin desplazar el punto de anclaje real usado por Mapbox.
  const anchor = document.createElement('div');
  anchor.style.position = 'relative';
  anchor.style.width = '0px';
  anchor.style.height = '0px';

  const pin = document.createElement('div');
  pin.style.position = 'absolute';
  pin.style.bottom = '0';
  pin.style.left = '0';
  pin.style.transform = 'translate(-50%, 0)';
  pin.style.lineHeight = '0';
  pin.innerHTML = `<svg width="32" height="40" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(15,23,42,0.35));">${MAP_PIN_ICON_PATH}</svg>`;

  const label = document.createElement('div');
  label.style.position = 'absolute';
  label.style.top = '6px';
  label.style.left = '0';
  label.style.transform = 'translate(-50%, 0)';
  label.style.whiteSpace = 'nowrap';
  label.style.backgroundColor = '#ffffff';
  label.style.borderRadius = '9999px';
  label.style.padding = '2px 8px';
  label.style.boxShadow = '0 2px 6px rgba(15,23,42,0.25)';
  label.style.fontSize = '11px';
  label.style.fontWeight = '600';
  label.style.color = '#1f2937';

  anchor.appendChild(pin);
  anchor.appendChild(label);

  return { anchor, label };
};

const haversineDistanceKm = (a: [number, number], b: [number, number]): number => {
  const [lngA, latA] = a;
  const [lngB, latB] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Decodifica una polyline codificada de Google (mismo algoritmo que usa
// maps-proxy) — el backend de service-tracking envia la polyline sin
// decodificar, este es el unico consumidor.
const decodePolyline = (encoded: string): [number, number][] => {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
};

const ROUTE_SOURCE_ID = 'tm-route-source';
const ROUTE_CASING_LAYER_ID = 'tm-route-casing';
const ROUTE_LINE_LAYER_ID = 'tm-route-line';
const DEFAULT_ROUTE_COLOR = '#8b5cf6';

// Mapbox GL usa csscolorparser internamente, que solo entiende la sintaxis
// legacy "hsl(h, s%, l%)" con comas — la sintaxis moderna sin comas que usan
// los tokens del tema ("271 81% 56%") hace que addLayer falle en silencio
// (emite un error async, no lanza), dejando la capa sin dibujar. Bug real
// encontrado en producción: la polyline nunca se veía desde Fase 2 por esto.
const resolvePrimaryColor = (): string => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const parts = raw.split(/\s+/);
  if (parts.length !== 3) return DEFAULT_ROUTE_COLOR;
  const [h, s, l] = parts;
  return `hsl(${h}, ${s}, ${l})`;
};

// > 60 min -> "4 h 54 min" (nunca "294 min").
const formatDurationLabel = (seconds: number): string => {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
};

// >= 10 km sin decimales, bajo eso con 1 decimal.
const formatDistanceLabel = (meters: number): string => {
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
};

const formatRelativeShort = (isoTimestamp: string, nowMs: number): string => {
  const diffSec = Math.max(0, Math.round((nowMs - new Date(isoTimestamp).getTime()) / 1000));
  if (diffSec < 10) return 'justo ahora';
  if (diffSec < 60) return `hace ${diffSec} s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  return `hace ${diffDay} d`;
};

// Fuerza un re-render periodico para que los relativos ("hace X s") avancen
// solos entre polls. UI pura: Date.now() se lee en el render, no aqui.
const useTick = (intervalMs: number) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
};

type JourneyStage = 'assigned' | 'en_route' | 'on_site' | 'towing' | 'finished';

const JOURNEY_STEPS: { key: JourneyStage; label: string }[] = [
  { key: 'assigned', label: 'Asignado' },
  { key: 'en_route', label: 'En camino' },
  { key: 'on_site', label: 'En el lugar' },
  { key: 'towing', label: 'Trasladando' },
  { key: 'finished', label: 'Finalizado' },
];

const STAGE_TITLES: Record<JourneyStage, string> = {
  assigned: 'Preparando tu servicio',
  en_route: 'Tu grúa va en camino',
  on_site: 'Tu grúa llegó al punto de origen',
  towing: 'Trasladando tu vehículo',
  finished: 'Servicio finalizado',
};

// Pildora compacta: en 390px de ancho no entran los 5 labels completos, asi
// que solo se muestra el label del paso activo + puntos para el resto.
const JourneyStepper = ({ stage }: { stage: JourneyStage }) => {
  const currentIndex = JOURNEY_STEPS.findIndex((step) => step.key === stage);
  const currentLabel = JOURNEY_STEPS[currentIndex]?.label ?? JOURNEY_STEPS[0].label;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-2 shadow-md backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        {JOURNEY_STEPS.map((step, index) => {
          const isDone = currentIndex >= 0 && index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <span key={step.key} className="relative flex size-2.5 items-center justify-center">
              {isCurrent && (
                <span className="motion-safe:animate-ping absolute inline-flex size-2.5 rounded-full bg-primary opacity-60" />
              )}
              <span
                className={cn(
                  'relative inline-block rounded-full transition-all',
                  isCurrent ? 'size-2.5 bg-primary' : isDone ? 'size-2 bg-primary/50' : 'size-2 bg-muted-foreground/30',
                )}
              />
            </span>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-foreground">{currentLabel}</span>
    </div>
  );
};

type TrackingState = 'active' | 'no_signal' | 'waiting' | 'finished';

interface TrackingResponse {
  state: TrackingState;
  folio: string;
  crane?: { plate: string; type: string } | null;
  operator_first_name?: string | null;
  position?: {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    recorded_at: string;
  } | null;
  origin?: { lat: number | null; lng: number | null; text: string | null };
  journey_stage?: JourneyStage;
  eta?: { seconds: number; distance_meters: number; polyline: string } | null;
  // true cuando el origen existe pero Google no puede rutear la zona: la UI
  // muestra distancia en línea recta en vez de "Calculando..." permanente.
  eta_unavailable?: boolean;
  support_phone?: string | null;
}

type PageStatus = 'loading' | 'ready' | 'invalid' | 'error';

const useServiceTrackingPoll = (token: string | undefined) => {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [data, setData] = useState<TrackingResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;
    let finished = false;

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const poll = async () => {
      if (document.hidden || finished) return;
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/service-tracking?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;

        if (!response.ok) {
          setStatus('invalid');
          return;
        }

        const json = (await response.json()) as TrackingResponse;
        setData(json);
        setStatus('ready');

        if (json.state === 'finished') {
          finished = true;
          stopPolling();
        }
      } catch (error) {
        if (cancelled) return;
        logger.warn('No se pudo obtener el estado de seguimiento', error);
        setStatus((prev) => (prev === 'ready' ? prev : 'error'));
      }
    };

    void poll();
    if (!finished) {
      intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    }

    const handleVisibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token]);

  return { status, data };
};

const TrackingMap = ({ data }: { data: TrackingResponse }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const mapboxRef = useRef<MapboxModule | null>(null);
  const craneMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const craneElRefs = useRef<ReturnType<typeof createCraneMarkerElement> | null>(null);
  const originMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const originElRefs = useRef<ReturnType<typeof createOriginMarkerElement> | null>(null);
  const [mapboxReady, setMapboxReady] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    ensurePulseStyleInjected();

    let cancelled = false;
    let localMap: import('mapbox-gl').Map | null = null;

    void loadMapbox()
      .then((mapboxgl) => {
        if (cancelled || !containerRef.current) return;

        mapboxRef.current = mapboxgl;
        mapboxgl.default.accessToken = MAPBOX_TOKEN;

        localMap = new mapboxgl.default.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: COPIAPO_CENTER,
          zoom: 13,
        });
        localMap.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), 'top-right');
        // addSource/addLayer (linea de ruta) exigen que el estilo ya haya
        // cargado; los Marker DOM no, por eso mapboxReady no basta para ellos.
        localMap.once('load', () => {
          if (!cancelled) setStyleLoaded(true);
        });
        mapRef.current = localMap;
        setMapboxReady(true);
      })
      .catch((error) => {
        logger.error('No se pudo cargar el mapa', error);
      });

    return () => {
      cancelled = true;
      setMapboxReady(false);
      setStyleLoaded(false);
      craneMarkerRef.current?.remove();
      craneMarkerRef.current = null;
      craneElRefs.current = null;
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      originElRefs.current = null;
      localMap?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapboxReady) return;

    // Linea de ruta hasta el origen: casing blanco ancho 8 debajo + linea
    // color primario ancho 4.5 encima, ambas bajo los marcadores (los
    // marcadores son elementos DOM, no layers del mapa GL).
    if (styleLoaded) {
      const polylineCoords = data.eta?.polyline ? decodePolyline(data.eta.polyline) : [];
      const routeData = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: polylineCoords },
      };

      const existingSource = map.getSource(ROUTE_SOURCE_ID) as import('mapbox-gl').GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(routeData);
      } else if (polylineCoords.length > 1) {
        map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: routeData });
        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': resolvePrimaryColor(), 'line-width': 4.5 },
        });
      }
    }

    const craneCoords: [number, number] | null = data.position
      ? [data.position.lng, data.position.lat]
      : null;
    const rawOriginCoords: [number, number] | null = data.origin?.lat != null && data.origin?.lng != null
      ? [data.origin.lng, data.origin.lat]
      : null;

    let originCoords = rawOriginCoords;
    if (craneCoords && rawOriginCoords) {
      const distanceKm = haversineDistanceKm(craneCoords, rawOriginCoords);
      if (distanceKm > MAX_PLAUSIBLE_ORIGIN_DISTANCE_KM) {
        logger.warn('Origen sospechoso: distancia grua-origen supera el umbral, se ignora en el encuadre', {
          distanceKm: Math.round(distanceKm),
        });
        originCoords = null;
      }
    }

    if (data.position && craneCoords) {
      if (!craneMarkerRef.current) {
        const refs = createCraneMarkerElement();
        craneElRefs.current = refs;
        craneMarkerRef.current = new mapboxgl.default.Marker({ element: refs.wrapper, anchor: 'center' })
          .setLngLat(craneCoords)
          .addTo(map);
      } else {
        craneMarkerRef.current.setLngLat(craneCoords);
      }

      if (craneElRefs.current) {
        updateCraneMarkerElement(craneElRefs.current, data.position.heading, data.state === 'active');
      }
    }

    if (originCoords) {
      if (!originMarkerRef.current) {
        const refs = createOriginMarkerElement();
        originElRefs.current = refs;
        originMarkerRef.current = new mapboxgl.default.Marker({ element: refs.anchor, anchor: 'bottom' })
          .setLngLat(originCoords)
          .addTo(map);
      } else {
        originMarkerRef.current.setLngLat(originCoords);
      }

      if (originElRefs.current && data.origin?.text) {
        originElRefs.current.label.textContent = truncateLabel(toTitleCase(data.origin.text));
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
      originElRefs.current = null;
    }

    try {
      if (craneCoords && originCoords) {
        // padding extra abajo/arriba: el bottom sheet y el header flotantes
        // tapan parte del mapa en mobile.
        map.fitBounds(
          [craneCoords, originCoords].reduce(
            (bounds, coord) => bounds.extend(coord),
            new mapboxgl.default.LngLatBounds(craneCoords, craneCoords),
          ),
          { padding: { top: 140, bottom: 260, left: 40, right: 40 }, maxZoom: 15, duration: 0 },
        );
      } else if (craneCoords) {
        map.jumpTo({ center: craneCoords, zoom: DEFAULT_ZOOM });
      } else if (originCoords) {
        // Sin posicion de la grua aun (waiting): centrar en el origen si existe.
        map.jumpTo({ center: originCoords, zoom: DEFAULT_ZOOM });
      }
    } catch (error) {
      logger.warn('No se pudo ajustar el mapa a los marcadores', error);
    }
  }, [data, mapboxReady, styleLoaded]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-warning/10 p-6 text-center text-sm text-warning">
        <TriangleAlert className="size-6" />
        <p>Mapa no disponible en este momento.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!mapboxReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60 text-sm text-muted-foreground">
          Cargando mapa...
        </div>
      )}
    </div>
  );
};

const FullScreenStatus = ({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-muted px-6 text-center">
    <img src={LOGO_SRC} alt={COMPANY_NAME} className="h-9 w-auto opacity-90" />
    {icon}
    <div className="space-y-1.5">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      {subtitle && <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

const NoSignalBanner = () => (
  <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
    <TriangleAlert className="mt-0.5 size-3.5 flex-shrink-0" />
    <span>Sin señal GPS hace unos minutos — la posición puede estar desactualizada</span>
  </div>
);

const CallButton = ({ phone }: { phone?: string | null }) => (
  <Button variant="outline" size="sm" className="w-full gap-2" asChild>
    <a href={toTelHref(phone || DEFAULT_COMPANY_PHONE_E164)}>
      <Phone className="size-4" />
      Llamar a {COMPANY_NAME}
    </a>
  </Button>
);

const EtaHero = ({ data }: { data: TrackingResponse }) => {
  // on_site primero: una vez que la grua llego, el ETA-al-origen cacheado
  // (hasta 60s de antiguedad) queda semanticamente obsoleto y contradice el
  // titulo — "en el lugar" no debe convivir con un numero de minutos.
  if (data.journey_stage === 'on_site') {
    return <p className="text-2xl font-bold leading-tight text-foreground">Tu grúa está en el lugar</p>;
  }

  if (data.eta) {
    return (
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tu grúa llega en
        </p>
        <p className="mt-0.5 text-4xl font-bold leading-none text-foreground">
          {formatDurationLabel(data.eta.seconds)}
        </p>
      </div>
    );
  }

  // Origen no ruteable por Google (zona sin ruta, p. ej. C-13 Termas de Juncal):
  // en vez de "Calculando..." permanente, mostrar la distancia en línea recta
  // grúa->origen para dar contexto útil al cliente.
  if (
    data.position &&
    data.eta_unavailable &&
    data.origin?.lat != null &&
    data.origin?.lng != null
  ) {
    const straightLineKm = haversineDistanceKm(
      [data.position.lng, data.position.lat],
      [data.origin.lng, data.origin.lat],
    );
    const kmLabel = straightLineKm >= 10
      ? Math.round(straightLineKm)
      : Math.round(straightLineKm * 10) / 10;
    return (
      <div>
        <p className="text-2xl font-bold leading-tight text-foreground">
          Tu grúa está a ~{kmLabel} km
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tiempo estimado no disponible en esta zona
        </p>
      </div>
    );
  }

  if (data.position) {
    return <p className="text-lg font-semibold text-muted-foreground">Calculando tiempo de llegada…</p>;
  }

  // Esperando la primera posicion: skeleton en vez de un hueco roto.
  return (
    <div className="space-y-2">
      <div className="h-3 w-28 rounded-full bg-muted motion-safe:animate-pulse" />
      <div className="h-8 w-40 rounded-full bg-muted motion-safe:animate-pulse" />
    </div>
  );
};

const TrackService = () => {
  const { token } = useParams<{ token: string }>();
  const { status, data } = useServiceTrackingPoll(token);
  useTick(RELATIVE_TIME_TICK_MS);

  if (status === 'loading') {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-muted">
        <img src={LOGO_SRC} alt={COMPANY_NAME} className="h-9 w-auto opacity-90" />
        <Loader2 className="size-6 text-primary motion-safe:animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando seguimiento...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <FullScreenStatus
        icon={
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <MapPin className="size-8 text-muted-foreground" />
          </div>
        }
        title="Este enlace ya no está disponible"
        subtitle="El seguimiento se activa solo mientras dura el servicio."
      />
    );
  }

  if (status === 'error' || !data) {
    return (
      <FullScreenStatus
        icon={
          <div className="flex size-16 items-center justify-center rounded-full bg-warning/10">
            <TriangleAlert className="size-8 text-warning" />
          </div>
        }
        title="No se pudo cargar el seguimiento"
        subtitle="Intenta nuevamente en unos segundos."
      />
    );
  }

  if (data.state === 'finished') {
    return (
      <FullScreenStatus
        icon={
          <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="size-9 text-success" />
          </div>
        }
        title="Servicio finalizado"
        subtitle={`Gracias por confiar en ${COMPANY_NAME} · Folio ${data.folio}`}
      />
    );
  }

  const stage = data.journey_stage ?? 'assigned';
  const stageTitle = STAGE_TITLES[stage];
  const relativeLabel = data.position ? formatRelativeShort(data.position.recorded_at, Date.now()) : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-muted">
      <div className="absolute inset-0">
        <TrackingMap data={data} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src={LOGO_SRC} alt={COMPANY_NAME} className="h-7 w-auto" />
              <span className="text-sm font-semibold text-foreground">{COMPANY_NAME}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">Folio {data.folio}</span>
          </div>
          <p className="mt-2 text-base font-semibold text-foreground">{stageTitle}</p>
          {data.state === 'no_signal' && <NoSignalBanner />}
        </div>

        <div className="pointer-events-auto">
          <JourneyStepper stage={stage} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto max-w-md space-y-3 rounded-2xl border border-border bg-card/95 px-4 py-4 shadow-lg backdrop-blur-md">
          <EtaHero data={data} />

          {(data.crane || data.operator_first_name) && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
              {data.crane && (
                <span className="rounded-md border border-border px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-foreground">
                  {data.crane.plate}
                </span>
              )}
              {data.crane && <span>{getCraneTypeLabel(data.crane.type)}</span>}
              {data.operator_first_name && <span>Operador: {data.operator_first_name}</span>}
            </div>
          )}

          {relativeLabel && (
            <p className="text-xs text-muted-foreground">
              Actualizado {relativeLabel}
              {data.eta && ` · ${formatDistanceLabel(data.eta.distance_meters)}`}
            </p>
          )}

          <CallButton phone={data.support_phone} />

          <p className="text-center text-[11px] text-muted-foreground/80">
            {COMPANY_NAME} SpA · {COMPANY_LOCATION}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrackService;
