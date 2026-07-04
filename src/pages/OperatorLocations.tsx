import { useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOperatorLiveLocations } from '@/hooks/operatorlocations/useOperatorLocations';
import { LiveOperatorsMap, type LiveOperatorsMapHandle } from '@/components/operatorlocations/LiveOperatorsMap';
import { OperatorStatusPanel } from '@/components/operatorlocations/OperatorStatusPanel';
import { RouteHistoryPanel } from '@/components/operatorlocations/RouteHistoryPanel';
import { IdleMetricsPanel } from '@/components/operatorlocations/IdleMetricsPanel';

type TabKey = 'mapa' | 'historial' | 'tiempos-muertos';

const OperatorLocations = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabKey>('mapa');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [routePreset, setRoutePreset] = useState<{ operatorId: string; dateISO: string } | null>(null);
  const mapHandleRef = useRef<LiveOperatorsMapHandle>(null);

  const { data: liveLocations } = useOperatorLiveLocations();

  const handleSelectOperator = (operatorId: string) => {
    setSelectedOperatorId(operatorId);
    mapHandleRef.current?.flyToOperator(operatorId);
  };

  const handleViewRoute = (operatorId: string, dateISO: string) => {
    setRoutePreset({ operatorId, dateISO });
    setActiveTab('historial');
  };

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
          <div className={isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-[minmax(0,1fr)_320px] gap-4'}>
            <div className="h-[520px] overflow-hidden rounded-2xl border border-white/5">
              <LiveOperatorsMap
                ref={mapHandleRef}
                locations={liveLocations}
                onSelectOperator={handleSelectOperator}
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <OperatorStatusPanel
                locations={liveLocations}
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
