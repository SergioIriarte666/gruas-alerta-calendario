import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TriangleAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTrackableOperators } from '@/hooks/operators/useTrackableOperators';
import { useOperatorRouteHistory } from '@/hooks/operatorlocations/useOperatorLocations';
import { businessClock } from '@/utils/businessClock';
import type { OperatorRoutePoint, OperatorRouteSession } from '@/types/operatorLocations';
import { createLogger } from '@/lib/logger';

const logger = createLogger('RouteHistoryPanel');

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];

const ROUTE_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#34d399', '#f472b6', '#60a5fa'];

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
}

function RouteMap({ points }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const layerIdsRef = useRef<string[]>([]);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: COPIAPO_CENTER,
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      loadedRef.current = true;
      render();
    });
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  const render = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

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

    const bounds = new mapboxgl.LngLatBounds();
    let colorIndex = 0;

    for (const [sessionId, sessionPoints] of bySession.entries()) {
      const coordinates = sessionPoints.map((p) => [p.longitude, p.latitude] as [number, number]);
      const color = ROUTE_COLORS[colorIndex % ROUTE_COLORS.length];
      colorIndex += 1;
      const sourceId = `route-${sessionId}`;

      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      });
      map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': color, 'line-width': 4 },
      });
      layerIdsRef.current.push(sourceId);

      coordinates.forEach((coord) => bounds.extend(coord));

      const startEl = document.createElement('div');
      startEl.style.cssText = `width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)`;
      markersRef.current.push(new mapboxgl.Marker({ element: startEl }).setLngLat(coordinates[0]).addTo(map));

      if (coordinates.length > 1) {
        const endEl = document.createElement('div');
        endEl.style.cssText = `width:14px;height:14px;border-radius:2px;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)`;
        markersRef.current.push(
          new mapboxgl.Marker({ element: endEl }).setLngLat(coordinates[coordinates.length - 1]).addTo(map),
        );
      }
    }

    try {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
    } catch (error) {
      logger.warn('Could not fit bounds to route', error);
    }
  };

  useEffect(() => {
    render();
  }, [points]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-center text-sm text-amber-200">
        <TriangleAlert className="size-6" />
        <p>Configura VITE_MAPBOX_PUBLIC_TOKEN para ver el mapa de ruta.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full min-h-[320px] w-full rounded-2xl" />;
}

interface RouteHistoryPanelProps {
  initialOperatorId?: string | null;
  initialDate?: string | null;
}

export const RouteHistoryPanel = ({ initialOperatorId, initialDate }: RouteHistoryPanelProps) => {
  const { operators } = useTrackableOperators();
  const [operatorId, setOperatorId] = useState<string | null>(initialOperatorId ?? null);
  const [dateISO, setDateISO] = useState<string>(initialDate ?? businessClock.today());
  const validOperatorIds = useMemo(() => new Set(operators.map((operator) => operator.id)), [operators]);

  useEffect(() => {
    if (initialOperatorId) setOperatorId(initialOperatorId);
  }, [initialOperatorId]);

  useEffect(() => {
    if (initialDate) setDateISO(initialDate);
  }, [initialDate]);

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
      </div>

      {!operatorId && (
        <p className="rounded-xl border border-white/5 bg-zinc-950/35 p-6 text-center text-sm text-zinc-500">
          Selecciona un operador para ver su historial de ruta
        </p>
      )}

      {operatorId && error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'No se pudo cargar el historial'}
        </p>
      )}

      {operatorId && !error && (
        <>
          <div className="h-[380px] overflow-hidden rounded-2xl border border-white/5">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Cargando ruta...</div>
            ) : (
              <RouteMap points={points} />
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5">
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
                    <TableCell colSpan={5} className="text-center text-sm text-zinc-500">
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
