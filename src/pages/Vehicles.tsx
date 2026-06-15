import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
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
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Vehículos"
        description="Administra catálogos de marcas, modelos y consultas por patente desde una misma experiencia."
        actions={
          <Button
            variant="outline"
            size={isMobile ? 'sm' : 'default'}
            onClick={() => setHistoryModalOpen(true)}
            className="gap-2 border-border/70 bg-card/70"
          >
            <History className="size-4" />
            {isMobile ? 'Historial' : 'Historial Completo'}
          </Button>
        }
      />

      <SectionCard
        flush
        className="border-border/70 bg-card/80 shadow-sm"
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap gap-2 px-3 pt-4 sm:px-6 sm:pt-6">
          <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
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

        <Card className="mx-6 border-border/70 bg-background/50 shadow-none">
          <CardContent className="p-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="flex w-full gap-1 rounded-xl bg-muted/50 p-1">
                <TabsTrigger
                  value="brands"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Tags className="size-3.5 sm:size-4 shrink-0" />
                  <span>Marcas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="models"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <CarFront className="size-3.5 sm:size-4 shrink-0" />
                  <span>Modelos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="patent-lookup"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
