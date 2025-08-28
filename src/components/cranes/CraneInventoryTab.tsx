
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign,
  Calendar,
  ArrowUpDown,
  Warehouse,
  ShoppingCart
} from 'lucide-react';
import { Crane } from '@/types';
import { useCraneInventoryMetrics } from '@/hooks/useCraneInventoryMetrics';
import { useInventoryMovements } from '@/hooks/useInventory';
import { usePartsTraceability, useInventorySyncStats } from '@/hooks/useUnifiedParts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CraneInventoryTabProps {
  crane: Crane;
}

export const CraneInventoryTab = ({ crane }: CraneInventoryTabProps) => {
  const { data: metrics, isLoading: metricsLoading } = useCraneInventoryMetrics(crane.id);
  const { data: movements, isLoading: movementsLoading } = useInventoryMovements(10);
  const { data: traceabilityData, isLoading: traceabilityLoading } = usePartsTraceability(crane.id);
  const { data: syncStats } = useInventorySyncStats();

  // Filtrar movimientos relacionados con esta grúa
  const craneMovements = movements?.filter(movement => movement.crane_id === crane.id) || [];

  if (metricsLoading || movementsLoading || traceabilityLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400">Cargando información de inventario...</div>
      </div>
    );
  }

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'entry':
        return <ArrowUpDown className="w-4 h-4 text-green-400" />;
      case 'exit':
        return <ArrowUpDown className="w-4 h-4 text-red-400" />;
      default:
        return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'entry':
        return 'Entrada';
      case 'exit':
        return 'Salida';
      case 'transfer':
        return 'Transferencia';
      case 'adjustment':
        return 'Ajuste';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-tms-green" />
              <div>
                <p className="text-sm text-gray-400">Total Piezas</p>
                <p className="text-2xl font-bold text-white">{metrics?.totalParts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Valor Total</p>
                <p className="text-2xl font-bold text-white">${(metrics?.totalValue || 0).toLocaleString('es-CL')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Compras Recientes</p>
                <p className="text-2xl font-bold text-white">{metrics?.recentPurchases || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-orange-400" />
              <div>
                <p className="text-sm text-gray-400">Sincronización</p>
                <p className="text-2xl font-bold text-white">{syncStats?.sync_percentage.toFixed(0) || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Mantenimiento */}
      {(metrics?.pendingMaintenanceAlerts || 0) > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Mantenimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-300">
              Hay {metrics?.pendingMaintenanceAlerts} mantenimientos programados pendientes para esta grúa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Trazabilidad de Piezas */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-tms-green" />
            Trazabilidad de Piezas e Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">Piezas Sincronizadas</p>
                <p className="text-xl font-bold text-tms-green">{syncStats.synced_parts}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">Sin Sincronizar</p>
                <p className="text-xl font-bold text-yellow-400">{syncStats.unsynced_parts}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">% Sincronización</p>
                <p className="text-xl font-bold text-blue-400">{syncStats.sync_percentage.toFixed(1)}%</p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">Items Inventario</p>
                <p className="text-xl font-bold text-purple-400">{syncStats.total_inventory_items}</p>
              </div>
            </div>
          )}

          {traceabilityData && traceabilityData.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Piezas Recientes</h4>
              {traceabilityData.slice(0, 5).map((item, index) => (
                <div key={`${item.part_id}-${index}`} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-tms-green" />
                    <div>
                      <p className="text-white font-medium">{item.part_name}</p>
                      <p className="text-sm text-gray-400">
                        {item.supplier} • Stock: {item.current_stock}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={item.inventory_item_id ? 'default' : 'secondary'}
                        className={item.inventory_item_id 
                          ? 'bg-tms-green/20 text-tms-green border-tms-green/30' 
                          : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        }
                      >
                        {item.inventory_item_id ? 'Sincronizado' : 'Pendiente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      ${item.purchase_cost.toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>
              ))}
              
              {traceabilityData.length > 5 && (
                <p className="text-center text-gray-400 text-sm">
                  ... y {traceabilityData.length - 5} piezas más
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin datos de trazabilidad</h3>
              <p className="text-gray-400 text-sm">
                No se encontraron piezas registradas para esta grúa.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movimientos Recientes de Inventario */}
      {craneMovements.length > 0 && (
        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-tms-green" />
              Movimientos Recientes de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {craneMovements.slice(0, 5).map((movement) => (
                <div key={movement.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getMovementTypeIcon(movement.movement_type)}
                    <div>
                      <p className="text-white font-medium">{movement.item?.name || 'Item no especificado'}</p>
                      <p className="text-sm text-gray-400">
                        {getMovementTypeLabel(movement.movement_type)} • Cantidad: {movement.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={movement.movement_type === 'entry' ? 'default' : 'secondary'}
                        className={movement.movement_type === 'entry' 
                          ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                          : 'bg-red-500/20 text-red-300 border-red-500/30'
                        }
                      >
                        {movement.movement_type === 'entry' ? '+' : '-'}{movement.quantity}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(movement.movement_date), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
              
              {craneMovements.length > 5 && (
                <p className="text-center text-gray-400 text-sm">
                  ... y {craneMovements.length - 5} movimientos más
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado del Último Movimiento */}
      {metrics?.lastMovementDate && (
        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-tms-green" />
              Último Movimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">
              Último movimiento de inventario registrado el{' '}
              <span className="text-tms-green font-medium">
                {format(new Date(metrics.lastMovementDate), 'dd/MM/yyyy HH:mm', { locale: es })}
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
