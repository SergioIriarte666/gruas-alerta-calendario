import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  const getStockStatus = (currentStock: number, totalPurchased: number, totalConsumed: number) => {
    if (currentStock === 0) return { label: 'Sin Stock', color: 'bg-red-500' };
    if (currentStock <= totalPurchased * 0.2) return { label: 'Stock Bajo', color: 'bg-yellow-500' };
    return { label: 'Stock Normal', color: 'bg-green-500' };
  };

  const getTraceabilityStatus = (inventoryItemId?: string) => {
    if (inventoryItemId) {
      return { label: 'Sincronizado', color: 'bg-tms-green', icon: Link };
    }
    return { label: 'No Sincronizado', color: 'bg-gray-500', icon: Package };
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {syncStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-black border-tms-green/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Sincronización</CardTitle>
              <BarChart3 className="h-4 w-4 text-tms-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-tms-green">
                {syncStats.sync_percentage.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-400">
                {syncStats.synced_parts} de {syncStats.total_parts} piezas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black border-tms-green/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Items Creados</CardTitle>
              <Package className="h-4 w-4 text-tms-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-tms-green">
                {syncStats.auto_created_items}
              </div>
              <p className="text-xs text-gray-400">
                Items de inventario auto-creados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black border-tms-green/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Items Inventario</CardTitle>
              <TrendingUp className="h-4 w-4 text-tms-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-tms-green">
                {syncStats.total_inventory_items}
              </div>
              <p className="text-xs text-gray-400">
                Total items en inventario
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black border-tms-green/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Sin Sincronizar</CardTitle>
              <TrendingDown className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {syncStats.unsynced_parts}
              </div>
              <p className="text-xs text-gray-400">
                Piezas pendientes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-black border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-tms-green" />
            Filtros de Trazabilidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crane-select" className="text-white">Grúa</Label>
              <Select
                value={selectedCraneId}
                onValueChange={setSelectedCraneId}
              >
                <SelectTrigger className="bg-white/5 border-tms-green/30 text-white">
                  <SelectValue placeholder="Todas las grúas" />
                </SelectTrigger>
                <SelectContent className="bg-black border-tms-green/30">
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
              <Label htmlFor="search" className="text-white">Buscar</Label>
              <Input
                id="search"
                placeholder="Buscar por pieza o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border-tms-green/30 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Traceability Table */}
      <Card className="bg-black border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-tms-green" />
            Trazabilidad de Piezas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">
              Cargando datos de trazabilidad...
            </div>
          ) : !filteredData || filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No se encontraron datos de trazabilidad
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-tms-green/30">
                    <TableHead className="text-tms-green">Pieza</TableHead>
                    <TableHead className="text-tms-green">Grúa</TableHead>
                    <TableHead className="text-tms-green">Proveedor</TableHead>
                    <TableHead className="text-tms-green">Fecha Compra</TableHead>
                    <TableHead className="text-tms-green">Costo</TableHead>
                    <TableHead className="text-tms-green">Stock Actual</TableHead>
                    <TableHead className="text-tms-green">Comprado</TableHead>
                    <TableHead className="text-tms-green">Consumido</TableHead>
                    <TableHead className="text-tms-green">Estado</TableHead>
                    <TableHead className="text-tms-green">Sincronización</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, index) => {
                    const stockStatus = getStockStatus(item.current_stock, item.total_purchased, item.total_consumed);
                    const syncStatus = getTraceabilityStatus(item.inventory_item_id);
                    const SyncIcon = syncStatus.icon;

                    return (
                      <TableRow key={`${item.part_id}-${index}`} className="border-tms-green/20">
                        <TableCell className="text-white font-medium">
                          <div>
                            <div>{item.part_name}</div>
                            {item.inventory_item_name && item.inventory_item_name !== item.part_name && (
                              <div className="text-xs text-gray-400">
                                Inventario: {item.inventory_item_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{item.crane_license_plate}</TableCell>
                        <TableCell className="text-white">{item.supplier}</TableCell>
                        <TableCell className="text-white">
                          {format(new Date(item.purchase_date), 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-white">
                          ${item.purchase_cost.toLocaleString('es-CL')}
                        </TableCell>
                        <TableCell className="text-white">
                          <div className="flex items-center gap-2">
                            <span>{item.current_stock}</span>
                            <Badge className={`text-xs ${stockStatus.color} text-white`}>
                              {stockStatus.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{item.total_purchased}</TableCell>
                        <TableCell className="text-white">{item.total_consumed}</TableCell>
                        <TableCell className="text-white">
                          <Badge className={`text-xs ${stockStatus.color} text-white`}>
                            {stockStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white">
                          <Badge className={`text-xs ${syncStatus.color} text-white flex items-center gap-1`}>
                            <SyncIcon className="h-3 w-3" />
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