
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
import { getCraneStatusLabel, isCranePermanentlyLocked } from '@/utils/craneStatus';
import { getCraneTypeLabel } from '@/utils/craneType';

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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Package className="size-3" />
        <span>Cargando...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <div className="flex items-center gap-1 text-xs">
        <Package className="size-3 text-primary" />
        <span className="text-foreground">{metrics.totalPartsInstalled || 0} piezas</span>
      </div>
      
      <div className="flex items-center gap-1 text-xs">
        <DollarSign className="size-3 text-success" />
        <span className="text-foreground">${(metrics.totalValue / 1000).toFixed(0)}K</span>
      </div>

      {metrics.recentPurchases > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <TrendingUp className="size-3 text-info" />
          <span className="text-info">{metrics.recentPurchases} recientes</span>
        </div>
      )}

      {metrics.pendingMaintenanceAlerts > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <AlertTriangle className="size-3 text-warning" />
          <span className="text-warning">{metrics.pendingMaintenanceAlerts} alertas</span>
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
          <Truck className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron grúas</h3>
          <p className="text-muted-foreground mb-4">
            No hay grúas que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewCrane}>
            <Plus className="size-4 mr-2" />
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
          <Truck className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No hay grúas registradas</h3>
          <p className="text-muted-foreground mb-4">
            Comienza agregando tu primera grúa al sistema
          </p>
          <Button onClick={onNewCrane}>
            <Plus className="size-4 mr-2" />
            Agregar Primera Grúa
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Grúas ({totalCranes})</h3>
      </div>
      
      {cranes.map((crane) => (
        <Card key={crane.id} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-lg">{crane.licensePlate}</h4>
                <p className="text-primary text-sm font-medium">{crane.brand} {crane.model}</p>
                <p className="text-muted-foreground text-sm">
                  Empresa: {crane.ownerCompanyName || crane.ownerCompanyRut || 'Sin empresa'}
                </p>
                <p className="text-muted-foreground text-sm">Tipo: {getCraneTypeLabel(crane.type)}</p>
              </div>
              <Badge 
                variant={crane.isActive ? "default" : "secondary"}
                className={crane.isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
                }
              >
                {getCraneStatusLabel(crane.status)}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-foreground text-sm">
                <Calendar className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>Rev. Técnica: {format(new Date(crane.technicalReviewExpiry), 'dd/MM/yyyy', { locale: es })}</span>
              </div>

              <div className="flex items-center text-foreground text-sm">
                <Shield className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>Seguro: {format(new Date(crane.insuranceExpiry), 'dd/MM/yyyy', { locale: es })}</span>
              </div>

              <div className="flex items-center text-foreground text-sm">
                <Wrench className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
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
                  "border border-info/30 text-info hover:bg-info-soft/60 hover:text-info touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Eye className="size-4 mr-1" />
                Ver
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onEdit(crane)}
                disabled={isCranePermanentlyLocked(crane)}
                className={cn(
                  "border border-primary/30 text-primary hover:bg-primary-soft hover:text-primary touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Edit className="size-4 mr-1" />
                Editar
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onDelete(crane)}
                disabled={isCranePermanentlyLocked(crane)}
                className={cn(
                  "border border-danger/30 text-danger hover:bg-danger-soft/70 hover:text-danger touch-target",
                  isMobile ? "w-full" : "px-3"
                )}
              >
                <Trash2 className="size-4" />
                {isMobile && <span className="ml-1">Eliminar</span>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
