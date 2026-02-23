import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { VehicleBrandsManager } from '@/components/vehicles/VehicleBrandsManager';
import { VehicleModelsManager } from '@/components/vehicles/VehicleModelsManager';
import { PatentLookup } from '@/components/vehicles/PatentLookup';
import { VehicleHistoryLookupModal } from '@/components/vehicles/VehicleHistoryLookupModal';
import { History } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Vehicles: React.FC = () => {
  const [activeTab, setActiveTab] = useState('brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-start justify-between'}`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold tracking-tight`}>Gestión de Vehículos</h1>
          {!isMobile && (
            <p className="text-muted-foreground">
              Administra las marcas y modelos de vehículos del sistema.
            </p>
          )}
        </div>
        <Button 
          variant="outline" 
          size={isMobile ? 'sm' : 'default'}
          onClick={() => setHistoryModalOpen(true)}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          {isMobile ? 'Historial' : 'Historial Completo'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="whitespace-nowrap">
            <TabsTrigger value="brands">Marcas</TabsTrigger>
            <TabsTrigger value="models">Modelos</TabsTrigger>
            <TabsTrigger value="patent-lookup">{isMobile ? 'Patentes' : 'Consulta de Patentes'}</TabsTrigger>
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

      <VehicleHistoryLookupModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    </div>
  );
};

export default Vehicles;