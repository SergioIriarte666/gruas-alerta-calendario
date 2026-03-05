import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HistoricalSales } from '@/components/finance/HistoricalSales';
import { HistoricalPurchases } from '@/components/finance/HistoricalPurchases';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const Historical = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Históricos</h1>
        <p className="text-muted-foreground">
          Gestión de registros históricos de ventas y compras.
        </p>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Histórico de Ventas</TabsTrigger>
          <TabsTrigger value="purchases">Histórico de Compras</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Ventas</CardTitle>
              <CardDescription>
                Registro histórico de facturación y ventas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HistoricalSales />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="purchases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Compras</CardTitle>
              <CardDescription>
                Registro histórico de adquisiciones y gastos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HistoricalPurchases />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Historical;
