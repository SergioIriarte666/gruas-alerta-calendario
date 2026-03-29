import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, TrendingUp, BarChart3, Plus, Search, Filter, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useInventoryStats, useInventoryMovements, useLowStockItems } from '@/hooks/useInventory';
import { useInventorySyncWatcher } from '@/hooks/useInventorySyncWatcher';
import { InventoryStockView } from '@/components/inventory/InventoryStockView';
import { MovementsHistoryTable } from '@/components/inventory/MovementsHistoryTable';
import { InventoryReportsPage } from '@/components/inventory/reports/InventoryReportsPage';
import { format } from 'date-fns';
import { InventoryMovementForm } from '@/components/inventory/InventoryMovementForm';
import { useQuickEntry } from '@/hooks/useQuickEntry';
import { supabase } from '@/integrations/supabase/client';

const Inventory = () => {
  // Activar watcher de sincronización global (todas las grúas)
  useInventorySyncWatcher();
  
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation() as any;
  const navigate = useNavigate();
  const { deleteEntry } = useQuickEntry();
  const [intakeOpen, setIntakeOpen] = useState<boolean>(!!location?.state?.prefilledData);
  const [prefill, setPrefill] = useState<any | null>(location?.state?.prefilledData || null);

  // Real data from hooks
  const { data: stats, isLoading: statsLoading } = useInventoryStats();
  const { data: recentMovements, isLoading: movementsLoading } = useInventoryMovements(5);
  const { data: lowStockData, isLoading: lowStockLoading } = useLowStockItems();

  const isMobile = useIsMobile();

  return (
    <div className={`${isMobile ? 'p-3 space-y-3' : 'p-6 space-y-6'}`}>
      <Dialog open={intakeOpen} onOpenChange={(open) => {
        setIntakeOpen(open);
        if (!open) {
          if (navigate) navigate(location.pathname, { replace: true });
          setPrefill(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar entrada de inventario desde Registro Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div><span className="text-muted-foreground">Descripción:</span> {prefill?.description || '-'}</div>
              <div><span className="text-muted-foreground">Fecha:</span> {prefill?.date || '-'}</div>
              <div><span className="text-muted-foreground">Monto sugerido (unitario):</span> {prefill?.amount ?? 0}</div>
              {prefill?.notes && <div><span className="text-muted-foreground">Notas:</span> {prefill.notes}</div>}
            </div>
            <InventoryMovementForm
              onCreated={async (movement) => {
                const receiptPhotoPaths = prefill?.receipt_photo_paths as string[] | undefined;
                if (receiptPhotoPaths?.length && movement?.id) {
                  try {
                    await supabase
                      .from('inventory_movements')
                      .update({ receipt_photo_paths: receiptPhotoPaths } as any)
                      .eq('id', movement.id);
                  } catch (error) {
                    console.error('Error saving receipt photos to inventory movement:', error);
                  }
                }
                if (prefill?.quickEntryId) {
                  try {
                    await deleteEntry(prefill.quickEntryId);
                  } catch (error) {
                    console.error('Error deleting quick entry after inventory movement:', error);
                  }
                }
                setIntakeOpen(false);
                setPrefill(null);
              }}
              defaultMovementType="entry"
              prefill={{
                unit_cost: prefill?.amount ?? undefined,
                observations: prefill?.notes || undefined,
                reason: prefill?.description || undefined,
                movement_date: prefill?.date ? new Date(prefill.date + 'T00:00:00') : undefined,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold`}>Gestión de Bodega</h1>
          {!isMobile && <p className="text-muted-foreground">Control de inventario y stock de repuestos</p>}
        </div>
      </div>

      {/* Stats Cards */}
      <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}`}>
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
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="stock" className="text-xs sm:text-sm">📦 <span className="hidden sm:inline ml-1">Stock</span></TabsTrigger>
          <TabsTrigger value="movements" className="text-xs sm:text-sm">📝 <span className="hidden sm:inline ml-1">Movimientos</span></TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm">📊 <span className="hidden sm:inline ml-1">Reportes</span></TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <InventoryStockView />
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <MovementsHistoryTable />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <InventoryReportsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventory;
