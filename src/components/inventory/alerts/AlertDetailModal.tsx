import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  Clock,
  TrendingDown,
  Settings,
  ExternalLink
} from 'lucide-react';
import { ActiveAlert } from '@/hooks/useInventoryAlerts';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface AlertDetailModalProps {
  alert: ActiveAlert | null;
  open: boolean;
  onClose: () => void;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  alert,
  open,
  onClose
}) => {
  if (!alert) return null;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="size-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="size-5 text-warning" />;
      case 'info':
        return <CheckCircle className="size-5 text-primary" />;
      default:
        return <CheckCircle className="size-5 text-primary" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'outline';
      case 'info':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getRecommendations = () => {
    switch (alert.type) {
      case 'low_stock':
        return [
          'Revisar proveedores disponibles y tiempos de entrega',
          'Evaluar posibilidad de transferencia desde otras ubicaciones',
          'Considerar ajustar niveles de stock mínimo si es recurrente',
          'Notificar al equipo de compras para reposición urgente'
        ];
      case 'expiring_soon':
        return [
          'Priorizar el uso de este producto en próximos proyectos',
          'Evaluar posibilidad de devolución al proveedor',
          'Considerar descuento o promoción especial',
          'Revisar políticas de rotación de inventario'
        ];
      default:
        return ['Revisar situación específica del producto'];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getSeverityIcon(alert.severity)}
            <div>
              <DialogTitle className="text-xl">{alert.title}</DialogTitle>
              <DialogDescription className="text-base mt-1">
                Detalles completos de la alerta
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Type */}
          <div className="flex items-center gap-3">
            <Badge variant={getSeverityColor(alert.severity)} className="flex items-center gap-2">
              {getSeverityIcon(alert.severity)}
              {alert.severity === 'critical' ? 'Crítico' : 
               alert.severity === 'warning' ? 'Advertencia' : 'Información'}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <Settings className="size-3" />
              {alert.type.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>

          <Separator />

          {/* Alert Message */}
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Descripción</h3>
            <p className="text-muted-foreground">{alert.message}</p>
          </div>

          <Separator />

          {/* Product and Location Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-primary" />
                <span className="font-medium">Producto</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{alert.item_name}</p>
            </div>

            {alert.location_name && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <span className="font-medium">Ubicación</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">{alert.location_name}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span className="font-medium">Detectada</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {formatDistanceToNow(new Date(alert.created_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </p>
            </div>

            {alert.threshold_value && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="size-4 text-primary" />
                  <span className="font-medium">Valores</span>
                </div>
                <div className="text-sm pl-6 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual:</span>
                    <span className={`font-medium ${
                      alert.severity === 'critical' ? 'text-destructive' : 
                      alert.severity === 'warning' ? 'text-warning' : 
                      'text-foreground'
                    }`}>
                      {alert.current_value}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Umbral:</span>
                    <span className="font-medium">{alert.threshold_value}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Recommendations */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Acciones Recomendadas</h3>
            <ul className="space-y-2">
              {getRecommendations().map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="size-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button 
              onClick={() => {
                // Navigate to item detail or inventory management
                window.open(`/inventory/items`, '_blank');
              }}
              className="flex items-center gap-2"
            >
              <ExternalLink className="size-4" />
              Ver en Inventario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};