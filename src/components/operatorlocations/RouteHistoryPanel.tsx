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
import { businessClock } from '@/utils/businessClock';
import type {
  MatchedRouteResult,
  OperatorRoutePoint,
  OperatorRouteSession,
} from '@/types/operatorLocations';
import { createLogger } from '@/lib/logger';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { resolveThemeColor } from '@/lib/themeColors';

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

const STARTED_REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  auto_schedule: 'Automático (jornada)',
  auto_service: 'Automático (servicio)',
};

const ENDED_REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  service_change: 'Cambio de servicio',
  timeout: 'Timeout',
  schedule_end: 'Fin de jornada',
};

interface RouteMapProps {
  points: OperatorRoutePoint[];
  autoFollow: boolean;
  matchingEnabled: boolean;
  matchedBySession: Map<string, MatchedRouteResult>;
  pointLabels: Map<string, ReverseGeocodeLabel>;
}

function RouteMap({ points, autoFollow, matchingEnabled, matchedBySession, pointLabels }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const loadedRef = useRef(false);
  const layerIdsRef = useRef<string[]>([]);
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
        // Toggle OFF, sin matching aún o sin datos → polilínea cruda.
        drawSolid(`route-${sessionId}`, [coordinates]);
      }

      coordinates.forEach((coord) => bounds.extend(coord));

      // Envuelve el punto (dot) con una etiqueta opcional que flota a la derecha
      // sin mover el ancla (posición absoluta dentro del contenedor). El origen
      // 'catalog' es autoritativo (nombre operativo); 'mapbox' es aproximado y se
      // marca con "≈" y estilo atenuado para no leerse como dato cierto.
      const buildMarkerEl = (dot: HTMLDivElement, label?: ReverseGeocodeLabel) => {
        if (!label?.name) return dot;
        const approximate = label.source !== 'catalog';
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = dot.style.width;
        container.style.height = dot.style.height;
        container.appendChild(dot);

        const labelEl = document.createElement('div');
        labelEl.textContent = approximate ? `≈ ${label.name}` : label.name;
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
        container.appendChild(labelEl);
        return container;
      };

      const startEl = document.createElement('div');
      startEl.style.width = '0.875rem';
      startEl.style.height = '0.875rem';
      startEl.style.borderRadius = '9999px';
      startEl.style.background = color;
      startEl.style.border = '0.125rem solid hsl(var(--effect-highlight))';
      startEl.style.boxShadow = 'var(--shadow-sm)';
      markersRef.current.push(
        new mapboxgl.default.Marker({ element: buildMarkerEl(startEl, pointLabels.get(`${sessionId}:start`)) })
          .setLngLat(coordinates[0])
          .addTo(map),
      );

      if (coordinates.length > 1) {
        const endEl = document.createElement('div');
        endEl.style.width = '0.875rem';
        endEl.style.height = '0.875rem';
        endEl.style.borderRadius = '0.125rem';
        endEl.style.background = color;
        endEl.style.border = '0.125rem solid hsl(var(--effect-highlight))';
        endEl.style.boxShadow = 'var(--shadow-sm)';
        markersRef.current.push(
          new mapboxgl.default.Marker({ element: buildMarkerEl(endEl, pointLabels.get(`${sessionId}:end`)) })
            .setLngLat(coordinates[coordinates.length - 1])
            .addTo(map),
        );
      }
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
  }, [autoFollow, mapboxReady, points, matchingEnabled, matchedBySession, pointLabels]);

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

  const { points, sessions, isLoading, error } = useOperatorRouteHistory(operatorId, dateISO);

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
          variant={autoFollow ? 'default' : 'outline'}
          className="w-full sm:w-auto"
          onClick={() => setAutoFollow((current) => !current)}
        >
          <LocateFixed className="size-4" />
          {autoFollow ? 'Siguiendo ruta en vivo' : 'Seguir ruta en vivo'}
        </Button>

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
              />
            )}
          </div>

          {matchingEnabled && (
            <p className="text-xs text-muted-foreground">
              {matchingFetching
                ? 'Ajustando ruta a las calles… mientras tanto se muestra el GPS crudo.'
                : hasRawSegments
                  ? 'Tramo punteado: GPS directo (camino no mapeado).'
                  : 'Ruta ajustada a la red vial.'}
            </p>
          )}

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
        </>
      )}
    </div>
  );
};
