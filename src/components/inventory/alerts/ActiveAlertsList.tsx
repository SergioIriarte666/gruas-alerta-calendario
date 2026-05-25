import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Clock, 
  Package, 
  MapPin, 
  ExternalLink,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ActiveAlert } from '@/hooks/useInventoryAlerts';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDetailModal } from './AlertDetailModal';

interface ActiveAlertsListProps {
  alerts: ActiveAlert[];
  loading?: boolean;
}

export const ActiveAlertsList: React.FC<ActiveAlertsListProps> = ({ alerts, loading }) => {
  const [selectedAlert, setSelectedAlert] = useState<ActiveAlert | null>(null);
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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="size-4" />;
      case 'warning':
        return <AlertTriangle className="size-4" />;
      case 'info':
        return <CheckCircle className="size-4" />;
      default:
        return <CheckCircle className="size-4" />;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'low_stock':
        return 'Stock Bajo';
      case 'expiring_soon':
        return 'Próximo a Vencer';
      case 'overstock':
        return 'Sobrestock';
      case 'no_movement':
        return 'Sin Movimiento';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-muted rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="size-12 mx-auto mb-4 text-success" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No hay alertas activas
        </h3>
        <p className="text-muted-foreground">
          Todos los indicadores están dentro de los parámetros normales
        </p>
      </div>
    );
  }

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning');
  const infoAlerts = alerts.filter(alert => alert.severity === 'info');

  return (
    <div className="space-y-4">
      {/* Alertas Críticas */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
            <XCircle className="size-5" />
            Alertas Críticas ({criticalAlerts.length})
          </h3>
          {criticalAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onViewDetail={setSelectedAlert} />
          ))}
        </div>
      )}

      {/* Advertencias */}
      {warningAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-warning flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Advertencias ({warningAlerts.length})
          </h3>
          {warningAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onViewDetail={setSelectedAlert} />
          ))}
        </div>
      )}

      {/* Información */}
      {infoAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
            <CheckCircle className="size-5" />
            Información ({infoAlerts.length})
          </h3>
          {infoAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onViewDetail={setSelectedAlert} />
          ))}
        </div>
      )}
      <AlertDetailModal 
        alert={selectedAlert} 
        open={!!selectedAlert} 
        onClose={() => setSelectedAlert(null)} 
      />
    </div>
  );
};

interface AlertCardProps {
  alert: ActiveAlert;
  onViewDetail: (alert: ActiveAlert) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onViewDetail }) => {
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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="size-4" />;
      case 'warning':
        return <AlertTriangle className="size-4" />;
      case 'info':
        return <CheckCircle className="size-4" />;
      default:
        return <CheckCircle className="size-4" />;
    }
  };

  return (
    <Card className={`border-l-4 ${
      alert.severity === 'critical' ? 'border-l-destructive' : 
      alert.severity === 'warning' ? 'border-l-warning' : 
      'border-l-primary'
    }`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 gap-y-2">
            <div className="flex items-center gap-3">
              <Badge variant={getSeverityColor(alert.severity)} className="flex items-center gap-1">
                {getSeverityIcon(alert.severity)}
                {alert.severity === 'critical' ? 'Crítico' : 
                 alert.severity === 'warning' ? 'Advertencia' : 'Info'}
              </Badge>
              <Badge variant="outline">{alert.type.replace('_', ' ').toUpperCase()}</Badge>
            </div>
            
            <h4 className="font-semibold text-foreground">{alert.title}</h4>
            <p className="text-muted-foreground">{alert.message}</p>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Package className="size-4" />
                <span>{alert.item_name}</span>
              </div>
              
              {alert.location_name && (
                <div className="flex items-center gap-1">
                  <MapPin className="size-4" />
                  <span>{alert.location_name}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <Clock className="size-4" />
                <span>
                  {formatDistanceToNow(new Date(alert.created_at), { 
                    addSuffix: true, 
                    locale: es 
                  })}
                </span>
              </div>
            </div>

            {alert.threshold_value && (
              <div className="text-sm">
                <span className="text-muted-foreground">Valor actual: </span>
                <span className={`font-medium ${
                  alert.severity === 'critical' ? 'text-destructive' : 
                  alert.severity === 'warning' ? 'text-warning' : 
                  'text-foreground'
                }`}>
                  {alert.current_value}
                </span>
                <span className="text-muted-foreground"> / Umbral: {alert.threshold_value}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => onViewDetail(alert)}
            >
              <ExternalLink className="size-3" />
              Ver Detalle
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};