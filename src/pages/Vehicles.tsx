import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { VehicleBrandsManager } from '@/components/vehicles/VehicleBrandsManager';
import { VehicleModelsManager } from '@/components/vehicles/VehicleModelsManager';
import { PatentLookup } from '@/components/vehicles/PatentLookup';
import { VehicleHistoryLookupModal } from '@/components/vehicles/VehicleHistoryLookupModal';
import { CarFront, History, ScanSearch, Tags, Database, Layers3 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Vehicles: React.FC = () => {
  const [activeTab, setActiveTab] = useState('brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="vehicles-concept space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="dashboard-section-kicker"><CarFront className="size-3.5" />Catálogo vehicular</span>
          <h1 className="dashboard-section-title">Vehículos</h1>
          <p className="dashboard-section-description">Marcas, modelos, consultas por patente e historial consolidado.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setHistoryModalOpen(true)} className="gap-2 border-border/70 bg-background/70">
          <History className="size-4" />
          {isMobile ? 'Historial' : 'Historial completo'}
        </Button>
      </div>

      <SectionCard
        flush
        className="resources-panel border-border/70 bg-card/80 shadow-sm"
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap gap-2 px-3 pt-4 sm:px-6 sm:pt-6">
          <Badge className="resource-catalog-badge gap-1 px-3 py-1">
            <Database className="size-3.5" />
            Catálogo base
          </Badge>
          <Badge variant="outline" className="gap-1 rounded-full px-3 py-1">
            <Layers3 className="size-3.5" />
            Modelos y marcas
          </Badge>
          <Badge variant="outline" className="gap-1 rounded-full px-3 py-1">
            <ScanSearch className="size-3.5" />
            Consulta por patente
          </Badge>
        </div>

        <Card className="resources-panel mx-3 border-border/70 bg-background/50 shadow-none sm:mx-6">
          <CardContent className="p-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="resources-tabs flex h-auto w-full gap-1 p-1">
                <TabsTrigger
                  value="brands"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg text-xs text-muted-foreground sm:text-sm"
                >
                  <Tags className="size-3.5 sm:size-4 shrink-0" />
                  <span>Marcas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="models"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg text-xs text-muted-foreground sm:text-sm"
                >
                  <CarFront className="size-3.5 sm:size-4 shrink-0" />
                  <span>Modelos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="patent-lookup"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg text-xs text-muted-foreground sm:text-sm"
                >
                  <ScanSearch className="size-3.5 sm:size-4 shrink-0" />
                  <span>{isMobile ? 'Patentes' : 'Consulta de Patentes'}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="brands" className="space-y-4 px-4 pb-4">
                <VehicleBrandsManager searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
              </TabsContent>

              <TabsContent value="models" className="space-y-4 px-4 pb-4">
                <VehicleModelsManager searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
              </TabsContent>

              <TabsContent value="patent-lookup" className="space-y-4 px-4 pb-4">
                <PatentLookup />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </SectionCard>

      <VehicleHistoryLookupModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    </div>
  );
};

export default Vehicles;
