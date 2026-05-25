import React from 'react';
import { Service, ServiceStatus } from '@/types';
import { ServiceCard } from './ServiceCard';
import { Badge } from '@/components/ui/badge';
import { Clock, Package, AlertCircle } from 'lucide-react';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

interface ColumnConfig {
  id: ServiceStatus;
  title: string;
  description: string;
  color: string;
  textColor: string;
}

interface KanbanColumnProps {
  column: ColumnConfig;
  services: Service[];
  clientId: string;
  onServiceUpdate: () => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  services,
  clientId,
  onServiceUpdate
}) => {
  const getColumnIcon = () => {
    switch (column.id) {
      case 'quoted':
        return <Package className="size-4" />;
      case 'purchase_order_pending':
        return <AlertCircle className="size-4" />;
      case 'pending':
        return <Clock className="size-4" />;
      case 'in_progress':
        return <Clock className="size-4" />;
      case 'completed':
        return <Package className="size-4" />;
      case 'invoiced':
        return <Package className="size-4" />;
      default:
        return <Package className="size-4" />;
    }
  };

  // Calcular métricas de la columna
  const totalValue = services.reduce((sum, service) => sum + getDisplayServiceValue(service), 0);
  const avgDays = services.length > 0 ? Math.round(
    services.reduce((sum, service) => {
      const daysDiff = Math.floor(
        (new Date().getTime() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + daysDiff;
    }, 0) / services.length
  ) : 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 min-h-[400px]">
      {/* Column Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-foreground">
              {getColumnIcon()}
            </div>
            <h3 className="font-medium text-foreground">
              {column.title}
            </h3>
          </div>
          <Badge variant="outline">
            {services.length}
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          {column.description}
        </p>

        {/* Column Metrics */}
        {services.length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-card rounded p-2">
              <div className="text-muted-foreground">Total</div>
              <div className="font-medium text-foreground">
                ${totalValue.toLocaleString()}
              </div>
            </div>
            <div className="bg-card rounded p-2">
              <div className="text-muted-foreground">Prom. días</div>
              <div className="font-medium text-foreground">
                {avgDays}d
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Service Cards */}
      <div className="space-y-2 flex-1">
        {services.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Package className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin servicios</p>
            </div>
          </div>
        ) : (
          services
            .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
            .map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                onUpdate={onServiceUpdate}
              />
            ))
        )}
      </div>
    </div>
  );
};