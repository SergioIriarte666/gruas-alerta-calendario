import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { VehicleBrandsManager } from '@/components/vehicles/VehicleBrandsManager';
import { VehicleModelsManager } from '@/components/vehicles/VehicleModelsManager';
import { PatentLookup } from '@/components/vehicles/PatentLookup';
import { VehicleHistoryLookupModal } from '@/components/vehicles/VehicleHistoryLookupModal';
import { CarFront, History, ScanSearch, Tags } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Vehicles: React.FC = () => {
  const [activeTab, setActiveTab] = useState('brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-sky-50 via-background to-indigo-50/70 shadow-sm dark:from-sky-950/20 dark:via-background dark:to-indigo-950/20">
        <CardHeader className="pb-4">
          <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-start justify-between gap-6'}`}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 p-3 text-white shadow-md">
                  <CarFront className="h-6 w-6" />
                </div>
                <div>
                  <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold tracking-tight`}>
                    Gestión de Vehículos
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300 md:text-base">
                    Administra marcas, modelos y consultas con una interfaz más clara y ordenada.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className="gap-1 border-0 bg-amber-100 px-3 py-1 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200">
                  <Tags className="h-3.5 w-3.5" />
                  Catálogo de marcas
                </Badge>
                <Badge className="gap-1 border-0 bg-violet-100 px-3 py-1 text-violet-800 hover:bg-violet-100 dark:bg-violet-500/20 dark:text-violet-200">
                  <CarFront className="h-3.5 w-3.5" />
                  Gestión de modelos
                </Badge>
                <Badge className="gap-1 border-0 bg-emerald-100 px-3 py-1 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-200">
                  <ScanSearch className="h-3.5 w-3.5" />
                  Consulta por patente
                </Badge>
              </div>
            </div>

            <Button
              variant="outline"
              size={isMobile ? 'sm' : 'default'}
              onClick={() => setHistoryModalOpen(true)}
              className="gap-2 border-sky-200 bg-white/85 text-sky-700 shadow-sm hover:bg-sky-50 dark:border-sky-800 dark:bg-background/80 dark:text-sky-300 dark:hover:bg-sky-950/20"
            >
              <History className="h-4 w-4" />
              {isMobile ? 'Historial' : 'Historial Completo'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white/60 p-2 shadow-inner dark:border-sky-900/40 dark:bg-muted/20">
              <TabsList className="grid w-full min-w-[420px] grid-cols-3 bg-transparent p-0">
                <TabsTrigger
                  value="brands"
                  className="gap-2 rounded-xl border border-transparent text-amber-700 data-[state=active]:border-amber-200 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900 data-[state=active]:shadow-sm dark:text-amber-300 dark:data-[state=active]:border-amber-900 dark:data-[state=active]:bg-amber-950/30 dark:data-[state=active]:text-amber-100"
                >
                  <Tags className="h-4 w-4" />
                  Marcas
                </TabsTrigger>
                <TabsTrigger
                  value="models"
                  className="gap-2 rounded-xl border border-transparent text-violet-700 data-[state=active]:border-violet-200 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-900 data-[state=active]:shadow-sm dark:text-violet-300 dark:data-[state=active]:border-violet-900 dark:data-[state=active]:bg-violet-950/30 dark:data-[state=active]:text-violet-100"
                >
                  <CarFront className="h-4 w-4" />
                  Modelos
                </TabsTrigger>
                <TabsTrigger
                  value="patent-lookup"
                  className="gap-2 rounded-xl border border-transparent text-emerald-700 data-[state=active]:border-emerald-200 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm dark:text-emerald-300 dark:data-[state=active]:border-emerald-900 dark:data-[state=active]:bg-emerald-950/30 dark:data-[state=active]:text-emerald-100"
                >
                  <ScanSearch className="h-4 w-4" />
                  {isMobile ? 'Patentes' : 'Consulta de Patentes'}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="brands" className="space-y-4">
              <VehicleBrandsManager searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
            </TabsContent>

            <TabsContent value="models" className="space-y-4">
              <VehicleModelsManager searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
            </TabsContent>

            <TabsContent value="patent-lookup" className="space-y-4">
              <PatentLookup />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <VehicleHistoryLookupModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    </div>
  );
};

export default Vehicles;
