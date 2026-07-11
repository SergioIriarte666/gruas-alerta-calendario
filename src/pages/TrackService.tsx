import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MapPin, TriangleAlert } from 'lucide-react';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import { formatMinutesAgo } from '@/types/operatorLocations';
import { getCraneTypeLabel } from '@/utils/craneType';

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

    const poll = async () => {
      if (document.hidden) return;
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
      } catch (error) {
        if (cancelled) return;
        logger.warn('No se pudo obtener el estado de seguimiento', error);
        setStatus((prev) => (prev === 'ready' ? prev : 'error'));
      }
    };

    void poll();
    intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
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
  const originMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const [mapboxReady, setMapboxReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

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
        mapRef.current = localMap;
        setMapboxReady(true);
      })
      .catch((error) => {
        logger.error('No se pudo cargar el mapa', error);
      });

    return () => {
      cancelled = true;
      setMapboxReady(false);
      craneMarkerRef.current?.remove();
      originMarkerRef.current?.remove();
      localMap?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapboxReady) return;

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

    if (data.position) {
      const coords: [number, number] = [data.position.lng, data.position.lat];
      if (!craneMarkerRef.current) {
        const el = document.createElement('div');
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.borderRadius = '9999px';
        el.style.backgroundColor = '#0891b2';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 4px 10px rgba(15,23,42,0.4)';
        el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L20 20 L12 16 L4 20 Z"/></svg>';
        craneMarkerRef.current = new mapboxgl.default.Marker({ element: el }).setLngLat(coords).addTo(map);
      } else {
        craneMarkerRef.current.setLngLat(coords);
      }
      const el = craneMarkerRef.current.getElement();
      const icon = el.querySelector('svg') as SVGElement | null;
      if (icon && typeof data.position.heading === 'number') {
        icon.style.transform = `rotate(${data.position.heading}deg)`;
      }
    }

    if (originCoords) {
      if (!originMarkerRef.current) {
        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '9999px';
        el.style.backgroundColor = '#f59e0b';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 6px rgba(15,23,42,0.35)';
        originMarkerRef.current = new mapboxgl.default.Marker({ element: el }).setLngLat(originCoords).addTo(map);
      } else {
        originMarkerRef.current.setLngLat(originCoords);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
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
  }, [data, mapboxReady]);

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
    return <StatusMessage title="Servicio finalizado" subtitle={`Folio ${data.folio}`} />;
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
        {timestampLabel && (
          <p className="mt-1 text-xs text-zinc-400">
            {data.state === 'no_signal' ? `Última posición conocida ${timestampLabel}` : `Actualizado ${timestampLabel}`}
          </p>
        )}
      </div>

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
