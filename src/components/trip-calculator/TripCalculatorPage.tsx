import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, History, Fuel, Settings2, Route } from 'lucide-react';
import { TripCalculatorForm } from './TripCalculatorForm';
import { TripEstimateHistory } from './TripEstimateHistory';
import { FuelPricesManager } from './FuelPricesManager';
import { ConsumptionRatesManager } from './ConsumptionRatesManager';
import { SavedLocationsManager } from './SavedLocationsManager';

export const TripCalculatorPage = () => {
  const [activeTab, setActiveTab] = useState('calculator');

  return (
    <div className="trip-calculator-concept space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="dashboard-section-kicker"><Route className="size-3.5" />Planificación de ruta</span>
          <h1 className="dashboard-section-title">Cálculo de Viajes</h1>
          <p className="dashboard-section-description">Combustible, peajes y costos adicionales antes de salir a ruta.</p>
        </div>
        <SavedLocationsManager />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="finance-tabs grid h-auto w-full grid-cols-4 p-1 md:w-auto md:inline-grid">
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
