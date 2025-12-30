import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VehicleBrandsManager } from '@/components/vehicles/VehicleBrandsManager';
import { VehicleModelsManager } from '@/components/vehicles/VehicleModelsManager';
import { PatentLookup } from '@/components/vehicles/PatentLookup';
import { VehicleHistoryLookupModal } from '@/components/vehicles/VehicleHistoryLookupModal';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';

const Vehicles: React.FC = () => {
  const [activeTab, setActiveTab] = useState('brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Vehículos</h1>
          <p className="text-muted-foreground">
            Administra las marcas y modelos de vehículos del sistema.
          </p>
        </div>
        <Button 
          onClick={() => setHistoryModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <History className="h-4 w-4 mr-2" />
          Historial Completo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="brands">Marcas</TabsTrigger>
          <TabsTrigger value="models">Modelos</TabsTrigger>
          <TabsTrigger value="patent-lookup">Consulta de Patentes</TabsTrigger>
        </TabsList>
        
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