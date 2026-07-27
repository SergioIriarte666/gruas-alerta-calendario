import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Gauge, Loader2, MapPin, Navigation, TriangleAlert } from 'lucide-react';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { OperatorLocationPoint } from '@/types/operatorLocation';

const logger = createLogger('OperatorDrivePanel');

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];
const DEFAULT_ZOOM = 15.5;
const SPEEDOMETER_MAX_KMH = 120;
const LOGO_SRC = '/logo-gruas-5-norte.png';

interface OperatorDrivePanelProps {
  isTracking: boolean;
  point: OperatorLocationPoint | null;
}

export const speedMpsToKmh = (speedMps: number | null): number | null => {
  if (typeof speedMps !== 'number' || !Number.isFinite(speedMps) || speedMps < 0) return null;
  return Math.round(speedMps * 3.6);
};

export const getSpeedometerState = (speedMps: number | null) => {
  const speedKmh = speedMpsToKmh(speedMps) ?? 0;
  const gaugeSpeed = Math.min(speedKmh, SPEEDOMETER_MAX_KMH);
  const gaugeProgress = gaugeSpeed / SPEEDOMETER_MAX_KMH;

  return {
    speedKmh,
    gaugeProgress,
    // Semicírculo clásico: 0 apunta a la izquierda, 60 arriba y 120 a la derecha.
    needleRotation: -90 + gaugeProgress * 180,
  };
};

const createOperatorMarker = () => {
  const element = document.createElement('div');
  element.className = 'operator-drive-marker';
  element.setAttribute('aria-label', 'Mi posición');

  const heading = document.createElement('div');
  heading.className = 'operator-drive-marker__heading';
  heading.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 19 20l-7-4.2L5 20 12 2.8Z"/></svg>';

  const disc = document.createElement('div');
  disc.className = 'operator-drive-marker__disc';

  const logo = document.createElement('img');
  logo.src = LOGO_SRC;
  logo.alt = '';
  logo.decoding = 'async';
  disc.appendChild(logo);

  element.appendChild(heading);
  element.appendChild(disc);

  return { element, heading };
};

export const OperatorDrivePanel = ({ isTracking, point }: OperatorDrivePanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const mapboxRef = useRef<MapboxModule | null>(null);
  const markerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const markerHeadingRef = useRef<HTMLDivElement | null>(null);
  const followPositionRef = useRef(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);

  const { speedKmh, gaugeProgress, needleRotation } = getSpeedometerState(
    point?.speedMps ?? null,
  );
  const accuracyLabel = typeof point?.accuracyMeters === 'number'
    ? `Precisión ±${Math.round(point.accuracyMeters)} m`
    : 'Esperando precisión GPS';

  const coordinates = useMemo<[number, number] | null>(() => {
    if (!point) return null;
    return [point.longitude, point.latitude];
  }, [point]);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    let cancelled = false;
    let localMap: import('mapbox-gl').Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void loadMapbox()
      .then((mapboxgl) => {
        if (cancelled || !containerRef.current) return;

        mapboxRef.current = mapboxgl;
        mapboxgl.default.accessToken = MAPBOX_TOKEN;
        localMap = new mapboxgl.default.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: coordinates ?? COPIAPO_CENTER,
          zoom: coordinates ? DEFAULT_ZOOM : 12,
          attributionControl: false,
        });
        localMap.addControl(
          new mapboxgl.default.AttributionControl({ compact: true }),
          'bottom-right',
        );

        // En WKWebView el grid termina de medir sus columnas después de que
        // Mapbox crea el canvas. Sin un resize explícito el mapa conserva el
        // tamaño inicial (a veces 0 px) y queda como un panel negro aunque el
        // estilo haya cargado correctamente.
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            localMap?.resize();
          });
          resizeObserver.observe(containerRef.current);
        }

        localMap.on('dragstart', () => {
          followPositionRef.current = false;
          setIsFollowing(false);
        });
        localMap.on('load', () => {
          if (cancelled) return;
          localMap?.resize();
          localMap?.triggerRepaint();
          setMapReady(true);

          // Segundo frame: iOS ya aplicó el ancho definitivo de la columna.
          window.requestAnimationFrame(() => {
            if (cancelled) return;
            localMap?.resize();
            localMap?.triggerRepaint();
          });
        });
        localMap.on('error', (event) => {
          logger.warn('Mapbox reported an operator map error', event.error);
        });
        mapRef.current = localMap;
      })
      .catch((error) => {
        logger.error('Could not load the operator position map', error);
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      markerHeadingRef.current = null;
      resizeObserver?.disconnect();
      localMap?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
    };
    // El mapa se monta una sola vez; los puntos posteriores se procesan abajo.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReady || !coordinates) return;

    map.resize();

    if (!markerRef.current) {
      const markerParts = createOperatorMarker();
      markerHeadingRef.current = markerParts.heading;
      markerRef.current = new mapboxgl.default.Marker({
        element: markerParts.element,
        anchor: 'center',
      })
        .setLngLat(coordinates)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(coordinates);
    }

    if (markerHeadingRef.current) {
      const heading = point?.headingDegrees;
      markerHeadingRef.current.style.display = typeof heading === 'number' ? 'block' : 'none';
      markerHeadingRef.current.style.transform = `rotate(${heading ?? 0}deg)`;
    }

    if (followPositionRef.current) {
      map.easeTo({
        center: coordinates,
        zoom: Math.max(map.getZoom(), DEFAULT_ZOOM),
        duration: 650,
      });
    }
  }, [coordinates, mapReady, point?.headingDegrees]);

  const recenter = () => {
    if (!coordinates || !mapRef.current) return;
    followPositionRef.current = true;
    setIsFollowing(true);
    mapRef.current.easeTo({ center: coordinates, zoom: DEFAULT_ZOOM, duration: 700 });
  };

  return (
    <section
      className="operator-drive-panel"
      aria-label="Mi posición y velocidad"
    >
      <div className="operator-drive-panel__header">
        <div>
          <p className="operator-native-eyebrow">Navegación en vivo</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-foreground">
            <Navigation className="size-4 text-primary" />
            Mi posición
          </h3>
        </div>
        <span
          className={cn(
            'operator-drive-panel__live-pill',
            isTracking && point ? 'is-live' : 'is-waiting',
          )}
        >
          <span aria-hidden="true" />
          {isTracking ? (point ? 'GPS activo' : 'Buscando GPS') : 'GPS en espera'}
        </span>
      </div>

      <div className="operator-drive-panel__body">
        <div className="operator-drive-map">
          {MAPBOX_TOKEN && !mapError ? (
            <>
              <div ref={containerRef} className="absolute inset-0" aria-label="Mapa de mi posición" />
              {!mapReady && (
                <div className="operator-drive-map__overlay">
                  <Loader2 className="size-5 animate-spin" />
                  Cargando mapa
                </div>
              )}
              {mapReady && !point && (
                <div className="operator-drive-map__message">
                  <MapPin className="size-5" />
                  <span>
                    {isTracking
                      ? 'Obteniendo tu primera posición…'
                      : 'Enciende la transmisión para ver tu posición'}
                  </span>
                </div>
              )}
              {point && (
                <button
                  type="button"
                  onClick={recenter}
                  className={cn('operator-drive-map__recenter', isFollowing && 'is-active')}
                  aria-label="Centrar mapa en mi posición"
                >
                  <Crosshair className="size-4" />
                </button>
              )}
            </>
          ) : (
            <div className="operator-drive-map__overlay text-warning">
              <TriangleAlert className="size-5" />
              Mapa no disponible
            </div>
          )}
        </div>

        <div className="operator-speedometer">
          <div className="operator-speedometer__title">
            <Gauge className="size-4" />
            Velocidad GPS
          </div>

          <div className="operator-speedometer__dial" aria-label={`${speedKmh ?? 0} kilómetros por hora`}>
            <svg viewBox="0 0 220 150" role="img" aria-hidden="true">
              <path className="operator-speedometer__track" d="M30 125 A80 80 0 0 1 190 125" pathLength="100" />
              {gaugeProgress > 0 && (
                <path
                  className="operator-speedometer__progress"
                  d="M30 125 A80 80 0 0 1 190 125"
                  pathLength="100"
                  style={{ strokeDasharray: `${gaugeProgress * 100} 100` }}
                />
              )}
              <g
                className="operator-speedometer__needle"
                // SVG necesita el pivote explícito. Con transform CSS, WebKit
                // rotaba el grupo sobre su propia caja y la aguja quedaba
                // flotando lejos del eje central.
                transform={`rotate(${needleRotation} 110 125)`}
              >
                <path d="M105.5 125 L110 61 L114.5 125 Z" />
              </g>
              <circle className="operator-speedometer__hub" cx="110" cy="125" r="8" />
              <text className="operator-speedometer__zero" x="20" y="147">0</text>
              <text className="operator-speedometer__max" x="178" y="147">120</text>
            </svg>
          </div>

          <div className="operator-speedometer__reading" aria-live="polite">
            <strong>{speedKmh}</strong>
            <span>km/h</span>
          </div>

          <p className="operator-speedometer__accuracy">{accuracyLabel}</p>
        </div>
      </div>
    </section>
  );
};
