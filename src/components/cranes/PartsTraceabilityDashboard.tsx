import { businessClock } from '@/utils/businessClock';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePartsTraceability, useInventorySyncStats } from '@/hooks/useUnifiedParts';
import { useCranes } from '@/hooks/useCranes';
import { Package, TrendingUp, TrendingDown, BarChart3, Search, Link } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PartsTraceabilityDashboardProps {
  craneId?: string;
}

export const PartsTraceabilityDashboard = ({ craneId }: PartsTraceabilityDashboardProps) => {
  const [selectedCraneId, setSelectedCraneId] = useState<string>(craneId || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { cranes } = useCranes();
  const { data: traceabilityData, isLoading } = usePartsTraceability(selectedCraneId);
  const { data: syncStats } = useInventorySyncStats();

  const filteredData = traceabilityData?.filter(item =>
    item.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (currentStock: number, totalPurchased: number, _totalConsumed: number) => {
    if (currentStock === 0) return { label: 'Sin Stock', color: 'bg-danger text-danger-foreground' };
    if (currentStock <= totalPurchased * 0.2) return { label: 'Stock Bajo', color: 'bg-warning text-warning-foreground' };
    return { label: 'Stock Normal', color: 'bg-success text-success-foreground' };
  };

  const getTraceabilityStatus = (inventoryItemId?: string) => {
    if (inventoryItemId) {
      return { label: 'Sincronizado', color: 'bg-success text-success-foreground', icon: Link };
    }
    return { label: 'No Sincronizado', color: 'bg-muted text-muted-foreground', icon: Package };
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {syncStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Sincronización</CardTitle>
              <BarChart3 className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {syncStats.sync_percentage.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {syncStats.synced_parts} de {syncStats.total_parts} piezas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Items Creados</CardTitle>
              <Package className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {syncStats.auto_created_items}
              </div>
              <p className="text-xs text-muted-foreground">
                Items de inventario auto-creados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Items Inventario</CardTitle>
              <TrendingUp className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {syncStats.total_inventory_items}
              </div>
              <p className="text-xs text-muted-foreground">
                Total items en inventario
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Sin Sincronizar</CardTitle>
              <TrendingDown className="size-4 text-warning-text" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning-text">
                {syncStats.unsynced_parts}
              </div>
              <p className="text-xs text-muted-foreground">
                Piezas pendientes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-card border-primary/30">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Search className="size-5 text-primary" />
            Filtros de Trazabilidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crane-select" className="text-foreground">Grúa</Label>
              <Select
                value={selectedCraneId}
                onValueChange={setSelectedCraneId}
              >
                <SelectTrigger className="bg-card/5 border-primary/30 text-foreground">
                  <SelectValue placeholder="Todas las grúas" />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary/30">
                  <SelectItem value="all">Todas las grúas</SelectItem>
                  {cranes?.map((crane) => (
                    <SelectItem key={crane.id} value={crane.id}>
                      {crane.licensePlate} - {crane.brand} {crane.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search" className="text-foreground">Buscar</Label>
              <Input
                id="search"
                placeholder="Buscar por pieza o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-card/5 border-primary/30 text-foreground"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Traceability Table */}
      <Card className="bg-card border-primary/30">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Package className="size-5 text-primary" />
            Trazabilidad de Piezas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando datos de trazabilidad...
            </div>
          ) : !filteredData || filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron datos de trazabilidad
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-primary/30">
                    <TableHead className="text-primary">Pieza</TableHead>
                    <TableHead className="text-primary">Grúa</TableHead>
                    <TableHead className="text-primary">Proveedor</TableHead>
                    <TableHead className="text-primary">Fecha Compra</TableHead>
                    <TableHead className="text-primary">Costo</TableHead>
                    <TableHead className="text-primary">Stock Actual</TableHead>
                    <TableHead className="text-primary">Comprado</TableHead>
                    <TableHead className="text-primary">Consumido</TableHead>
                    <TableHead className="text-primary">Estado</TableHead>
                    <TableHead className="text-primary">Sincronización</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, index) => {
                    const stockStatus = getStockStatus(item.current_stock, item.total_purchased, item.total_consumed);
                    const syncStatus = getTraceabilityStatus(item.inventory_item_id);
                    const SyncIcon = syncStatus.icon;

                    return (
                      <TableRow key={`${item.part_id}-${index}`} className="border-primary/20">
                        <TableCell className="text-foreground font-medium">
                          <div>
                            <div>{item.part_name}</div>
                            {item.inventory_item_name && item.inventory_item_name !== item.part_name && (
                              <div className="text-xs text-muted-foreground">
                                Inventario: {item.inventory_item_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{item.crane_license_plate}</TableCell>
                        <TableCell className="text-foreground">{item.supplier}</TableCell>
                        <TableCell className="text-foreground">
                          {businessClock.format(item.purchase_date, 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-foreground">
                          ${item.purchase_cost.toLocaleString('es-CL')}
                        </TableCell>
                        <TableCell className="text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{item.current_stock}</span>
                            <Badge className={`text-xs ${stockStatus.color}`}>
                              {stockStatus.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{item.total_purchased}</TableCell>
                        <TableCell className="text-foreground">{item.total_consumed}</TableCell>
                        <TableCell className="text-foreground">
                          <Badge className={`text-xs ${stockStatus.color}`}>
                            {stockStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground">
                          <Badge className={`flex items-center gap-1 text-xs ${syncStatus.color}`}>
                            <SyncIcon className="size-3" />
                            {syncStatus.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
