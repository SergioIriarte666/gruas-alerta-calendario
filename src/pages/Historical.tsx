import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HistoricalSales } from '@/components/finance/HistoricalSales';
import { HistoricalPurchases } from '@/components/finance/HistoricalPurchases';
import { HistoricalResults } from '@/components/finance/historical/HistoricalResults';
import { LegacyServicesSection } from '@/components/finance/historical/LegacyServicesSection';
import { useUser } from '@/contexts/UserContext';
import { Archive } from 'lucide-react';

const Historical = () => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="historical-concept space-y-6 animate-in fade-in duration-500 pb-6">
      <div className="flex flex-col gap-2">
        <span className="dashboard-section-kicker"><Archive className="size-3.5" />Memoria financiera</span>
        <h1 className="dashboard-section-title">Históricos</h1>
        <p className="dashboard-section-description">Ventas, compras y resultados de periodos anteriores.</p>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="finance-tabs h-auto p-1">
          <TabsTrigger
            value="sales"
          >
            Ventas
          </TabsTrigger>
          <TabsTrigger
            value="purchases"
          >
            Compras
          </TabsTrigger>
          <TabsTrigger
            value="results"
          >
            Resultados
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="legacy"
            >
              Servicios Legacy
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <HistoricalSales />
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          <HistoricalPurchases />
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <HistoricalResults />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="legacy" className="space-y-4">
            <LegacyServicesSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Historical;
