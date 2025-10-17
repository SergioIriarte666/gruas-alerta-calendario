
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, Truck, Plus, Calendar, Wrench, Shield, Package, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';
import { Crane } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';
import { useCraneInventoryMetrics } from '@/hooks/useCraneInventoryMetrics';

interface CranesMobileViewProps {
  cranes: Crane[];
  totalCranes: number;
  onEdit: (crane: Crane) => void;
  onDelete: (crane: Crane) => void;
  onViewDetails: (crane: Crane) => void;
  onNewCrane: () => void;
  searchTerm: string;
}

const CraneInventoryIndicators = ({ crane }: { crane: Crane }) => {
  const { data: metrics, isLoading } = useCraneInventoryMetrics(crane.id);

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Package className="w-3 h-3" />
        <span>Cargando...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <div className="flex items-center gap-1 text-xs">
        <Package className="w-3 h-3 text-tms-green" />
        <span className="text-white">{metrics.totalPartsInstalled || 0} piezas</span>
      </div>
      
      <div className="flex items-center gap-1 text-xs">
        <DollarSign className="w-3 h-3 text-green-400" />
        <span className="text-white">${(metrics.totalValue / 1000).toFixed(0)}K</span>
      </div>

      {metrics.recentPurchases > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <TrendingUp className="w-3 h-3 text-blue-400" />
          <span className="text-blue-300">{metrics.recentPurchases} recientes</span>
        </div>
      )}

      {metrics.pendingMaintenanceAlerts > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <AlertTriangle className="w-3 h-3 text-yellow-400" />
          <span className="text-yellow-300">{metrics.pendingMaintenanceAlerts} alertas</span>
        </div>
      )}
    </div>
  );
};

export const CranesMobileView = ({
  cranes,
  totalCranes,
  onEdit,
  onDelete,
  onViewDetails,
  onNewCrane,
  searchTerm,
}: CranesMobileViewProps) => {
  const { isMobile, isTablet } = useDeviceType();
  
  if (cranes.length === 0 && searchTerm) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <Truck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No se encontraron grúas</h3>
          <p className="text-gray-400 mb-4">
            No hay grúas que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewCrane} className="bg-tms-green hover:bg-tms-green/80 text-black">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Grúa
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (cranes.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <Truck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hay grúas registradas</h3>
          <p className="text-gray-400 mb-4">
            Comienza agregando tu primera grúa al sistema
          </p>
          <Button onClick={onNewCrane} className="bg-tms-green hover:bg-tms-green/80 text-black">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primera Grúa
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Grúas ({totalCranes})</h3>
      </div>
      
      {cranes.map((crane) => (
        <Card key={crane.id} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-white text-lg">{crane.licensePlate}</h4>
                <p className="text-tms-green text-sm font-medium">{crane.brand} {crane.model}</p>
                <p className="text-white/70 text-sm">Tipo: {crane.type}</p>
              </div>
              <Badge 
                variant={crane.isActive ? "default" : "secondary"}
                className={crane.isActive 
                  ? "bg-tms-green text-black" 
                  : "bg-gray-600 text-white"
                }
              >
                {crane.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-white text-sm">
                <Calendar className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>Rev. Técnica: {format(new Date(crane.technicalReviewExpiry), 'dd/MM/yyyy', { locale: es })}</span>
              </div>

              <div className="flex items-center text-white text-sm">
                <Shield className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>Seguro: {format(new Date(crane.insuranceExpiry), 'dd/MM/yyyy', { locale: es })}</span>
              </div>

              <div className="flex items-center text-white text-sm">
                <Wrench className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>Permiso Circulación: {format(new Date(crane.circulationPermitExpiry), 'dd/MM/yyyy', { locale: es })}</span>
              </div>
            </div>

            {/* Indicadores de Inventario */}
            <CraneInventoryIndicators crane={crane} />

            <div className={cn(
              "flex gap-2 mt-4",
              isMobile ? "flex-col" : "flex-wrap"
            )}>
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onViewDetails(crane)}
                className={cn(
                  "text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/50 touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onEdit(crane)}
                className={cn(
                  "text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50 touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onDelete(crane)}
                className={cn(
                  "text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50 touch-target",
                  isMobile ? "w-full" : "px-3"
                )}
              >
                <Trash2 className="w-4 h-4" />
                {isMobile && <span className="ml-1">Eliminar</span>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
