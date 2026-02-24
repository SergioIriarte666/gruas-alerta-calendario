import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calculator, Route, Milestone, Fuel, Gauge } from 'lucide-react';
import { TransportCostCalculator } from './TransportCostCalculator';
import { RoutesManager } from './RoutesManager';
import { TollStationsManager } from './TollStationsManager';
import { FuelPricesManager } from './FuelPricesManager';
import { ConsumptionRatesManager } from './ConsumptionRatesManager';

export const TransportCostTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('calculator');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full flex flex-wrap gap-1">
        <TabsTrigger value="calculator" className="flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Calculadora
        </TabsTrigger>
        <TabsTrigger value="routes" className="flex items-center gap-2">
          <Route className="w-4 h-4" />
          Rutas
        </TabsTrigger>
        <TabsTrigger value="tolls" className="flex items-center gap-2">
          <Milestone className="w-4 h-4" />
          Peajes
        </TabsTrigger>
        <TabsTrigger value="fuel" className="flex items-center gap-2">
          <Fuel className="w-4 h-4" />
          Combustible
        </TabsTrigger>
        <TabsTrigger value="consumption" className="flex items-center gap-2">
          <Gauge className="w-4 h-4" />
          Consumos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calculator">
        <TransportCostCalculator />
      </TabsContent>
      <TabsContent value="routes">
        <RoutesManager />
      </TabsContent>
      <TabsContent value="tolls">
        <TollStationsManager />
      </TabsContent>
      <TabsContent value="fuel">
        <FuelPricesManager />
      </TabsContent>
      <TabsContent value="consumption">
        <ConsumptionRatesManager />
      </TabsContent>
    </Tabs>
  );
};
