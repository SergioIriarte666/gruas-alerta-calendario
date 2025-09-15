import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, TrendingUp, BarChart3, Plus, Search, Filter, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useInventoryStats, useInventoryMovements, useLowStockItems } from '@/hooks/useInventory';
import { InventoryMovementForm } from '@/components/inventory/InventoryMovementForm';
import { ProductCatalogTable } from '@/components/inventory/ProductCatalogTable';
import { MovementsHistoryTable } from '@/components/inventory/MovementsHistoryTable';
import { PurchaseGroupingView } from '@/components/inventory/PurchaseGroupingView';
import { InventoryReportsPage } from '@/components/inventory/reports/InventoryReportsPage';
import { InventoryAlertsPage } from '@/components/inventory/alerts/InventoryAlertsPage';
import { InventoryFixPanel } from '@/components/inventory/InventoryFixPanel';
import { format } from 'date-fns';

const Inventory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);

  // Real data from hooks
  const { data: stats, isLoading: statsLoading } = useInventoryStats();
  const { data: recentMovements, isLoading: movementsLoading } = useInventoryMovements(5);
  const { data: lowStockData, isLoading: lowStockLoading } = useLowStockItems();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Bodega</h1>
          <p className="text-gray-600">Control de inventario y stock de repuestos</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/services?newSale=true')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Venta
          </Button>
          <Dialog open={showExitForm} onOpenChange={setShowExitForm}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Registrar Salida
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Salida de Inventario</DialogTitle>
              </DialogHeader>
              <InventoryMovementForm 
                onSuccess={() => setShowExitForm(false)}
                defaultMovementType="exit"
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showMovementForm} onOpenChange={setShowMovementForm}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Movimiento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Movimiento de Inventario</DialogTitle>
              </DialogHeader>
              <InventoryMovementForm 
                onSuccess={() => setShowMovementForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (stats?.totalItems || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de productos activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statsLoading ? '...' : stats?.lowStock || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren reposición
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statsLoading ? '...' : stats?.outOfStock || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Críticos para operación
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${statsLoading ? '...' : (stats?.totalValue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total del inventario
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="catalog">Catálogo</TabsTrigger>
                <TabsTrigger value="movements">Movimientos</TabsTrigger>
                <TabsTrigger value="purchases">Compras</TabsTrigger>
                <TabsTrigger value="reports">Reportes</TabsTrigger>
                <TabsTrigger value="alerts">Alertas</TabsTrigger>
                <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
              </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Movements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Movimientos Recientes
                </CardTitle>
                <CardDescription>
                  Últimas entradas y salidas de inventario
                </CardDescription>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <div className="text-center py-4 text-gray-500">Cargando movimientos...</div>
                ) : (
                  <div className="space-y-3">
                    {recentMovements?.map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={movement.movement_type === 'entry' ? 'default' : 'secondary'}>
                            {movement.movement_type === 'entry' ? 'Entrada' : 
                             movement.movement_type === 'exit' ? 'Salida' : 
                             movement.movement_type === 'transfer' ? 'Transferencia' : 'Ajuste'}
                          </Badge>
                          <div>
                            <p className="font-medium">{movement.item?.name}</p>
                            <p className="text-sm text-gray-600">Cantidad: {movement.quantity}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">
                          {format(new Date(movement.movement_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    )) || (
                      <div className="text-center py-4 text-gray-500">No hay movimientos recientes</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Low Stock Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Alertas de Stock Bajo
                </CardTitle>
                <CardDescription>
                  Productos que requieren reposición urgente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockLoading ? (
                  <div className="text-center py-4 text-gray-500">Cargando alertas...</div>
                ) : (
                  <div className="space-y-3">
                    {lowStockData?.slice(0, 5).map((stock) => (
                      <div key={stock.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div>
                          <p className="font-medium">{stock.item?.name}</p>
                          <p className="text-sm text-gray-600">{stock.location?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            <span className="font-medium text-red-600">{stock.current_quantity}</span>
                            <span className="text-gray-500"> / {stock.item?.minimum_stock} min</span>
                          </p>
                          <Badge variant="outline" className="text-xs">
                            Stock Bajo
                          </Badge>
                        </div>
                      </div>
                    )) || (
                      <div className="text-center py-4 text-gray-500">No hay alertas de stock bajo</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

            <TabsContent value="catalog" className="space-y-4">
              <ProductCatalogTable />
            </TabsContent>
            
            <TabsContent value="movements" className="space-y-4">
              <MovementsHistoryTable />
            </TabsContent>
            
            <TabsContent value="purchases" className="space-y-4">
              <PurchaseGroupingView />
            </TabsContent>
            
            <TabsContent value="reports" className="space-y-4">
              <InventoryReportsPage />
            </TabsContent>
            
            <TabsContent value="alerts" className="space-y-4">
              <InventoryAlertsPage />
            </TabsContent>
            
            <TabsContent value="maintenance" className="space-y-4">
              <div className="max-w-4xl mx-auto">
                <InventoryFixPanel />
              </div>
            </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventory;