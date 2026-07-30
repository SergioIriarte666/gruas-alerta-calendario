import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTrackableOperators } from '@/hooks/operators/useTrackableOperators';
import { useOperatorRouteHistory } from '@/hooks/operatorlocations/useOperatorLocations';
import { useMatchedRoutes } from '@/hooks/ubicaciones/useMatchedRoute';
import { useReverseGeocodedLabels, type ReverseGeocodeLabel } from '@/hooks/ubicaciones/useReverseGeocode';
import { Badge } from '@/components/ui/badge';
import { businessClock } from '@/utils/businessClock';
import { cn } from '@/lib/utils';
import {
  SIGNAL_FRESHNESS_BADGE_CLASS,
  describeSignalFreshness,
  type MatchedRouteResult,
  type OperatorRoutePoint,
  type OperatorRouteSession,
} from '@/types/operatorLocations';
import {
  STOP_REASON_LABELS,
  STOP_REASON_MARKER_GLYPH,
  isIncidentStopReason,
  isStopEventOverdue,
  stopEventMinutes,
  type ServiceStopEvent,
} from '@/types/serviceStopEvent';
import { createLogger } from '@/lib/logger';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { resolveThemeColor } from '@/lib/themeColors';
import {
  clusterRouteEndpoints,
  selectClusterLabel,
  type RouteEndpointCandidate,
} from '@/utils/routeEndpointClustering';

const logger = createLogger('RouteHistoryPanel');

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];

const ROUTE_COLOR_TOKENS: Array<`--${string}`> = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
];

// Anchos reactivos al zoom: la ruta se mantiene nítida de lejos y con cuerpo de
// cerca, en vez de un grosor fijo que se ve fino al alejar y grueso al acercar.
const ROUTE_WIDTH = ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 4.5, 18, 6.5];
const ROUTE_CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 10, 5.5, 14, 7.5, 18, 10];
const RAW_DOT_WIDTH = ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 3.5, 18, 5];

// Un hueco de datos se declara sólo cuando coinciden tiempo Y distancia: una
// pausa larga con el equipo quieto no es pérdida de señal, y dos puntos
// distantes seguidos a 30 s de diferencia son sencillamente velocidad.
const DATA_GAP_MIN_MINUTES = 5;
const DATA_GAP_MIN_METERS = 1000;
const EARTH_RADIUS_METERS = 6371000;

interface RouteDataGap {
  from: [number, number];
  to: [number, number];
  minutes: number;
  meters: number;
}

const haversineMeters = (a: OperatorRoutePoint, b: OperatorRoutePoint): number => {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Parte los puntos de una sesión en tramos con datos, separados por los huecos
 * donde la app dejó de reportar.
 *
 * Sin esto, el salto de 23 km sin un solo punto entre Copiapó y Verschae se
 * dibujaba como una recta sólida por el desierto, indistinguible de una ruta
 * realmente recorrida.
 */
const splitRouteOnDataGaps = (
  points: OperatorRoutePoint[],
): { runs: [number, number][][]; gaps: RouteDataGap[] } => {
  const runs: [number, number][][] = [];
  const gaps: RouteDataGap[] = [];
  let current: [number, number][] = [];

  points.forEach((point, index) => {
    const coordinate: [number, number] = [point.longitude, point.latitude];

    if (index === 0) {
      current.push(coordinate);
      return;
    }

    const previous = points[index - 1];
    const minutes = (new Date(point.recorded_at).getTime() - new Date(previous.recorded_at).getTime()) / 60000;
    const meters = haversineMeters(previous, point);

    if (minutes >= DATA_GAP_MIN_MINUTES && meters >= DATA_GAP_MIN_METERS) {
      gaps.push({
        from: [previous.longitude, previous.latitude],
        to: coordinate,
        minutes: Math.round(minutes),
        meters,
      });
      if (current.length > 0) runs.push(current);
      current = [coordinate];
      return;
    }

    current.push(coordinate);
  });

  if (current.length > 0) runs.push(current);

  return { runs, gaps };
};

const STARTED_REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  auto_schedule: 'Automático (jornada)',
  auto_service: 'Automático (servicio)',
};

const ENDED_REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  // El corte con PIN se distingue: hubo un cliente mirando el link cuando se cortó.
  manual_pin: 'Manual (con PIN)',
  manual_confirm: 'Manual (confirmado)',
  service_change: 'Cambio de servicio',
  timeout: 'Timeout',
  schedule_end: 'Fin de jornada',
  service_closed: 'Servicio cerrado',
};

/**
 * Ubica una detención declarada sobre la ruta: el punto GPS más cercano en el
 * tiempo a su inicio. Con el vehículo detenido los puntos son casi idénticos,
 * así que la aproximación es exacta en la práctica.
 */
const locateStopEvents = (
  points: OperatorRoutePoint[],
  stopEvents: ServiceStopEvent[],
): Array<{ event: ServiceStopEvent; lng: number; lat: number }> => {
  if (points.length === 0) return [];

  return stopEvents.flatMap((event) => {
    const startedMs = new Date(event.started_at).getTime();
    let closest = points[0];
    let bestDelta = Math.abs(new Date(closest.recorded_at).getTime() - startedMs);

    for (const point of points) {
      const delta = Math.abs(new Date(point.recorded_at).getTime() - startedMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        closest = point;
      }
    }

    // Sin un punto razonablemente cercano no se inventa una posición.
    if (bestDelta > 30 * 60 * 1000) return [];
    return [{ event, lng: closest.longitude, lat: closest.latitude }];
  });
};

interface RouteMapProps {
  points: OperatorRoutePoint[];
  autoFollow: boolean;
  matchingEnabled: boolean;
  matchedBySession: Map<string, MatchedRouteResult>;
  pointLabels: Map<string, ReverseGeocodeLabel>;
  stopEvents: ServiceStopEvent[];
}

function RouteMap({ points, autoFollow, matchingEnabled, matchedBySession, pointLabels, stopEvents }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const loadedRef = useRef(false);
  const layerIdsRef = useRef<string[]>([]);
  const gapLayerIdsRef = useRef<string[]>([]);
  const boundGapListenersRef = useRef<Set<string>>(new Set());
  const gapPopupRef = useRef<import('mapbox-gl').Popup | null>(null);
  const markersRef = useRef<import('mapbox-gl').Marker[]>([]);
  const mapboxRef = useRef<MapboxModule | null>(null);
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
          zoom: 12,
        });

        localMap.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), 'top-right');
        localMap.on('load', () => {
          loadedRef.current = true;
          setMapboxReady(true);
        });
        mapRef.current = localMap;
      })
      .catch((error) => {
        logger.error('Could not load Mapbox for route history map', error);
      });

    return () => {
      cancelled = true;
      setMapboxReady(false);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      gapPopupRef.current?.remove();
      gapPopupRef.current = null;
      boundGapListenersRef.current.clear();
      localMap?.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  const render = () => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !loadedRef.current) return;

    layerIdsRef.current.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    layerIdsRef.current = [];
    gapLayerIdsRef.current = [];
    gapPopupRef.current?.remove();
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (points.length === 0) return;

    const bySession = new Map<string, OperatorRoutePoint[]>();
    for (const point of points) {
      const group = bySession.get(point.session_id) ?? [];
      group.push(point);
      bySession.set(point.session_id, group);
    }

    const bounds = new mapboxgl.default.LngLatBounds();
    // Contorno claro que separa la ruta de las calles del mapa base (mismo token
    // que ya usan los marcadores de inicio/fin como borde contra el mapa).
    const casingColor = resolveThemeColor(containerRef.current, '--effect-highlight');
    const gapColor = resolveThemeColor(containerRef.current, '--danger');
    const endpointCandidates: RouteEndpointCandidate[] = [];
    let colorIndex = 0;

    for (const [sessionId, sessionPoints] of bySession.entries()) {
      const coordinates = sessionPoints.map((p) => [p.longitude, p.latitude] as [number, number]);
      const color = resolveThemeColor(containerRef.current, ROUTE_COLOR_TOKENS[colorIndex % ROUTE_COLOR_TOKENS.length]);
      colorIndex += 1;

      const addLineLayer = (
        id: string,
        lineStrings: [number, number][][],
        paint: Record<string, unknown>,
      ) => {
        if (lineStrings.length === 0) return;
        map.addSource(id, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: lineStrings.map((coords) => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            })),
          },
        });
        map.addLayer({
          id,
          type: 'line',
          source: id,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint,
        });
        layerIdsRef.current.push(id);
      };

      // Tramo pegado a calles: contorno claro debajo + línea sólida del color de
      // la sesión encima, para que resalte sobre el callejero.
      const drawSolid = (idBase: string, lineStrings: [number, number][][]) => {
        addLineLayer(`${idBase}-casing`, lineStrings, {
          'line-color': casingColor,
          'line-width': ROUTE_CASING_WIDTH,
          'line-opacity': 0.9,
        });
        addLineLayer(idBase, lineStrings, {
          'line-color': color,
          'line-width': ROUTE_WIDTH,
        });
      };

      // Tramo crudo (GPS directo): puntos redondos atenuados, visualmente
      // distintos de la línea sólida sin fingir que sigue una calle.
      const drawRaw = (idBase: string, lineStrings: [number, number][][]) => {
        addLineLayer(idBase, lineStrings, {
          'line-color': color,
          'line-width': RAW_DOT_WIDTH,
          'line-opacity': 0.75,
          'line-dasharray': [0, 2],
        });
      };

      // Hueco de datos: punteado rojo tenue, distinguible tanto de la ruta
      // sólida como del punteado de "camino no mapeado". Aquí la app no
      // reportó; la recta NO es un trayecto verificado.
      const drawDataGaps = (idBase: string, routeGaps: RouteDataGap[]) => {
        if (routeGaps.length === 0) return;
        const id = `${idBase}-gap`;
        map.addSource(id, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: routeGaps.map((gap) => ({
              type: 'Feature',
              properties: {
                label: `Sin datos ${gap.minutes} min · ${(gap.meters / 1000).toFixed(1)} km`,
              },
              geometry: { type: 'LineString', coordinates: [gap.from, gap.to] },
            })),
          },
        });
        // El paint pasa por Record<string, unknown> igual que en addLineLayer:
        // las expresiones de zoom son arrays sueltos que no calzan con el tipo
        // estricto de mapbox-gl.
        const paint: Record<string, unknown> = {
          'line-color': gapColor,
          'line-width': ROUTE_WIDTH,
          'line-opacity': 0.5,
          'line-dasharray': [1.5, 1.5],
        };
        map.addLayer({
          id,
          type: 'line',
          source: id,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint,
        });
        layerIdsRef.current.push(id);
        gapLayerIdsRef.current.push(id);
      };

      const { runs, gaps } = splitRouteOnDataGaps(sessionPoints);
      const matched = matchingEnabled ? matchedBySession.get(sessionId) : undefined;

      if (matched && matched.segments.length > 0) {
        // Render híbrido: tramos matcheados sólidos, tramos crudos punteados.
        const solid = matched.segments
          .filter((segment) => segment.matched)
          .map((segment) => segment.geometry.coordinates);
        const dashed = matched.segments
          .filter((segment) => !segment.matched)
          .map((segment) => segment.geometry.coordinates);

        drawSolid(`route-${sessionId}-matched`, solid);
        drawRaw(`route-${sessionId}-raw`, dashed);
      } else {
        // Toggle OFF, sin matching aún o sin datos → polilínea cruda, cortada
        // en los huecos para no dibujar el salto como recorrido.
        drawSolid(`route-${sessionId}`, runs);
      }

      drawDataGaps(`route-${sessionId}`, gaps);

      coordinates.forEach((coord) => bounds.extend(coord));

      endpointCandidates.push({
        key: `${sessionId}:start`,
        kind: 'start',
        longitude: coordinates[0][0],
        latitude: coordinates[0][1],
        color,
        recordedAt: sessionPoints[0].recorded_at,
        label: pointLabels.get(`${sessionId}:start`),
      });

      if (coordinates.length > 1) {
        endpointCandidates.push({
          key: `${sessionId}:end`,
          kind: 'end',
          longitude: coordinates[coordinates.length - 1][0],
          latitude: coordinates[coordinates.length - 1][1],
          color,
          recordedAt: sessionPoints[sessionPoints.length - 1].recorded_at,
          label: pointLabels.get(`${sessionId}:end`),
        });
      }
    }

    // Una jornada puede abrir y cerrar muchas sesiones en la base. El jitter
    // normal del GPS hacía que cada una dibujara su propio punto y la misma
    // etiqueta una y otra vez. Se agrupan los extremos cercanos en un solo
    // marcador con contador; la tabla inferior conserva el detalle por sesión.
    for (const cluster of clusterRouteEndpoints(endpointCandidates)) {
      const count = cluster.endpoints.length;
      const startCount = cluster.endpoints.filter((endpoint) => endpoint.kind === 'start').length;
      const endCount = count - startCount;
      const label = selectClusterLabel(cluster.endpoints);
      const approximate = label?.source === 'mapbox';
      const firstEndpoint = cluster.endpoints[0];

      const markerEl = document.createElement('div');
      markerEl.style.display = 'flex';
      markerEl.style.alignItems = 'center';
      markerEl.style.justifyContent = 'center';
      markerEl.style.width = count > 1 ? '1.75rem' : '0.875rem';
      markerEl.style.height = count > 1 ? '1.75rem' : '0.875rem';
      markerEl.style.borderRadius = count > 1 || firstEndpoint.kind === 'start' ? '9999px' : '0.125rem';
      markerEl.style.background = count > 1 ? 'hsl(var(--foreground))' : firstEndpoint.color;
      markerEl.style.border = '0.125rem solid hsl(var(--effect-highlight))';
      markerEl.style.boxShadow = count > 1
        ? '0 0.35rem 1rem hsl(var(--overlay) / 0.28)'
        : 'var(--shadow-sm)';
      markerEl.style.color = 'hsl(var(--background))';
      markerEl.style.fontSize = count > 9 ? '0.625rem' : '0.6875rem';
      markerEl.style.fontWeight = '700';
      markerEl.style.lineHeight = '1';
      if (count > 1) markerEl.textContent = String(count);

      const markerContainer = document.createElement('div');
      markerContainer.style.position = 'relative';
      markerContainer.style.width = markerEl.style.width;
      markerContainer.style.height = markerEl.style.height;
      markerContainer.appendChild(markerEl);

      const markerSummary = count > 1
        ? `${count} registros (${startCount} inicios · ${endCount} finales)`
        : firstEndpoint.kind === 'start' ? 'Inicio de sesión' : 'Fin de sesión';
      markerContainer.title = label?.name ? `${label.name} · ${markerSummary}` : markerSummary;

      if (label?.name || count > 1) {
        const labelEl = document.createElement('div');
        const labelName = label?.name
          ? `${approximate ? '≈ ' : ''}${label.name}`
          : 'Mismo punto';
        labelEl.textContent = count > 1 ? `${labelName} · ${count} registros` : labelName;
        labelEl.style.position = 'absolute';
        labelEl.style.left = 'calc(100% + 0.375rem)';
        labelEl.style.top = '50%';
        labelEl.style.transform = 'translateY(-50%)';
        labelEl.style.maxWidth = '13rem';
        labelEl.style.overflow = 'hidden';
        labelEl.style.textOverflow = 'ellipsis';
        labelEl.style.whiteSpace = 'nowrap';
        labelEl.style.padding = '0.125rem 0.4375rem';
        labelEl.style.borderRadius = '0.375rem';
        labelEl.style.fontSize = '0.6875rem';
        labelEl.style.fontWeight = approximate ? '400' : '500';
        labelEl.style.fontStyle = approximate ? 'italic' : 'normal';
        labelEl.style.lineHeight = '1.2';
        labelEl.style.background = 'hsl(var(--popover))';
        labelEl.style.color = approximate
          ? 'hsl(var(--muted-foreground))'
          : 'hsl(var(--popover-foreground))';
        labelEl.style.border = '0.0625rem solid hsl(var(--border))';
        labelEl.style.boxShadow = 'var(--shadow-sm)';
        labelEl.style.pointerEvents = 'none';
        markerContainer.appendChild(labelEl);
      }

      markersRef.current.push(
        new mapboxgl.default.Marker({ element: markerContainer })
          .setLngLat([cluster.longitude, cluster.latitude])
          .addTo(map),
      );
    }

    // Tooltip del hueco: la recta punteada por sí sola no dice cuánto tiempo
    // estuvo sin reportar, que es justo el dato que hay que poder auditar.
    // Instancia única y estable: los listeners se registran una sola vez y
    // capturan este popup, así que no puede recrearse en cada render.
    if (!gapPopupRef.current) {
      gapPopupRef.current = new mapboxgl.default.Popup({ closeButton: false, closeOnClick: false });
    }
    const popup = gapPopupRef.current;

    gapLayerIdsRef.current.forEach((layerId) => {
      // Los ids de capa son estables por sesión y render() vuelve a crearlas en
      // cada cambio: sin este registro, cada render acumularía otro listener.
      if (boundGapListenersRef.current.has(layerId)) return;
      boundGapListenersRef.current.add(layerId);

      map.on('mouseenter', layerId, (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const label = event.features?.[0]?.properties?.label;
        if (!label) return;
        popup.setLngLat(event.lngLat).setText(String(label)).addTo(map);
      });
      map.on('mousemove', layerId, (event) => {
        popup.setLngLat(event.lngLat);
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
    });

    // Marcadores de detención declarada: separan la parada CON motivo del hueco
    // sin explicar, que es la distinción que "Tiempos muertos" necesita.
    for (const { event, lng, lat } of locateStopEvents(points, stopEvents)) {
      const minutes = stopEventMinutes(event, businessClock.now());
      const overdue = isStopEventOverdue(event.reason, minutes);
      // Ruta cortada y falla mecánica no tienen umbral de duración (no existe
      // una duración "normal"), así que jamás se pintarían como excedidas: se
      // marcan como incidente para que no se lean como una parada de rutina.
      const incident = isIncidentStopReason(event.reason);

      const markerEl = document.createElement('div');
      markerEl.style.display = 'flex';
      markerEl.style.alignItems = 'center';
      markerEl.style.justifyContent = 'center';
      markerEl.style.width = '1.5rem';
      markerEl.style.height = '1.5rem';
      markerEl.style.borderRadius = '9999px';
      markerEl.style.fontSize = '0.625rem';
      markerEl.style.fontWeight = '700';
      markerEl.style.color = 'hsl(var(--effect-highlight))';
      markerEl.style.background = incident
        ? 'hsl(var(--danger))'
        : overdue ? 'hsl(var(--warning))' : 'hsl(var(--info))';
      markerEl.style.border = '0.125rem solid hsl(var(--effect-highlight))';
      markerEl.style.boxShadow = 'var(--shadow-sm)';
      markerEl.textContent = STOP_REASON_MARKER_GLYPH[event.reason] ?? 'P';
      markerEl.title = `${STOP_REASON_LABELS[event.reason]} · ${minutes} min · desde ${businessClock.format(event.started_at, 'HH:mm')}`;

      markersRef.current.push(
        new mapboxgl.default.Marker({ element: markerEl }).setLngLat([lng, lat]).addTo(map),
      );
    }

    const lastPoint = points[points.length - 1];

    try {
      if (autoFollow && lastPoint) {
        map.easeTo({
          center: [lastPoint.longitude, lastPoint.latitude],
          zoom: Math.max(map.getZoom(), 15),
          duration: 800,
        });
      } else {
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      }
    } catch (error) {
      logger.warn('Could not update route viewport', error);
    }
  };

  useEffect(() => {
    render();
  }, [autoFollow, mapboxReady, points, matchingEnabled, matchedBySession, pointLabels, stopEvents]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full min-h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-6 text-center text-sm text-warning-text">
        <TriangleAlert className="size-6" />
        <p>Configura VITE_MAPBOX_PUBLIC_TOKEN para ver el mapa de ruta.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-80 w-full">
      <div ref={containerRef} className="h-full min-h-80 w-full rounded-2xl" />
      {!mapboxReady && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-border/20 bg-overlay/35 text-sm text-muted-foreground">
          Cargando mapa de ruta...
        </div>
      )}
    </div>
  );
}

interface RouteHistoryPanelProps {
  initialOperatorId?: string | null;
  initialDate?: string | null;
}

export const RouteHistoryPanel = ({ initialOperatorId, initialDate }: RouteHistoryPanelProps) => {
  const { operators } = useTrackableOperators();
  const [operatorId, setOperatorId] = useState<string | null>(initialOperatorId ?? null);
  const [dateISO, setDateISO] = useState<string>(initialDate ?? businessClock.today());
  const [autoFollow, setAutoFollow] = useState(() => (initialDate ?? businessClock.today()) === businessClock.today());
  const [matchingEnabled, setMatchingEnabled] = useState(true);
  const validOperatorIds = useMemo(() => new Set(operators.map((operator) => operator.id)), [operators]);

  useEffect(() => {
    if (initialOperatorId) setOperatorId(initialOperatorId);
  }, [initialOperatorId]);

  useEffect(() => {
    if (initialDate) setDateISO(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setAutoFollow(dateISO === businessClock.today());
  }, [dateISO]);

  useEffect(() => {
    if (operatorId && !validOperatorIds.has(operatorId)) {
      setOperatorId(null);
    }
  }, [operatorId, validOperatorIds]);

  const { points, sessions, stopEvents, isLoading, error } = useOperatorRouteHistory(operatorId, dateISO);

  const sessionPointCounts = new Map<string, number>();
  for (const point of points) {
    sessionPointCounts.set(point.session_id, (sessionPointCounts.get(point.session_id) ?? 0) + 1);
  }

  // Solo matcheamos sesiones que efectivamente tienen puntos en el rango del día.
  const sessionIds = useMemo(
    () => Array.from(new Set(points.map((point) => point.session_id))),
    [points],
  );
  const { bySession: matchedBySession, isFetching: matchingFetching, allFailed: matchingFailed } =
    useMatchedRoutes(sessionIds, matchingEnabled && sessionIds.length > 0);

  const failureToastedRef = useRef(false);
  useEffect(() => {
    if (matchingFailed && !failureToastedRef.current) {
      failureToastedRef.current = true;
      toast.error('No se pudo ajustar la ruta a las calles. Mostrando GPS crudo.');
    }
    if (!matchingFailed) {
      failureToastedRef.current = false;
    }
  }, [matchingFailed]);

  const hasRawSegments = useMemo(
    () =>
      matchingEnabled &&
      Array.from(matchedBySession.values()).some((result) =>
        result.segments.some((segment) => !segment.matched),
      ),
    [matchingEnabled, matchedBySession],
  );

  // Inicio y fin de cada sesión (puntos ordenados asc): etiquetamos ambos
  // marcadores con su nombre operativo (catálogo) o dirección legible (Mapbox).
  const labelTargets = useMemo(() => {
    const firstBySession = new Map<string, OperatorRoutePoint>();
    const lastBySession = new Map<string, OperatorRoutePoint>();
    for (const point of points) {
      if (!firstBySession.has(point.session_id)) firstBySession.set(point.session_id, point);
      lastBySession.set(point.session_id, point);
    }
    const targets: { key: string; lng: number; lat: number }[] = [];
    for (const [sessionId, point] of firstBySession) {
      targets.push({ key: `${sessionId}:start`, lng: point.longitude, lat: point.latitude });
    }
    for (const [sessionId, point] of lastBySession) {
      targets.push({ key: `${sessionId}:end`, lng: point.longitude, lat: point.latitude });
    }
    return targets;
  }, [points]);
  const pointLabels = useReverseGeocodedLabels(labelTargets, labelTargets.length > 0);

  // Frescura del último punto del día seleccionado. El botón "Siguiendo ruta en
  // vivo" se pintaba verde aunque el último punto tuviera 93 minutos: seguir un
  // punto viejo no es seguir en vivo, y ahora el estado lo dice.
  const lastPointAt = points.length > 0 ? points[points.length - 1].recorded_at : null;
  const freshness = describeSignalFreshness(lastPointAt);
  const isToday = dateISO === businessClock.today();
  const isLive = isToday && freshness.level === 'live';

  const hasDataGaps = useMemo(() => {
    const bySession = new Map<string, OperatorRoutePoint[]>();
    for (const point of points) {
      const group = bySession.get(point.session_id) ?? [];
      group.push(point);
      bySession.set(point.session_id, group);
    }
    return Array.from(bySession.values()).some((sessionPoints) => splitRouteOnDataGaps(sessionPoints).gaps.length > 0);
  }, [points]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={operatorId ?? undefined} onValueChange={setOperatorId}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Selecciona un operador" />
          </SelectTrigger>
          <SelectContent>
            {operators.map((operator) => (
              <SelectItem key={operator.id} value={operator.id}>
                {operator.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePickerInput
          value={dateISO}
          onChange={setDateISO}
          className="w-full sm:w-48"
        />

        <Button
          type="button"
          // Sólo se pinta como acción activa cuando el dato ES fresco; con señal
          // vieja queda en outline para no vender "en vivo" lo que no lo es.
          variant={autoFollow && isLive ? 'default' : 'outline'}
          className="w-full sm:w-auto"
          onClick={() => setAutoFollow((current) => !current)}
        >
          <LocateFixed className="size-4" />
          {autoFollow ? 'Siguiendo último punto' : 'Seguir último punto'}
        </Button>

        {operatorId && (
          <Badge
            variant="outline"
            className={cn('h-9 rounded-full px-3 text-xs font-semibold', SIGNAL_FRESHNESS_BADGE_CLASS[freshness.level])}
          >
            {freshness.label}
            {freshness.atLabel && freshness.level !== 'lost' ? ` · ${freshness.atLabel}` : ''}
          </Badge>
        )}

        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch
            id="matched-route-toggle"
            checked={matchingEnabled}
            onCheckedChange={setMatchingEnabled}
          />
          <Label htmlFor="matched-route-toggle" className="cursor-pointer text-sm">
            Ruta ajustada a calles
          </Label>
        </div>
      </div>

      {operatorId && (
        <p className="text-sm text-muted-foreground">
          {autoFollow
            ? 'El mapa se recentra automáticamente en el último punto recibido.'
            : 'El mapa queda libre para que revises la ruta sin recentrado automático.'}
        </p>
      )}

      {!operatorId && (
        <p className="resources-panel p-6 text-center text-sm text-muted-foreground">
          Selecciona un operador para ver su historial de ruta
        </p>
      )}

      {operatorId && error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error instanceof Error ? error.message : 'No se pudo cargar el historial'}
        </p>
      )}

      {operatorId && !error && (
        <>
          <div className="resources-panel h-96 overflow-hidden">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Cargando ruta...</div>
            ) : (
              <RouteMap
                points={points}
                autoFollow={autoFollow}
                matchingEnabled={matchingEnabled}
                matchedBySession={matchedBySession}
                pointLabels={pointLabels}
                stopEvents={stopEvents}
              />
            )}
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            {matchingEnabled && (
              <p>
                {matchingFetching
                  ? 'Ajustando ruta a las calles… mientras tanto se muestra el GPS crudo.'
                  : hasRawSegments
                    ? 'Tramo punteado: GPS directo (camino no mapeado).'
                    : 'Ruta ajustada a la red vial.'}
              </p>
            )}
            {hasDataGaps && (
              <p className="text-danger">
                Tramo punteado rojo: sin datos. La app no reportó en ese trecho — la recta no es un recorrido verificado.
              </p>
            )}
          </div>

          <div className="resources-panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Motivo inicio</TableHead>
                  <TableHead>Motivo fin</TableHead>
                  <TableHead className="text-right"># Puntos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Sin sesiones ese día
                    </TableCell>
                  </TableRow>
                )}
                {sessions.map((session: OperatorRouteSession) => (
                  <TableRow key={session.id}>
                    <TableCell>{businessClock.format(session.started_at, 'HH:mm')}</TableCell>
                    <TableCell>{session.ended_at ? businessClock.format(session.ended_at, 'HH:mm') : '—'}</TableCell>
                    <TableCell>{STARTED_REASON_LABELS[session.started_reason] ?? session.started_reason}</TableCell>
                    <TableCell>
                      {session.ended_reason ? ENDED_REASON_LABELS[session.ended_reason] ?? session.ended_reason : '—'}
                    </TableCell>
                    <TableCell className="text-right">{sessionPointCounts.get(session.id) ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {stopEvents.length > 0 && (
            <div className="resources-panel overflow-x-auto">
              <p className="px-4 pt-3 text-sm font-semibold text-foreground">Detenciones declaradas</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead className="text-right">Duración</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stopEvents.map((event) => {
                    const minutes = stopEventMinutes(event, businessClock.now());
                    // Sobrepasar lo típico del motivo es señal de posible
                    // anomalía, no una infracción: el descanso nunca alerta.
                    const overdue = isStopEventOverdue(event.reason, minutes);
                    return (
                      <TableRow key={event.id}>
                        <TableCell>{businessClock.format(event.started_at, 'HH:mm')}</TableCell>
                        <TableCell>{event.ended_at ? businessClock.format(event.ended_at, 'HH:mm') : 'En curso'}</TableCell>
                        <TableCell>{STOP_REASON_LABELS[event.reason]}</TableCell>
                        <TableCell>
                          {event.ended_by_source === 'auto_speed'
                            ? 'Automático (rodando)'
                            : event.ended_by_source === 'service_closed'
                              ? 'Servicio cerrado'
                              : event.ended_by_source === 'manual'
                                ? 'Manual'
                                : '—'}
                        </TableCell>
                        <TableCell className={cn('text-right font-medium', overdue && 'text-warning')}>
                          {minutes} min
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
