import { useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOperatorLiveLocations } from '@/hooks/operatorlocations/useOperatorLocations';
import { useTrackableOperators } from '@/hooks/operators/useTrackableOperators';
import { LiveOperatorsMap, type LiveOperatorsMapHandle } from '@/components/operatorlocations/LiveOperatorsMap';
import { OperatorStatusPanel } from '@/components/operatorlocations/OperatorStatusPanel';
import { RouteHistoryPanel } from '@/components/operatorlocations/RouteHistoryPanel';
import { IdleMetricsPanel } from '@/components/operatorlocations/IdleMetricsPanel';
import { cn } from '@/lib/utils';
import {
  OPERATOR_STATUS_LABELS,
  deriveOperatorStatus,
  formatMinutesAgo,
  type OperatorLiveLocation,
} from '@/types/operatorLocations';

type TabKey = 'mapa' | 'historial' | 'tiempos-muertos';
type LiveFilterKey = 'todos' | 'con-senal' | 'en-servicio' | 'sin-senal' | 'inactivos';

const LIVE_FILTER_LABELS: Record<LiveFilterKey, string> = {
  todos: 'Todos',
  'con-senal': 'Con señal',
  'en-servicio': 'En servicio',
  'sin-senal': 'Sin señal',
  inactivos: 'Inactivos',
};

const hasKnownCoordinates = (location: OperatorLiveLocation) =>
  location.latitude !== null && location.longitude !== null;

const formatCoordinate = (value: number | null) => (
  typeof value === 'number' ? value.toFixed(6) : 'Sin posicion registrada'
);

const formatAccuracy = (value: number | null) => (
  typeof value === 'number' ? `+-${Math.round(value)} m` : 'Sin precision reportada'
);

const matchesLiveFilter = (location: OperatorLiveLocation, filter: LiveFilterKey) => {
  const status = deriveOperatorStatus(location);

  switch (filter) {
    case 'todos':
      return true;
    case 'con-senal':
      return hasKnownCoordinates(location) && ['en_servicio', 'en_jornada', 'manual'].includes(status);
    case 'en-servicio':
      return hasKnownCoordinates(location) && status === 'en_servicio';
    case 'sin-senal':
      return status === 'sin_senal';
    case 'inactivos':
      return ['inactivo', 'pausado', 'fuera_jornada'].includes(status);
    default:
      return true;
  }
};

const OperatorLocations = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabKey>('mapa');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [liveFilter, setLiveFilter] = useState<LiveFilterKey>('todos');
  const [routePreset, setRoutePreset] = useState<{ operatorId: string; dateISO: string } | null>(null);
  const mapHandleRef = useRef<LiveOperatorsMapHandle>(null);

  const { data: liveLocations } = useOperatorLiveLocations();
  const { operators: trackableOperators } = useTrackableOperators();

  const allTrackableLocations = useMemo(() => {
    const liveLocationsByOperatorId = new Map(liveLocations.map((location) => [location.operator_id, location]));

    return trackableOperators.map((operator) => {
      const liveLocation = liveLocationsByOperatorId.get(operator.id);

      if (liveLocation) {
        return {
          ...liveLocation,
          operator_name: operator.name,
        };
      }

      return {
        operator_id: operator.id,
        operator_name: operator.name,
        session_id: null,
        session_status: null,
        started_reason: null,
        ended_reason: null,
        session_started_at: null,
        session_ended_at: null,
        service_id: null,
        service_folio: null,
        latitude: null,
        longitude: null,
        accuracy_meters: null,
        speed_mps: null,
        heading_degrees: null,
        recorded_at: null,
      } satisfies OperatorLiveLocation;
    });
  }, [liveLocations, trackableOperators]);

  const filteredLocations = useMemo(
    () => allTrackableLocations.filter((location) => matchesLiveFilter(location, liveFilter)),
    [allTrackableLocations, liveFilter],
  );

  const mapLocations = useMemo(
    () => filteredLocations.filter(hasKnownCoordinates),
    [filteredLocations],
  );

  const filterCounts = useMemo(() => {
    return {
      todos: allTrackableLocations.length,
      'con-senal': allTrackableLocations.filter((location) => matchesLiveFilter(location, 'con-senal')).length,
      'en-servicio': allTrackableLocations.filter((location) => matchesLiveFilter(location, 'en-servicio')).length,
      'sin-senal': allTrackableLocations.filter((location) => matchesLiveFilter(location, 'sin-senal')).length,
      inactivos: allTrackableLocations.filter((location) => matchesLiveFilter(location, 'inactivos')).length,
    } satisfies Record<LiveFilterKey, number>;
  }, [allTrackableLocations]);

  const handleSelectOperator = (operatorId: string) => {
    setSelectedOperatorId(operatorId);
    mapHandleRef.current?.flyToOperator(operatorId);
  };

  const handleViewRoute = (operatorId: string, dateISO: string) => {
    setRoutePreset({ operatorId, dateISO });
    setActiveTab('historial');
  };

  const selectedLocation = useMemo(
    () => filteredLocations.find((location) => location.operator_id === selectedOperatorId) ?? null,
    [filteredLocations, selectedOperatorId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ubicaciones"
        description="Rastreo en vivo, historial de ruta y tiempos muertos de los operadores en terreno."
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
        <TabsList>
          <TabsTrigger value="mapa">Mapa en vivo</TabsTrigger>
          <TabsTrigger value="historial">Historial de ruta</TabsTrigger>
          <TabsTrigger value="tiempos-muertos">Tiempos muertos</TabsTrigger>
        </TabsList>

        <TabsContent value="mapa" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(Object.keys(LIVE_FILTER_LABELS) as LiveFilterKey[]).map((filterKey) => (
              <Button
                key={filterKey}
                type="button"
                variant={liveFilter === filterKey ? 'default' : 'outline'}
                className={cn(
                  'h-9 rounded-full px-4',
                  liveFilter === filterKey && 'bg-primary text-primary-foreground',
                )}
                onClick={() => setLiveFilter(filterKey)}
              >
                {LIVE_FILTER_LABELS[filterKey]}
                <span className="ml-2 text-xs opacity-80">{filterCounts[filterKey]}</span>
              </Button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <p>
              Mostrando <span className="font-medium text-foreground">{filteredLocations.length}</span> de{' '}
              <span className="font-medium text-foreground">{allTrackableLocations.length}</span> operadores rastreables.
            </p>
            <p>
              En mapa: <span className="font-medium text-foreground">{mapLocations.length}</span> con ultima posicion conocida.
            </p>
          </div>

          {selectedLocation && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold tracking-tight text-slate-900">{selectedLocation.operator_name}</p>
                  <p className="mt-1 text-base font-medium text-slate-700">
                    Estado actual: {OPERATOR_STATUS_LABELS[deriveOperatorStatus(selectedLocation)]}
                    {selectedLocation.service_folio ? ` · Folio ${selectedLocation.service_folio}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-slate-700">
                    Ultima señal {formatMinutesAgo(selectedLocation.recorded_at)}
                  </p>
                  <p className="text-sm font-medium text-slate-600">{formatAccuracy(selectedLocation.accuracy_meters)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Latitud</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatCoordinate(selectedLocation.latitude)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Longitud</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatCoordinate(selectedLocation.longitude)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sesion</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {selectedLocation.session_status === 'active' ? 'Activa' : 'Sin sesion activa'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-[minmax(0,1fr)_320px] gap-4'}>
            <div className="h-[520px] overflow-hidden rounded-2xl border border-white/5">
              <LiveOperatorsMap
                ref={mapHandleRef}
                locations={mapLocations}
                onSelectOperator={handleSelectOperator}
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <OperatorStatusPanel
                locations={filteredLocations}
                selectedOperatorId={selectedOperatorId}
                onSelectOperator={handleSelectOperator}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <RouteHistoryPanel
            initialOperatorId={routePreset?.operatorId ?? selectedOperatorId}
            initialDate={routePreset?.dateISO}
          />
        </TabsContent>

        <TabsContent value="tiempos-muertos" className="mt-4">
          <IdleMetricsPanel onViewRoute={handleViewRoute} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperatorLocations;
