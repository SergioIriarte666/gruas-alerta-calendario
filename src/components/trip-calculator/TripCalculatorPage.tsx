import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, History, Fuel, Settings2 } from 'lucide-react';
import { TripCalculatorForm } from './TripCalculatorForm';
import { TripEstimateHistory } from './TripEstimateHistory';
import { FuelPricesManager } from './FuelPricesManager';
import { ConsumptionRatesManager } from './ConsumptionRatesManager';
import { SavedLocationsManager } from './SavedLocationsManager';

export const TripCalculatorPage = () => {
  const [activeTab, setActiveTab] = useState('calculator');

  return (
    <div className="space-y-6 p-3 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cálculo de Viajes</h1>
          <p className="text-muted-foreground mt-1">
            Estima costos de viaje incluyendo combustible, peajes y costos adicionales
          </p>
        </div>
        <SavedLocationsManager />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:w-auto md:inline-grid">
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="size-4" />
            <span className="hidden md:inline">Calculadora</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            <span className="hidden md:inline">Historial</span>
          </TabsTrigger>
          <TabsTrigger value="fuel" className="gap-2">
            <Fuel className="size-4" />
            <span className="hidden md:inline">Combustible</span>
          </TabsTrigger>
          <TabsTrigger value="consumption" className="gap-2">
            <Settings2 className="size-4" />
            <span className="hidden md:inline">Consumos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="calculator"
          forceMount
          className={activeTab === 'calculator' ? 'mt-6' : 'hidden'}
        >
          <TripCalculatorForm />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <TripEstimateHistory />
        </TabsContent>

        <TabsContent value="fuel" className="mt-6">
          <FuelPricesManager />
        </TabsContent>

        <TabsContent value="consumption" className="mt-6">
          <ConsumptionRatesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
