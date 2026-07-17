import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { MetricCard } from '@/components/ui/metric-card';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, TrendingUp, BarChart3, Upload, ArrowUpDown, Boxes, FileSpreadsheet, Warehouse } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventoryStats, useInventoryMovements, useLowStockItems } from '@/hooks/useInventory';
import { useInventorySyncWatcher } from '@/hooks/useInventorySyncWatcher';
import { InventoryStockView } from '@/components/inventory/InventoryStockView';
import { MovementsHistoryTable } from '@/components/inventory/MovementsHistoryTable';
import { InventoryReportsPage } from '@/components/inventory/reports/InventoryReportsPage';
import { InventoryMovementForm } from '@/components/inventory/InventoryMovementForm';
import { XMLInventoryUpload } from '@/components/inventory/XMLInventoryUpload';
import { useQuickEntry } from '@/hooks/useQuickEntry';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";
import {
  INVENTORY_ENTITY_FILTER_LABELS,
  INVENTORY_ENTITY_FILTER_STORAGE_KEY,
  isInventoryEntityFilter,
  type InventoryEntityFilter,
} from '@/utils/inventoryEntity';


const logger = createLogger("Inventory");
const Inventory = () => {
  useInventorySyncWatcher();

  const location = useLocation() as any;
  const navigate = useNavigate();
  const { deleteEntry } = useQuickEntry();
  const [intakeOpen, setIntakeOpen] = useState<boolean>(!!location?.state?.prefilledData);
  const [prefill, setPrefill] = useState<any | null>(location?.state?.prefilledData || null);
  const [isXMLImportOpen, setIsXMLImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');
  const [entityFilter, setEntityFilter] = useState<InventoryEntityFilter>(() => {
    if (typeof window === 'undefined') return 'all';
    const saved = window.sessionStorage.getItem(INVENTORY_ENTITY_FILTER_STORAGE_KEY);
    return isInventoryEntityFilter(saved) ? saved : 'all';
  });

  const { data: stats, isLoading: statsLoading } = useInventoryStats(entityFilter);
  const { data: recentMovements = [], isLoading: movementsLoading } = useInventoryMovements(5, entityFilter);
  const { data: lowStockData = [] } = useLowStockItems(entityFilter);

  const isMobile = useIsMobile();

  const handleEntityFilterChange = (value: InventoryEntityFilter) => {
    setEntityFilter(value);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(INVENTORY_ENTITY_FILTER_STORAGE_KEY, value);
    }
  };

  return (
    <div className="inventory-concept space-y-6 pb-6">
      <Dialog open={intakeOpen} onOpenChange={(open) => {
        setIntakeOpen(open);
        if (!open) {
          if (navigate) navigate(location.pathname, { replace: true });
          setPrefill(null);
        }
      }}>
        <DialogContent className="inventory-dialog border-border/70 bg-card">
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
              entityFilter={entityFilter}
              onCreated={async (movement) => {
                const receiptPhotoPaths = prefill?.receipt_photo_paths as string[] | undefined;
                if (receiptPhotoPaths?.length && movement?.id) {
                  try {
                    await supabase
                      .from('inventory_movements')
                      .update({ receipt_photo_paths: receiptPhotoPaths } as any)
                      .eq('id', movement.id);
                  } catch (error) {
                    logger.error('Error saving receipt photos to inventory movement:', error);
                  }
                }
                if (prefill?.quickEntryId) {
                  try {
                    await deleteEntry(prefill.quickEntryId);
                  } catch (error) {
                    logger.error('Error deleting quick entry after inventory movement:', error);
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
                movement_date: prefill?.date ? new Date(`${prefill.date}T12:00:00Z`) : undefined,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="dashboard-section-kicker"><Warehouse className="size-3.5" />Control de existencias</span>
          <h1 className="dashboard-section-title">Bodega</h1>
          <p className="dashboard-section-description">Stock, movimientos y reportería de inventario en una vista unificada.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Tabs value={entityFilter} onValueChange={(value) => handleEntityFilterChange(value as InventoryEntityFilter)}>
            <TabsList className="inventory-tabs h-auto p-1">
              {(['all', 'gruas_5_norte', 'lowboy'] as const).map((value) => (
                <TabsTrigger key={value} value={value} className="px-3 py-1.5 text-xs sm:text-sm">
                  {INVENTORY_ENTITY_FILTER_LABELS[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsXMLImportOpen(true)} size="sm" className="dashboard-report-button flex items-center gap-2">
            <Upload className="size-4" />
            <span>{isMobile ? 'XML' : 'Importar XML'}</span>
          </Button>
        </div>
      </div>

      <XMLInventoryUpload
        isOpen={isXMLImportOpen}
        onClose={() => setIsXMLImportOpen(false)}
        onSuccess={() => setIsXMLImportOpen(false)}
      />

      {statsLoading ? (
        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'}`}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'}`}>
          <MetricCard
            title="Total Productos"
            value={(stats?.totalItems || 0).toLocaleString()}
            description={`${recentMovements.length} movimientos recientes`}
            icon={Boxes}
            tone="primary"
            variant="control"
          />
          <MetricCard
            title="Stock Bajo"
            value={stats?.lowStock || 0}
            description={`${lowStockData.length} productos monitoreados`}
            icon={AlertTriangle}
            tone="warning"
            variant="control"
          />
          <MetricCard
            title="Sin Stock"
            value={stats?.outOfStock || 0}
            description="Requieren reposición inmediata"
            icon={Package}
            tone="danger"
            variant="control"
          />
          <MetricCard
            title="Valor Total"
            value={`$${(stats?.totalValue || 0).toLocaleString()}`}
            description={movementsLoading ? 'Actualizando movimientos...' : 'Valorización consolidada'}
            icon={TrendingUp}
            tone="info"
            variant="control"
          />
        </div>
      )}

      <SectionCard flush className="inventory-panel border-border/70 bg-card/80 shadow-sm" contentClassName="space-y-4">
        <div className="flex flex-wrap gap-2 px-3 pt-4 sm:px-6 sm:pt-6">
          <Badge className="inventory-catalog-badge gap-1 px-3 py-1">
            <Package className="size-3.5" />
            Stock operativo
          </Badge>
          <Badge variant="outline" className="gap-1 rounded-full px-3 py-1">
            <ArrowUpDown className="size-3.5" />
            Trazabilidad de movimientos
          </Badge>
          <Badge variant="outline" className="gap-1 rounded-full px-3 py-1">
            <FileSpreadsheet className="size-3.5" />
            Reportería analítica
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 px-3 pb-4 sm:px-6 sm:pb-6">
          <div className="overflow-x-auto">
            <TabsList className="inventory-tabs grid h-auto w-full min-w-[420px] grid-cols-3 p-1">
              <TabsTrigger
                value="stock"
                className="gap-2 rounded-lg text-muted-foreground"
              >
                <Package className="size-4" />
                <span>Stock</span>
              </TabsTrigger>
              <TabsTrigger
                value="movements"
                className="gap-2 rounded-lg text-muted-foreground"
              >
                <ArrowUpDown className="size-4" />
                <span>Movimientos</span>
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="gap-2 rounded-lg text-muted-foreground"
              >
                <BarChart3 className="size-4" />
                <span>Reportes</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="stock" className="mt-4 space-y-4">
            <InventoryStockView entityFilter={entityFilter} />
          </TabsContent>

          <TabsContent value="movements" className="mt-4 space-y-4">
            <MovementsHistoryTable entityFilter={entityFilter} />
          </TabsContent>

          <TabsContent value="reports" className="mt-4 space-y-4">
            <InventoryReportsPage entityFilter={entityFilter} />
          </TabsContent>
        </Tabs>
      </SectionCard>
    </div>
  );
};

export default Inventory;
