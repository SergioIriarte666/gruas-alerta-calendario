import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VehicleBrandsManager } from '@/components/vehicles/VehicleBrandsManager';
import { VehicleModelsManager } from '@/components/vehicles/VehicleModelsManager';

const Vehicles: React.FC = () => {
  const [activeTab, setActiveTab] = useState('brands');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Vehículos</h1>
        <p className="text-muted-foreground">
          Administra las marcas y modelos de vehículos del sistema.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="brands">Marcas</TabsTrigger>
          <TabsTrigger value="models">Modelos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="brands" className="space-y-4">
          <VehicleBrandsManager searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </TabsContent>
        
        <TabsContent value="models" className="space-y-4">
          <VehicleModelsManager searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Vehicles;