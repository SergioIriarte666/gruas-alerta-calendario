import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import {
  Crosshair,
  Gauge,
  Loader2,
  MapPin,
  Maximize2,
  Navigation,
  TriangleAlert,
  X,
} from 'lucide-react';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  checkLocationPermission,
  getCurrentLocationPoint,
} from '@/services/operatorLocationService';
import type { OperatorLocationPoint } from '@/types/operatorLocation';

const logger = createLogger('OperatorDrivePanel');

const MAPBOX_WEB_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const MAPBOX_MOBILE_TOKEN = import.meta.env.VITE_MAPBOX_MOBILE_TOKEN as string | undefined;
const IS_NATIVE_PLATFORM = Capacitor.isNativePlatform();
const USE_NATIVE_RESOURCE_PROXY = IS_NATIVE_PLATFORM && !MAPBOX_MOBILE_TOKEN;
const MAPBOX_TOKEN = IS_NATIVE_PLATFORM
  ? (MAPBOX_MOBILE_TOKEN || MAPBOX_WEB_TOKEN)
  : MAPBOX_WEB_TOKEN;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];
const DEFAULT_ZOOM = 15.5;
const MAP_LOAD_TIMEOUT_MS = 15000;
const SPEEDOMETER_MAX_KMH = 120;
const LOGO_SRC = '/logo-gruas-5-norte.png';
const PROXYABLE_MAPBOX_RESOURCE_TYPES = new Set([
  'Style',
  'Source',
  'Tile',
  'Glyphs',
  'SpriteImage',
  'SpriteJSON',
  'Image',
]);

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
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [previewPoint, setPreviewPoint] = useState<OperatorLocationPoint | null>(null);
  const displayPoint = point ?? previewPoint;

  const { speedKmh, gaugeProgress, needleRotation } = getSpeedometerState(
    displayPoint?.speedMps ?? null,
  );
  const accuracyLabel = typeof displayPoint?.accuracyMeters === 'number'
    ? `Precisión ±${Math.round(displayPoint.accuracyMeters)} m`
    : 'Esperando precisión GPS';

  const coordinates = useMemo<[number, number] | null>(() => {
    if (!displayPoint) return null;
    return [displayPoint.longitude, displayPoint.latitude];
  }, [displayPoint]);

  useEffect(() => {
    if (point) return;

    let cancelled = false;

    // Mostrar la posición del dispositivo no debe depender de que exista una
    // sesión de transmisión. Esta lectura es sólo local y no se guarda ni se
    // envía al servidor.
    void checkLocationPermission()
      .then((permission) => {
        if (permission !== 'granted') return null;
        return getCurrentLocationPoint();
      })
      .then((currentPoint) => {
        if (!cancelled && currentPoint) setPreviewPoint(currentPoint);
      })
      .catch((error) => {
        logger.warn('Could not read the current position for the operator map', error);
      });

    return () => {
      cancelled = true;
    };
  }, [point]);

  useEffect(() => {
    // Al alternar entre la tarjeta y pantalla completa se crea un canvas nuevo
    // en su tamaño final. WKWebView puede dejar transparente un contexto WebGL
    // que cambia bruscamente de una columna pequeña a todo el viewport, aunque
    // los Marker y controles DOM de Mapbox sigan visibles.
    setMapReady(false);
    setMapError(false);

    if (!containerRef.current || !MAPBOX_TOKEN) return;

    let cancelled = false;
    let localMap: import('mapbox-gl').Map | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let loadTimeout: number | null = null;
    let ready = false;

    void (async () => {
      let nativeAccessToken: string | null = null;
      if (USE_NATIVE_RESOURCE_PROXY) {
        const { data: authData } = await supabase.auth.getSession();
        nativeAccessToken = authData.session?.access_token ?? null;
        if (!nativeAccessToken) {
          throw new Error('No active operator session for the interactive map');
        }
      }

      const mapboxgl = await loadMapbox();
      if (cancelled || !containerRef.current) return;

      mapboxRef.current = mapboxgl;
      mapboxgl.default.accessToken = MAPBOX_TOKEN;
      localMap = new mapboxgl.default.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: coordinates ?? COPIAPO_CENTER,
        zoom: coordinates ? DEFAULT_ZOOM : 12,
        attributionControl: false,
        transformRequest: USE_NATIVE_RESOURCE_PROXY && nativeAccessToken
          ? (url, resourceType) => {
              if (!PROXYABLE_MAPBOX_RESOURCE_TYPES.has(resourceType)) return { url };

              try {
                const upstreamUrl = new URL(url);
                const isMapboxResourceHost =
                  upstreamUrl.hostname === 'api.mapbox.com' ||
                  /^[a-d]\.tiles\.mapbox\.com$/.test(upstreamUrl.hostname);
                if (upstreamUrl.protocol !== 'https:' || !isMapboxResourceHost) {
                  return { url };
                }
                upstreamUrl.searchParams.delete('access_token');

                return {
                  url: `${SUPABASE_URL}/functions/v1/mapbox-proxy?resource_url=${encodeURIComponent(upstreamUrl.toString())}`,
                  headers: {
                    apikey: SUPABASE_PUBLISHABLE_KEY,
                    Authorization: `Bearer ${nativeAccessToken}`,
                  },
                };
              } catch {
                return { url };
              }
            }
          : undefined,
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

      const markMapReady = () => {
        if (cancelled || ready) return;
        ready = true;
        if (loadTimeout !== null) {
          window.clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        localMap?.resize();
        localMap?.triggerRepaint();
        setMapError(false);
        setMapReady(true);

        // Segundo frame: iOS ya aplicó el ancho definitivo de la columna.
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          localMap?.resize();
          localMap?.triggerRepaint();
        });
      };

      localMap.on('load', markMapReady);
      localMap.on('style.load', markMapReady);
      localMap.on('error', (event) => {
        logger.warn('Mapbox reported an operator map error', event.error);
      });
      mapRef.current = localMap;

      // En WKWebView un estilo servido desde caché puede terminar de cargar
      // antes de que React alcance a registrar el listener de `load`.
      if (localMap.loaded() || localMap.isStyleLoaded()) {
        markMapReady();
      } else {
        loadTimeout = window.setTimeout(() => {
          if (cancelled || ready) return;
          loadTimeout = null;
          logger.error('Operator map did not finish loading before timeout');
          setMapError(true);
        }, MAP_LOAD_TIMEOUT_MS);
      }
    })()
      .catch((error) => {
        logger.error('Could not load the operator position map', error);
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
      if (loadTimeout !== null) window.clearTimeout(loadTimeout);
      markerRef.current?.remove();
      markerRef.current = null;
      markerHeadingRef.current = null;
      resizeObserver?.disconnect();
      localMap?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
    };
    // Los puntos posteriores se procesan abajo. Sólo se recrea el mapa cuando
    // cambia de superficie compacta a ampliada (o viceversa).
  }, [isMapExpanded]);

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
      const heading = displayPoint?.headingDegrees;
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
  }, [coordinates, displayPoint?.headingDegrees, mapReady]);

  useEffect(() => {
    if (!isMapExpanded) return;

    document.body.classList.add('operator-map-expanded');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMapExpanded(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('operator-map-expanded');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapExpanded]);

  const recenter = () => {
    if (!coordinates || !mapRef.current) return;
    followPositionRef.current = true;
    setIsFollowing(true);
    mapRef.current.easeTo({ center: coordinates, zoom: DEFAULT_ZOOM, duration: 700 });
  };

  const expandMap = () => {
    followPositionRef.current = true;
    setIsFollowing(true);
    setIsMapExpanded(true);
  };

  const renderMapSurface = (expanded: boolean) => (
    <div
      className={cn('operator-drive-map', expanded && 'operator-drive-map--expanded')}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'Mapa ampliado de mi posición' : undefined}
    >
      {MAPBOX_TOKEN && !mapError ? (
        <>
          <div ref={containerRef} className="absolute inset-0" aria-label="Mapa de mi posición" />
          {!mapReady && (
            <div className="operator-drive-map__overlay">
              <Loader2 className="size-5 animate-spin" />
              Cargando mapa
            </div>
          )}
          {mapReady && !displayPoint && (
            <div className="operator-drive-map__message">
              <MapPin className="size-5" />
              <span>
                {isTracking
                  ? 'Obteniendo tu primera posición…'
                  : 'Activa la ubicación o la transmisión para ver tu posición'}
              </span>
            </div>
          )}
          {mapReady && !expanded && (
            <button
              type="button"
              onClick={expandMap}
              className="operator-drive-map__expand"
              aria-label="Abrir mapa en pantalla completa"
            >
              <span>
                <Maximize2 className="size-4" />
                Ampliar
              </span>
            </button>
          )}
          {expanded && (
            <div className="operator-drive-map__expanded-toolbar">
              <div>
                <p className="operator-native-eyebrow">Navegación en vivo</p>
                <p className="mt-1 flex items-center gap-2 font-bold text-foreground">
                  <Navigation className="size-4 text-primary" />
                  Mi posición
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMapExpanded(false)}
                aria-label="Cerrar mapa ampliado"
              >
                <X className="size-5" />
              </button>
            </div>
          )}
          {expanded && (
            <div className="operator-drive-map__expanded-speed" aria-live="polite">
              <strong>{speedKmh}</strong>
              <span>km/h</span>
              <small>{accuracyLabel}</small>
            </div>
          )}
          {displayPoint && expanded && (
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
  );

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
        {isMapExpanded
          ? createPortal(renderMapSurface(true), document.body)
          : renderMapSurface(false)}

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
