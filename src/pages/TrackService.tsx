import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MapPin, TriangleAlert } from 'lucide-react';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import { formatMinutesAgo } from '@/types/operatorLocations';
import { getCraneTypeLabel } from '@/utils/craneType';
import { cn } from '@/lib/utils';

const logger = createLogger('PublicTracking');

const POLL_INTERVAL_MS = 15000;
const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const DEFAULT_ZOOM = 13;
// Distancia grua-origen mas alla de la cual el dato de origen se considera
// sospechoso (p.ej. geocoding de baja calidad que devolvio un centroide lejano)
// y se ignora en el encuadre del mapa.
const MAX_PLAUSIBLE_ORIGIN_DISTANCE_KM = 300;

const EARTH_RADIUS_KM = 6371;

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

  refs.ring.style.backgroundColor = isActive ? 'hsl(var(--primary))' : 'transparent';
  refs.ring.style.animation = isActive ? 'tm-pulse-ring 2s ease-out infinite' : 'none';
};

const ORIGIN_LABEL_MAX_CHARS = 20;

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
  pin.innerHTML = `<svg width="32" height="40" viewBox="0 0 24 24" fill="hsl(var(--warning))" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(15,23,42,0.35));">${MAP_PIN_ICON_PATH}</svg>`;

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
const ROUTE_LAYER_ID = 'tm-route-layer';
const DEFAULT_ROUTE_COLOR = '#8b5cf6';

const resolvePrimaryColor = (): string => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  return raw ? `hsl(${raw})` : DEFAULT_ROUTE_COLOR;
};

const formatEtaLabel = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `Tu grúa llega en ~${minutes} min`;
};

type JourneyStage = 'assigned' | 'en_route' | 'on_site' | 'towing' | 'finished';

const JOURNEY_STEPS: { key: JourneyStage; label: string }[] = [
  { key: 'assigned', label: 'Asignado' },
  { key: 'en_route', label: 'En camino' },
  { key: 'on_site', label: 'En el lugar' },
  { key: 'towing', label: 'Trasladando' },
  { key: 'finished', label: 'Finalizado' },
];

const JourneyStepper = ({ stage }: { stage: JourneyStage }) => {
  const currentIndex = JOURNEY_STEPS.findIndex((step) => step.key === stage);

  return (
    <div className="flex items-center gap-1 border-b border-zinc-200 bg-white px-3 py-3">
      {JOURNEY_STEPS.map((step, index) => {
        const isDone = currentIndex >= 0 && index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'size-2.5 rounded-full transition-colors',
                  isCurrent ? 'bg-cyan-600 ring-4 ring-cyan-100' : isDone ? 'bg-cyan-600' : 'bg-zinc-300',
                )}
              />
              <span
                className={cn(
                  'text-center text-[10px] font-medium leading-tight',
                  isCurrent ? 'text-cyan-700' : 'text-zinc-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < JOURNEY_STEPS.length - 1 && (
              <div className={cn('mx-1 h-0.5 flex-1', isDone ? 'bg-cyan-600' : 'bg-zinc-200')} />
            )}
          </div>
        );
      })}
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

    // Linea de ruta hasta el origen: bajo los marcadores por defecto, ya que
    // estos son elementos DOM (Marker), no layers del mapa GL.
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
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': resolvePrimaryColor(), 'line-width': 4 },
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
        originElRefs.current.label.textContent = truncateLabel(data.origin.text);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
      originElRefs.current = null;
    }

    try {
      if (craneCoords && originCoords) {
        const bounds = new mapboxgl.default.LngLatBounds();
        bounds.extend(craneCoords);
        bounds.extend(originCoords);
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 0 });
      } else if (craneCoords) {
        map.jumpTo({ center: craneCoords, zoom: DEFAULT_ZOOM });
      }
    } catch (error) {
      logger.warn('No se pudo ajustar el mapa a los marcadores', error);
    }
  }, [data, mapboxReady, styleLoaded]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-center text-sm text-amber-700">
        <TriangleAlert className="size-6" />
        <p>Mapa no disponible en este momento.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[280px] w-full">
      <div ref={containerRef} className="h-full min-h-[280px] w-full" />
      {!mapboxReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-zinc-500">
          Cargando mapa...
        </div>
      )}
    </div>
  );
};

const StatusMessage = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-zinc-50 p-6 text-center">
    <MapPin className="size-8 text-zinc-400" />
    <p className="text-base font-semibold text-zinc-800">{title}</p>
    {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
  </div>
);

const TrackService = () => {
  const { token } = useParams<{ token: string }>();
  const { status, data } = useServiceTrackingPoll(token);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50">
        <Loader2 className="size-8 animate-spin text-cyan-600" />
        <p className="text-sm text-zinc-500">Cargando seguimiento...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return <StatusMessage title="Link inválido o expirado" subtitle="Solicita un nuevo link de seguimiento." />;
  }

  if (status === 'error' || !data) {
    return <StatusMessage title="No se pudo cargar el seguimiento" subtitle="Intenta nuevamente en unos segundos." />;
  }

  if (data.state === 'finished') {
    return (
      <StatusMessage
        title="Servicio finalizado — gracias por confiar en nosotros"
        subtitle={`Folio ${data.folio}`}
      />
    );
  }

  const headerLabel = data.state === 'waiting'
    ? 'Estamos preparando tu servicio'
    : data.state === 'no_signal'
      ? 'Última posición conocida'
      : 'Tu grúa va en camino';

  const timestampLabel = data.position ? formatMinutesAgo(data.position.recorded_at, businessClock.now()) : null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-base font-semibold text-zinc-900">{headerLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
          <span>Folio {data.folio}</span>
          {data.crane && (
            <span>
              {data.crane.plate} · {getCraneTypeLabel(data.crane.type)}
            </span>
          )}
          {data.operator_first_name && <span>Operador: {data.operator_first_name}</span>}
        </div>
        {data.eta && (
          <p className="mt-2 text-sm font-semibold text-cyan-700">{formatEtaLabel(data.eta.seconds)}</p>
        )}
        {timestampLabel && (
          <p className="mt-1 text-xs text-zinc-400">
            {data.state === 'no_signal' ? `Última posición conocida ${timestampLabel}` : `Actualizado ${timestampLabel}`}
          </p>
        )}
      </div>

      <JourneyStepper stage={data.journey_stage ?? 'assigned'} />

      <div className="flex-1">
        {data.state === 'waiting' ? (
          <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center text-sm text-zinc-500">
            Estamos preparando tu servicio. El mapa se activará apenas la grúa inicie el trayecto.
          </div>
        ) : (
          <TrackingMap data={data} />
        )}
      </div>
    </div>
  );
};

export default TrackService;
