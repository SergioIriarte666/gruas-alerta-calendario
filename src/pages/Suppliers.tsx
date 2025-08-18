import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CreditCard, Calendar, BarChart3, AlertTriangle, DollarSign } from 'lucide-react';
import { SupplierList } from '@/components/suppliers/SupplierList';
import { PaymentList } from '@/components/suppliers/PaymentList';
import { SupplierPaymentCalendar } from '@/components/suppliers/SupplierPaymentCalendar';
import { useSupplierStats } from '@/hooks/useSupplierStats';
import { formatCurrency } from '@/lib/utils';

export const Suppliers: React.FC = () => {
  const { data: stats, isLoading: statsLoading } = useSupplierStats();

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-400" />
              Gestión de Proveedores
            </h1>
            <p className="text-gray-400 mt-2">
              Administra proveedores, pagos y seguimiento de vencimientos
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-8 w-8 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">Total Proveedores</p>
                    <p className="text-2xl font-bold text-white">{stats.total_suppliers}</p>
                    <p className="text-xs text-green-400">{stats.active_suppliers} activos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <CreditCard className="h-8 w-8 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-400">Pagos Pendientes</p>
                    <p className="text-2xl font-bold text-white">{stats.total_pending_payments}</p>
                    <p className="text-xs text-yellow-400">
                      {formatCurrency(stats.total_pending_amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                  <div>
                    <p className="text-sm text-gray-400">Pagos Vencidos</p>
                    <p className="text-2xl font-bold text-white">{stats.total_overdue_payments}</p>
                    <p className="text-xs text-red-400">
                      {formatCurrency(stats.total_overdue_amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-400">Total Pendiente</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(stats.total_pending_amount + stats.total_overdue_amount)}
                    </p>
                    <p className="text-xs text-gray-400">Por pagar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Category Distribution */}
        {!statsLoading && stats && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Distribución por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(stats.suppliers_by_category).map(([category, count]) => {
                  if (count === 0) return null;
                  
                  const categoryLabels: Record<string, string> = {
                    combustible: 'Combustible',
                    mantenimiento: 'Mantenimiento',
                    seguros: 'Seguros',
                    peajes: 'Peajes',
                    salarios: 'Salarios',
                    administrativos: 'Administrativos',
                    impuestos: 'Impuestos',
                    comision_operador: 'Comisión Operador',
                    otros: 'Otros'
                  };

                  return (
                    <div key={category} className="text-center">
                      <Badge variant="outline" className="border-blue-500/30 text-blue-300 mb-2">
                        {categoryLabels[category] || category}
                      </Badge>
                      <p className="text-2xl font-bold text-white">{count}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="suppliers" className="space-y-6">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger 
              value="suppliers" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Proveedores
            </TabsTrigger>
            <TabsTrigger 
              value="payments"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pagos
            </TabsTrigger>
            <TabsTrigger 
              value="calendar"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendario
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="space-y-6">
            <SupplierList />
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <PaymentList />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <SupplierPaymentCalendar />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};