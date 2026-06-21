import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HistoricalSales } from '@/components/finance/HistoricalSales';
import { HistoricalPurchases } from '@/components/finance/HistoricalPurchases';
import { HistoricalResults } from '@/components/finance/historical/HistoricalResults';

const Historical = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-3xl">Históricos</h1>
        <p className="text-muted-foreground">
          Gestión de registros históricos de ventas y compras.
        </p>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger
            value="sales"
            className="data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Ventas
          </TabsTrigger>
          <TabsTrigger
            value="purchases"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Compras
          </TabsTrigger>
          <TabsTrigger
            value="results"
            className="data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Resultados
          </TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default Historical;
